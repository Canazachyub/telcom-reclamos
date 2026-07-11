// 🏢 EN OFICINA (físicos) — Expedientes → sub-pestaña (solo se monta dentro de ExpedientesTab,
// que a su vez solo vive en Admin.jsx → visible para GERENTE y COORDINADOR, igual que el resto
// de la pestaña Expedientes). El equipo tiene ~66 expedientes FÍSICOS en la oficina (inventariados
// por fotos → Excel). Este panel:
//  a) marca qué casos tienen su físico en oficina (dato vivo, cero columnas nuevas),
//  b) lo muestra como inventario (tabla + KPIs),
//  c) permite marcar en lote pegando suministros/códigos (con vista previa y resolución de ambiguos),
//  d) imprime los QRs para pegarlos en los folders,
//  e) detecta el inverso: casos ABIERTOS sin físico ubicado (ámbar discreto — esto es inventario,
//     NO alarma: "el rojo se gana", aquí no hay vencimiento real en juego).
//
// El dato vive en datos_etapa vía la action YA EXISTENTE `guardar_datos` (regla §3.1 de
// ARQUITECTURA.md: dato nuevo por caso = clave-valor, cero columnas, cero backend). Convención:
// etapa "Recepción" (el físico se recibe en oficina) — FISICO_OFICINA="sí"|"no", FISICO_FECHA,
// FISICO_FUENTE (ver lib/camposEtapa.js, donde también quedan editables caso a caso desde el
// Drawer). Cada marca queda firmada en la bitácora (registros tipo=datos), como cualquier dato
// de etapa — nada de esto es "silencioso": es evidencia de inventario, igual que el resto.
//
// Toda la red pasa por saveDatos (viene del contexto → lib/api.js guardarDatos, cero actions
// nuevas). LECCIÓN del review de Herencia: el suministro identifica al MEDIDOR, no al caso — un
// suministro con varios reclamos NUNCA se resuelve solo; va a "ambiguos" para elegir a mano.
import { useMemo, useRef, useState } from "react";
import { Card, Kpi, toast } from "./ui.jsx";
import { SemaforoPlazo } from "./Ticket.jsx";
import { fmtFecha } from "../lib/model.js";
import { imprimirQRs } from "../lib/qr.js";

const hoyISO = () => new Date().toISOString().slice(0, 10);
const FUENTE_DEFAULT = "inventario fotos 10/07/2026";

