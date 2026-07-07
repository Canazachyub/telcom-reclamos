import { useEffect, useMemo, useState } from "react";
import { Card, Tag, toast } from "./ui.jsx";
import { loadCuadernosResumen, loadCuadernoDatos, registroControl, regenerarCuadernos } from "../lib/api.js";
import { CUADERNOS, MESES_NOMBRE, valCuaderno } from "../lib/cuadernosDef.js";
import { parseFecha } from "../lib/model.js";

// ===================== 📒 CUADERNOS DE CONTROL 2026 =====================
// Los 22 Excel del sistema anterior, vivos DENTRO de la plataforma (V2_06):
// - hub de tarjetas con contadores y huecos (celda vacía = pendiente real §9.4)
// - vista de cada cuaderno con SUS títulos/columnas de siempre; la periodicidad
//   (encabezados-fecha del Excel) volvió como filtro/agrupación por fecha_evento
// - fila clickeable → Sala del expediente · ✏ editar / ➕ registrar (bitácora firmada)
// - 🖨 cargo imprimible con ENTREGADO/RECIBIDO en blanco (el papel de siempre)

const fmtF = v => {
  if (!v) return "";
  const d = parseFecha(String(v).slice(0, 10));
  return d ? d.toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" }) : String(v);
};
const hoyISO = () => new Date().toISOString().slice(0, 10);

function semaforoElev(fila) {          // solo APELACION: plazo máx de elevación (5 d.h. — pen. 5.10)
  const plazo = String(fila.f2 || "").slice(0, 10);
  const elevada = valCuaderno(fila, "extra.siged");
  if (!plazo || elevada) return null;
  const dif = Math.round((new Date(plazo) - new Date(hoyISO())) / 86400000);
  if (dif < 0) return <Tag bg="#FDE2E2" color="#B91C1C">vencido {plazo.slice(5)}</Tag>;
  if (dif <= 2) return <Tag bg="#FEF3DF" color="#B45309">vence {plazo.slice(5)}</Tag>;
  return <Tag bg="#E8F6EC" color="#14532d">{plazo.slice(5)}</Tag>;
}