// exportarCSV — MISMO patrón que Cuadernos.jsx/HerenciaPanel.jsx (BOM + ";" + comillas escapadas).
function exportarCSV(nombre, headers, filas) {
  const esc = v => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
  const lineas = [headers.map(esc).join(";"), ...filas.map(r => r.map(esc).join(";"))];
  const blob = new Blob(["﻿" + lineas.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${nombre}.csv`;
  a.click(); URL.revokeObjectURL(a.href);
  toast("Exportado — ábrelo en Excel");
}

// Clave EXACTA que arma el bundle de datos_etapa (App.jsx: setDatos({[exp+"|"+etapa]:...})).
const tieneFisico = (datos, codigo) => (datos && datos[codigo + "|Recepción"]?.FISICO_OFICINA) === "sí";
const fisicoInfo = (datos, codigo) => (datos && datos[codigo + "|Recepción"]) || {};

// primer token NUMÉRICO de una línea pegada (tolera columnas de Excel separadas por tab/;/coma;
// suministros y códigos SIELSE tienen varios dígitos — evita capturar un "1" de numeración).
function primerNumero(linea) {
  const m = String(linea || "").match(/\d{4,}/);
  return m ? m[0] : "";
}

export default function OficinaPanel({ data = [], activoByCode = {}, datos = {}, saveDatos, perfil, setSelExp }) {
  const [q, setQ] = useState("");
  const [pegado, setPegado] = useState("");
  const [fuente, setFuente] = useState(FUENTE_DEFAULT);
  const [preview, setPreview] = useState(null); // {resueltos, ambiguos, noEncontrados}
  const [marcando, setMarcando] = useState(false);
  const [progreso, setProgreso] = useState({ n: 0, total: 0 });
  const [errores, setErrores] = useState([]);
  const [resumenFinal, setResumenFinal] = useState(null);
  const pausarRef = useRef(false);

  const marcados = useMemo(() => data.filter(x => tieneFisico(datos, x.codigo)), [data, datos]);
  const abiertosSinFisico = useMemo(() => data.filter(x => x.estado !== "Cerrado" && !tieneFisico(datos, x.codigo)), [data, datos]);
  const cerradosConFisico = useMemo(() => marcados.filter(x => x.estado === "Cerrado"), [marcados]);

  const marcadosFiltrados = useMemo(() => {
    if (!q.trim()) return marcados;
    const qq = q.trim().toLowerCase();
    return marcados.filter(x => `${x.osinerg} ${x.codigo} ${x.solicitante} ${x.suministro}`.toLowerCase().includes(qq));
  }, [marcados, q]);

  async function marcarUno(x, valor, fuenteTxt) {
    return saveDatos({ exp: x.codigo, etapa: "Recepción", rol: perfil?.rol, campos: {
      FISICO_OFICINA: valor, FISICO_FECHA: hoyISO(), FISICO_FUENTE: fuenteTxt || (valor === "no" ? "desmarcado manual" : "manual"),
    } });
  }

  async function desmarcar(x) {
    if (!confirm(`¿Quitar la marca de físico en oficina de ${x.osinerg || x.codigo}?`)) return;
    const r = await marcarUno(x, "no");
    if (r && r.ok !== false) toast("Desmarcado — " + (x.osinerg || x.codigo));
    else toast("⚠ No se guardó: " + ((r && r.error) || "error"));
  }

  // ---- resolución CLIENT-SIDE del pegado (solo vista previa — nada se guarda todavía) ----
  function resolverPegado() {
    const lineas = pegado.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const resueltos = [], ambiguos = [], noEncontrados = [];
    const yaVistos = new Set();
    lineas.forEach(linea => {
      const token = primerNumero(linea);
      if (!token) { noEncontrados.push({ linea, token: "" }); return; }
      // 1) código de reclamo EXACTO — identifica al CASO, sin ambigüedad posible.
      let rec = data.find(x => String(x.codigo) === token);
      if (!rec) {
        // 2) suministro — SOLO si es ÚNICO. Varios reclamos con ese suministro → nunca se marca
        // solo (el suministro identifica al medidor, no al caso): va a "ambiguos" a elegir a mano.
        const cands = data.filter(x => String(x.suministro) === token);
        if (cands.length === 1) rec = cands[0];
        else if (cands.length > 1) { ambiguos.push({ token, linea, candidatos: cands }); return; }
      }
      if (!rec) { noEncontrados.push({ linea, token }); return; }
      if (yaVistos.has(rec.codigo)) return; // dedup si el pegado repite el mismo caso
      yaVistos.add(rec.codigo);
      resueltos.push({ token, rec });
    });
    setPreview({ resueltos, ambiguos, noEncontrados });
    setErrores([]); setResumenFinal(null);
  }

  // ---- marcado EN LOTE — SECUENCIAL, pausable, errores listados sin abortar (patrón Herencia) ----
  async function ejecutarLote() {
    if (!preview || !preview.resueltos.length || marcando) return;
    setMarcando(true); pausarRef.current = false;
    setErrores([]); setResumenFinal(null);
    setProgreso({ n: 0, total: preview.resueltos.length });
    let ok = 0, fail = 0; const errs = [];
    for (let i = 0; i < preview.resueltos.length; i++) {
      if (pausarRef.current) break;
      const { rec } = preview.resueltos[i];
      try {
        const r = await marcarUno(rec, "sí", fuente);
        if (r && r.ok !== false) ok++; else { fail++; errs.push({ codigo: rec.osinerg || rec.codigo, error: (r && r.error) || "sin respuesta" }); }
      } catch (e) { fail++; errs.push({ codigo: rec.osinerg || rec.codigo, error: String(e) }); }
      setProgreso({ n: i + 1, total: preview.resueltos.length });
    }
    setErrores(errs);
    setResumenFinal({ ok, fail, total: preview.resueltos.length, pausado: pausarRef.current });
    setMarcando(false);
    toast(`📄 Marcados ${ok}/${preview.resueltos.length}${fail ? ` · ${fail} error(es)` : ""}`);
  }
  const pausar = () => { pausarRef.current = true; };

  // marcar UN candidato elegido a mano de un grupo ambiguo (suministro con varios reclamos).
  function marcarAmbiguoElegido(token, rec) {
    marcarUno(rec, "sí", fuente).then(r => {
      if (r && r.ok !== false) {
        toast("📄 Marcado — " + (rec.osinerg || rec.codigo));
        setPreview(p => p ? { ...p, ambiguos: p.ambiguos.map(a => a.token === token ? { ...a, candidatos: a.candidatos.filter(c => c.codigo !== rec.codigo) } : a) } : p);
      } else toast("⚠ No se guardó: " + ((r && r.error) || "error"));
    });
  }

  const itemsQR = marcadosFiltrados.map(x => ({ suministro: x.suministro, reclamante: x.solicitante, osinerg: x.osinerg, reclamo: x.codigo }));

  const exportarMarcados = () => exportarCSV("fisicos_en_oficina",
    ["Código completo", "Suministro", "Reclamante", "Etapa", "Fecha verificación", "Fuente"],
    marcados.map(x => { const f = fisicoInfo(datos, x.codigo); const act = activoByCode[String(x.codigo)];
      return [x.osinerg || x.codigo, x.suministro || "", x.solicitante || "", act ? act.etapa : x.etapa, f.FISICO_FECHA ? fmtFecha(f.FISICO_FECHA) : "", f.FISICO_FUENTE || ""]; }));
  const exportarSinFisico = () => exportarCSV("abiertos_sin_fisico",
    ["Código completo", "Suministro", "Reclamante", "Etapa", "Estado"],
    abiertosSinFisico.map(x => { const act = activoByCode[String(x.codigo)]; return [x.osinerg || x.codigo, x.suministro || "", x.solicitante || "", act ? act.etapa : x.etapa, x.estado]; }));

  return <>
    <Card>
      <h3 style={{ marginTop: 0 }}>🏢 En oficina — inventario de expedientes físicos</h3>
      <div className="muted" style={{ fontSize: 12, lineHeight: 1.6 }}>
        Marca qué casos tienen su expediente EN PAPEL en la oficina (inventario por fotos, verificable). No es un dato de SIELSE: vive en la bitácora de esta plataforma y queda firmado por quien lo marca.<br />
        Úsalo también al revés: <b>casos abiertos sin físico ubicado</b> — para saber cuáles hay que buscar o pedir de vuelta.
      </div>
    </Card>

    <div className="kpigrid" style={{ marginTop: 14 }}>
      <Kpi label="📄 Físicos en oficina" value={marcados.length} sub="marcados en la plataforma" />
      <Kpi label="⚠ Abiertos sin físico" value={abiertosSinFisico.length} sub="casos NO cerrados, sin marca" s={abiertosSinFisico.length ? "ambar" : null} />
      <Kpi label="Cerrados con físico" value={cerradosConFisico.length} sub="ya cerrados, físico en oficina" />
    </div>

    <Card style={{ marginTop: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <h3 style={{ margin: 0 }}>📋 Marcar desde lista (lote)</h3>
      </div>
      <div className="muted" style={{ fontSize: 11.5, marginTop: 4, marginBottom: 8 }}>
        Pega suministros y/o códigos de reclamo — uno por línea (tolera columnas pegadas de Excel; se toma el primer número de cada línea).
      </div>
      <textarea rows={5} value={pegado} onChange={e => setPegado(e.target.value)} placeholder={"123456789\n987654321\nC-0001-2026\n…"} style={{ width: "100%", fontFamily: "ui-monospace,monospace", fontSize: 12.5 }} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 8 }}>
        <label className="muted" style={{ fontSize: 11.5 }}>Fuente:
          <input className="flt" value={fuente} onChange={e => setFuente(e.target.value)} style={{ marginLeft: 6, minWidth: 220 }} />
        </label>
        <button className="btn sm" style={{ minHeight: 44 }} onClick={resolverPegado} disabled={!pegado.trim()}>👁 Vista previa</button>
      </div>

      {preview && <div style={{ marginTop: 12 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 12.5 }}>
          <span>✅ Resueltos: <b>{preview.resueltos.length}</b></span>
          <span style={{ color: "var(--tint-amber-tx)" }}>⚠ Ambiguos: <b>{preview.ambiguos.length}</b></span>
          <span className="muted">✗ No encontrados: <b>{preview.noEncontrados.length}</b></span>
        </div>

        {preview.ambiguos.length > 0 && <div className="note st-amber" style={{ marginTop: 8, fontSize: 12 }}>
          <div style={{ marginBottom: 6 }}>Estos suministros tienen VARIOS reclamos — elige a mano cuál marcar (el suministro identifica al medidor, no al caso):</div>
          {preview.ambiguos.map(a => (
            <div key={a.token} style={{ marginBottom: 8 }}>
              <div className="mono" style={{ fontWeight: 700 }}>Suministro {a.token}</div>
              {a.candidatos.length === 0
                ? <div className="muted" style={{ fontSize: 11.5 }}>— ya se marcó el elegido —</div>
                : <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                    {a.candidatos.map(c => (
                      <button key={c.codigo} className="btn-ghost" style={{ minHeight: 44, textAlign: "left" }}
                        onClick={() => marcarAmbiguoElegido(a.token, c)}
                        title={"Marcar este caso como el físico en oficina"}>
                        <span className="mono">{c.osinerg}</span> · {c.solicitante} <span className="muted">· {c.estado}</span>
                      </button>
                    ))}
                  </div>}
            </div>
          ))}
        </div>}

        {preview.noEncontrados.length > 0 && <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>
          Sin coincidencia: {preview.noEncontrados.slice(0, 20).map(n => n.token || n.linea).join(", ")}{preview.noEncontrados.length > 20 ? "…" : ""}
        </div>}

        <div style={{ marginTop: 10 }}>
          <button className="btn primary" style={{ minHeight: 44 }} onClick={ejecutarLote} disabled={marcando || !preview.resueltos.length}>
            📄 Marcar {preview.resueltos.length} con físico en oficina
          </button>
        </div>

        {marcando && (
          <div style={{ marginTop: 10 }}>
            <div style={{ height: 8, borderRadius: 999, background: "var(--card2)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${progreso.total ? (progreso.n / progreso.total * 100) : 0}%`, background: "var(--acc)", transition: "width .2s" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
              <span className="muted" style={{ fontSize: 11.5 }}>Marcando {progreso.n}/{progreso.total}…</span>
              <button className="btn sm" style={{ minHeight: 44 }} onClick={pausar}>⏸ Detener</button>
            </div>
          </div>
        )}
        {!marcando && resumenFinal && (
          <div className={"note " + (resumenFinal.fail ? "st-amber" : "st-green")} style={{ fontSize: 12, marginTop: 8 }}>
            {resumenFinal.pausado ? "Detenido por el usuario. " : ""}Marcados {resumenFinal.ok}/{resumenFinal.total}{resumenFinal.fail ? ` · ${resumenFinal.fail} error(es) (ver abajo)` : " · sin errores"}.
          </div>
        )}
        {errores.length > 0 && (
          <div style={{ marginTop: 8 }}>
            {errores.map((e, i) => <div key={i} style={{ fontSize: 11.5, color: "var(--tint-red-tx)" }}>· {e.codigo}: {e.error}</div>)}
          </div>
        )}
      </div>}
    </Card>

    <Card style={{ marginTop: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <h3 style={{ margin: 0 }}>📄 Físicos en oficina ({marcadosFiltrados.length}/{marcados.length})</h3>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <input className="flt" placeholder="Buscar código / suministro / reclamante" value={q} onChange={e => setQ(e.target.value)} style={{ minWidth: 220 }} />
          <button className="btn sm" style={{ minHeight: 44 }} onClick={() => imprimirQRs(itemsQR, "Físicos en oficina")} disabled={!marcadosFiltrados.length}>🏷 Imprimir QRs</button>
          <button className="btn sm" style={{ minHeight: 44 }} onClick={exportarMarcados} disabled={!marcados.length}>🧮 Excel</button>
        </div>
      </div>
      <div style={{ overflowX: "auto", marginTop: 10 }}>
        <table className="tbl">
          <thead><tr><th>Código completo</th><th>Suministro</th><th>Reclamante</th><th>Etapa</th><th>Verificado</th><th>Fuente</th><th></th></tr></thead>
          <tbody>
            {marcadosFiltrados.slice(0, 300).map(x => {
              const act = activoByCode[String(x.codigo)];
              const f = fisicoInfo(datos, x.codigo);
              return (
                <tr key={x.id} className="clk" onClick={() => setSelExp(x.id)}>
                  <td className="mono">{x.osinerg}</td>
                  <td className="mono">{x.suministro || "—"}</td>
                  <td>{x.solicitante}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{act ? <>{act.etapa} <SemaforoPlazo t={act} /></> : x.etapa}</td>
                  <td className="mono" style={{ fontSize: 11.5 }}>{f.FISICO_FECHA ? fmtFecha(f.FISICO_FECHA) : "—"}</td>
                  <td style={{ fontSize: 11 }}>{f.FISICO_FUENTE || "—"}</td>
                  <td onClick={e => e.stopPropagation()}>
                    <button className="btn-ghost" style={{ minHeight: 44, fontSize: 11 }} onClick={() => desmarcar(x)}>✗ Desmarcar</button>
                  </td>
                </tr>
              );
            })}
            {!marcadosFiltrados.length && <tr><td colSpan={7} className="muted" style={{ textAlign: "center", padding: 14 }}>Sin físicos marcados por ahora — usa «📋 Marcar desde lista» arriba.</td></tr>}
          </tbody>
        </table>
      </div>
      {marcadosFiltrados.length > 300 && <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>Mostrando 300 de {marcadosFiltrados.length} — exporta a Excel para verlos todos.</div>}
    </Card>

    <Card style={{ marginTop: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <h3 style={{ margin: 0 }}>⚠ Abiertos sin físico ubicado ({abiertosSinFisico.length})</h3>
        <button className="btn sm" style={{ minHeight: 44 }} onClick={exportarSinFisico} disabled={!abiertosSinFisico.length}>🧮 Excel</button>
      </div>
      <div className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>Casos NO cerrados que todavía no tienen marca de físico en oficina — hay que ubicarlos o verificar que sigan en trámite fuera de oficina (campo/notaría).</div>
      <div style={{ overflowX: "auto", marginTop: 10 }}>
        <table className="tbl">
          <thead><tr><th>Código completo</th><th>Suministro</th><th>Reclamante</th><th>Etapa</th></tr></thead>
          <tbody>
            {abiertosSinFisico.slice(0, 300).map(x => {
              const act = activoByCode[String(x.codigo)];
              return (
                <tr key={x.id} className="clk" onClick={() => setSelExp(x.id)}>
                  <td className="mono">{x.osinerg}</td>
                  <td className="mono">{x.suministro || "—"}</td>
                  <td>{x.solicitante}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{act ? <>{act.etapa} <SemaforoPlazo t={act} /></> : x.etapa}</td>
                </tr>
              );
            })}
            {!abiertosSinFisico.length && <tr><td colSpan={4} className="muted" style={{ textAlign: "center", padding: 14 }}>Todos los casos abiertos tienen su físico ubicado.</td></tr>}
          </tbody>
        </table>
      </div>
      {abiertosSinFisico.length > 300 && <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>Mostrando 300 de {abiertosSinFisico.length} — exporta a Excel para verlos todos.</div>}
    </Card>
  </>;
}