export default function Cuadernos({ data, setSelExp, perfil }) {
  const [resumen, setResumen] = useState(null);
  const [sel, setSel] = useState(null);            // def del cuaderno abierto
  const [filas, setFilas] = useState(null);
  const [filtro, setFiltro] = useState("");        // mes (mensual) o fecha_evento
  const [q, setQ] = useState("");
  const [tope, setTope] = useState(300);
  const [edit, setEdit] = useState(null);          // fila en edición | {} alta
  const [regen, setRegen] = useState(false);
  const esJefe = perfil && (perfil.rol === "GERENTE" || perfil.rol === "COORDINADOR");

  const cargarResumen = () => loadCuadernosResumen().then(setResumen);
  useEffect(() => { cargarResumen(); }, []);

  const abrir = def => {
    setSel(def); setFilas(null); setFiltro(""); setQ(""); setTope(300);
    loadCuadernoDatos(def.fuente).then(setFilas);
  };

  // expediente de la plataforma para una fila (cruce por NumeroOsinerg / CodigoReclamo)
  const recDe = fila => {
    const caso = sel.fuente === "mensual" ? String(fila.n_solicitud || "") : String(fila.reclamo || "");
    if (!caso) return null;
    return (data || []).find(x => String(x.osinerg) === caso || String(x.codigo) === caso) || null;
  };

  const filtradas = useMemo(() => {
    if (!filas) return [];
    let out = filas;
    if (sel && filtro) {
      out = sel.fuente === "mensual"
        ? out.filter(f => String(f.mes) === filtro)
        : out.filter(f => String(f.fecha_evento || "").slice(0, 7) === filtro);
    }
    if (q.trim()) {
      const t = q.trim().toUpperCase();
      out = out.filter(f => JSON.stringify(f).toUpperCase().includes(t));
    }
    return out;
  }, [filas, filtro, q, sel]);

  // opciones del filtro: meses (mensual) o meses de fecha_evento (registros)
  const opcionesFiltro = useMemo(() => {
    if (!filas || !sel) return [];
    if (sel.fuente === "mensual")
      return [...new Set(filas.map(f => String(f.mes)))].sort((a, b) => a - b)
        .map(m => [m, MESES_NOMBRE[+m] || m]);
    return [...new Set(filas.map(f => String(f.fecha_evento || "").slice(0, 7)).filter(Boolean))]
      .sort().reverse().map(m => [m, (MESES_NOMBRE[+m.slice(5, 7)] || m) + " " + m.slice(0, 4)]);
  }, [filas, sel]);

  const regenerar = async () => {
    if (regen) return;
    setRegen(true);
    const r = await regenerarCuadernos();
    setRegen(false);
    if (r && r.ok) { toast("Google Sheet CUADERNOS 2026 regenerado"); cargarResumen(); }
    else toast("No se pudo regenerar: " + (r && r.error || "sin respuesta"));
  };

  // 🖨 cargo imprimible: bloques por fecha con ENTREGADO/RECIBIDO en blanco (mockup 8.4)
  const imprimirCargo = () => {
    const porFecha = {};
    filtradas.forEach(f => { const k = String(f.fecha_evento || "s/f").slice(0, 10); (porFecha[k] = porFecha[k] || []).push(f); });
    const bloques = Object.keys(porFecha).sort().map(fecha => {
      const rows = porFecha[fecha].map((f, i) =>
        `<tr><td>${i + 1}</td>${sel.cols.map(c => `<td>${valCuaderno(f, c[1]) || ""}</td>`).join("")}</tr>`).join("");
      return `<h3>${sel.titulo}${fecha !== "s/f" ? " — " + fmtF(fecha) : ""}</h3>
        <table><thead><tr><th>N°</th>${sel.cols.map(c => `<th>${c[0]}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table>
        <div class="firmas"><span>ENTREGADO POR: ____________________________</span>
        <span>RECIBIDO POR: ____________________________</span>
        <span>FECHA / HORA: ______________  DNI: ______________</span></div>`;
    }).join("");
    const w = window.open("", "_blank");
    w.document.write(`<html><head><title>Cargo — ${sel.nombre}</title><style>
      body{font-family:Arial,sans-serif;font-size:11px;margin:24px}
      h2{margin:0 0 2px}h3{margin:18px 0 6px}
      table{border-collapse:collapse;width:100%}td,th{border:1px solid #333;padding:3px 5px;text-align:left}
      th{background:#eee}.firmas{display:flex;gap:24px;flex-wrap:wrap;margin:14px 0 4px;font-size:12px}
      @media print{.firmas{page-break-inside:avoid}}</style></head><body>
      <h2>INGENIERIA TELCOM E.I.R.L. · CP-026-2026-ELSE</h2>
      <div>📒 ${sel.nombre} — cargo generado por la plataforma ${new Date().toLocaleString("es-PE")}</div>
      ${bloques}</body></html>`);
    w.document.close(); w.print();
  };

  const guardarEdicion = async form => {
    const r = await registroControl(form);
    if (r && r.ok) {
      toast(form.id ? "Registro actualizado" : "Registro creado");
      setEdit(null);
      loadCuadernoDatos(sel.fuente).then(setFilas);
      cargarResumen();
    } else toast("Error: " + (r && r.error || "sin respuesta"));
  };

  /* ============================== HUB ================================== */
  if (!sel) {
    const porTipo = (resumen && resumen.registros && resumen.registros.porTipo) || {};
    const men = (resumen && resumen.mensual) || { total: 0, porMes: {}, huecos: 0 };
    return <>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <div>
            <h3 style={{ margin: 0 }}>📒 Cuadernos de Control 2026</h3>
            <div className="muted" style={{ fontSize: 12 }}>
              Los mismos formatos de siempre, llenados por el sistema. Clic en una tarjeta = ver/imprimir.
              {resumen && resumen.generado ? " · Sheet actualizado: " + resumen.generado : ""}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {resumen && resumen.sheetUrl &&
              <a className="btn sm" href={resumen.sheetUrl} target="_blank" rel="noreferrer">🔗 Google Sheet</a>}
            {esJefe && <button className="btn sm" disabled={regen} onClick={regenerar}>{regen ? "Regenerando…" : "🔄 Regenerar"}</button>}
          </div>
        </div>
        {!resumen && <div className="note" style={{ marginTop: 10 }}>
          Cargando contadores… (si no aparecen, el backend V2 aún no tiene el módulo Cuadernos desplegado)</div>}
      </Card>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 12, marginTop: 12 }}>
        {CUADERNOS.map(def => {
          const est = def.fuente === "mensual"
            ? { total: men.total, huecos: men.huecos, ultimo: "" }
            : porTipo[def.fuente] || { total: 0, huecos: 0, cruzan: 0, ultimo: "" };
          return <Card key={def.key} className="clk">
            <div style={{ cursor: "pointer" }} onClick={() => abrir(def)}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <b>{def.emoji} {def.nombre}</b>
                {def.fase2 && <Tag bg="#FDEDEE" color="#7f1d1d">➕ etapas</Tag>}
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "var(--titulo,#16294B)", margin: "6px 0 2px" }}>{est.total}</div>
              <div className="muted" style={{ fontSize: 11.5 }}>
                {def.fuente === "mensual"
                  ? Object.keys(men.porMes || {}).sort((a, b) => a - b).map(m => (MESES_NOMBRE[+m] || m).slice(0, 3) + " " + men.porMes[m]).join(" · ")
                  : <>último: {est.ultimo ? fmtF(est.ultimo) : "—"}{"cruzan" in est ? ` · cruzan ${est.cruzan}` : ""}</>}
              </div>
              {est.huecos > 0 && <div style={{ fontSize: 11.5, color: "#B45309", marginTop: 4 }}>⚠ {est.huecos} filas con huecos</div>}
            </div>
          </Card>;
        })}
      </div>
    </>;
  }

  /* ========================= VISTA DE UN CUADERNO ======================= */
  return <>
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button className="btn sm" onClick={() => { setSel(null); setFilas(null); }}>← Cuadernos</button>
          <b>{sel.emoji} {sel.nombre}</b>
          <span className="muted" style={{ fontSize: 11.5 }}>{filas ? filtradas.length + " filas" : "cargando…"}</span>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {opcionesFiltro.length > 0 &&
            <select value={filtro} onChange={e => setFiltro(e.target.value)}>
              <option value="">— todo —</option>
              {opcionesFiltro.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>}
          <input placeholder="🔎 buscar…" value={q} onChange={e => setQ(e.target.value)} style={{ minWidth: 140 }} />
          {sel.fuente !== "mensual" &&
            <button className="btn sm" onClick={() => setEdit({ tipo: sel.fuente, fecha_evento: hoyISO() })}>➕ Registrar</button>}
          {sel.cargo && <button className="btn sm" onClick={imprimirCargo}>🖨 Cargo</button>}
        </div>
      </div>
      <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>{sel.titulo} — clic en una fila abre la Sala del expediente; ✏ edita el registro (queda en bitácora).</div>
    </Card>
    <Card>
      <div style={{ overflowX: "auto" }}>
        <table className="tbl">
          <thead><tr>
            <th>N°</th>
            {sel.semaforoElev && <th>⚠ ELEV</th>}
            {sel.cols.map(c => <th key={c[0]}>{c[0]}</th>)}
            {sel.fuente !== "mensual" && <th></th>}
          </tr></thead>
          <tbody>
            {filas && filtradas.slice(0, tope).map((f, i) => {
              const rec = recDe(f);
              return <tr key={f.id || i} className={rec ? "clk" : ""}
                onClick={() => rec && setSelExp(rec.id)}
                title={rec ? "Abrir la Sala del expediente" : "Caso aún no cargado en la plataforma (2025 / ene-mar 2026)"}>
                <td>{i + 1}</td>
                {sel.semaforoElev && <td>{semaforoElev(f)}</td>}
                {sel.cols.map(c => {
                  const v = valCuaderno(f, c[1]);
                  const esFecha = /^(\d{4})-(\d{2})-(\d{2})/.test(v);
                  return <td key={c[0]} style={!v ? { background: "#FFF8E6" } : undefined}>{esFecha ? fmtF(v) : v}</td>;
                })}
                {sel.fuente !== "mensual" &&
                  <td onClick={e => e.stopPropagation()}>
                    <button className="btn sm" title="Editar registro" onClick={() => setEdit({ ...f })}>✏</button>
                  </td>}
              </tr>;
            })}
            {filas && !filtradas.length && <tr><td colSpan={sel.cols.length + 3} className="muted">Sin filas {filtro ? "para ese período" : "aún"}.</td></tr>}
          </tbody>
        </table>
      </div>
      {filas && filtradas.length > tope &&
        <button className="btn sm" style={{ marginTop: 8 }} onClick={() => setTope(tope + 500)}>Mostrar 500 más ({filtradas.length - tope} restantes)</button>}
      <div className="muted" style={{ fontSize: 10.5, marginTop: 6 }}>
        Celda ámbar = hueco (esa etapa aún no registró el dato — §9.4). Si un dato existe también en la etapa
        (datos_etapa), la vista generada del Google Sheet prefiere el de la etapa (primera fuente, firmada).
      </div>
    </Card>
    {edit && <EditorRegistro fila={edit} def={sel} onCerrar={() => setEdit(null)} onGuardar={guardarEdicion} />}
  </>;
}

/* ===== modal de alta/edición de una fila de registros_control ===== */
const CAMPOS_EDIT = [
  ["fecha_evento", "Fecha del evento", "date"], ["reclamo", "Reclamo (REC… / código)", "text"],
  ["suministro", "Suministro", "text"], ["ruta", "Ruta", "text"],
  ["correlativo", "Correlativo / carta", "text"], ["resolucion", "Resolución", "text"],
  ["f2", "Fecha 2 (según cuaderno)", "text"], ["f3", "Fecha 3 (según cuaderno)", "text"],
  ["f4", "Fecha 4 (según cuaderno)", "text"], ["estado", "Estado", "text"],
  ["observaciones", "Observaciones", "text"],
];

function EditorRegistro({ fila, def, onCerrar, onGuardar }) {
  const [form, setForm] = useState(() => {
    const o = { id: fila.id, tipo: fila.tipo || def.fuente };
    CAMPOS_EDIT.forEach(([k]) => o[k] = fila[k] != null ? String(fila[k]).slice(0, k === "fecha_evento" ? 10 : 200) : "");
    return o;
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  return <div className="modal-bg" onClick={onCerrar} style={{ position: "fixed", inset: 0, background: "rgba(22,41,75,.45)", zIndex: 90, display: "flex", alignItems: "center", justifyContent: "center" }}>
    <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, padding: 18, width: "min(560px,94vw)", maxHeight: "88vh", overflowY: "auto", boxShadow: "0 12px 40px rgba(0,0,0,.25)" }}>
      <h3 style={{ marginTop: 0 }}>{form.id ? "✏ Editar" : "➕ Registrar"} — {def.nombre}</h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {CAMPOS_EDIT.map(([k, label, tipo]) =>
          <label key={k} style={{ fontSize: 11.5, display: "flex", flexDirection: "column", gap: 3, gridColumn: k === "observaciones" ? "1/-1" : undefined }}>
            <span className="muted">{label}</span>
            <input type={tipo} value={form[k]} onChange={e => set(k, e.target.value)} />
          </label>)}
      </div>
      <div className="muted" style={{ fontSize: 10.5, margin: "8px 0" }}>
        El significado de Fecha 2/3/4 depende del cuaderno (p.ej. 1ra Inspección: F2=EJECUTADO, F3=DEVUELTO ·
        Notaría: F2=DEVUELTO, F3=EJECUTADOS). Todo cambio queda firmado en la bitácora.
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button className="btn sm" onClick={onCerrar}>Cancelar</button>
        <button className="btn sm primary" onClick={() => onGuardar(form)}>Guardar</button>
      </div>
    </div>
  </div>;
}
