// ⚖ HERENCIA CONTRACTUAL — Reportes → sub-pestaña (visible para GERENTE y COORDINADOR).
// TELCOM tomó el contrato CP-026-2026-ELSE el 01/07/2026 (se importó el histórico completo de
// SIELSE ene→10 jul, ~4,341 casos). Los casos cuyo ticket activo está VENCIDO con fecha límite
// ANTERIOR a ese corte inflan las alarmas de HOY como si fueran responsabilidad de TELCOM.
// Regla del gerente: la herencia NO se presume cerrada (jamás auto-cerrar por antigüedad —
// riesgo penalidad 5.5 si en verdad seguía en trámite), pero SÍ se cruza contra evidencia real
// de los cuadernos importados y se archiva EN LOTE solo lo que tiene esa evidencia.
//
// Toda la red pasa por lib/api.js (loadCuadernoDatos, archivarCaso — ya existían, cero actions
// nuevas). Cruce 100% en cliente con los datos ya cargados por esas dos llamadas.
import { useEffect, useMemo, useRef, useState } from "react";
import { Card, Kpi, toast, SkeletonCard } from "./ui.jsx";
import { loadCuadernoDatos, archivarCaso } from "../lib/api.js";
import { activos } from "../lib/tickets.js";
import { esHerenciaTicket, CORTE_TELCOM, fmtFecha } from "../lib/model.js";
import { CUADERNOS } from "../lib/cuadernosDef.js";

// nombre humano de cada cuaderno, por su `fuente` (mismo espejo que usa Cuadernos.jsx) — para
// mostrar "de qué cuaderno salió" la evidencia sin repetir la lista de 22 libros a mano.
const NOMBRE_FUENTE = { mensual: "Padrón mensual (libros 1-12)" };
CUADERNOS.forEach(c => { NOMBRE_FUENTE[c.fuente] = c.nombre; });

// tipos de registros_control que cuentan como evidencia de que el caso YA fue resuelto por la
// contratista anterior (criterio del gerente: correlativo/resolución asignados, o entrega en el
// cuaderno 20 "Reclamos Cerrados" — el registro de cierre real, no una suposición por antigüedad).
const TIPOS_EVIDENCIA = ["CORRELATIVO", "RESOL_OFICINA", "CERRADO_ENTREGA"];
const HEAD_COMUN = ["N° OSINERG", "Suministro", "Solicitante", "Etapa", "Fecha límite", "Días vencido"];
const norm = v => String(v == null ? "" : v).trim();

// exportarCSV — MISMO patrón que Cuadernos.jsx (BOM + ";" + comillas escapadas + descarga directa).
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
const filaBase = ({ t, rec }) => [rec?.osinerg || t.reclamo, rec?.suministro || "", rec?.solicitante || "", t.etapa, t.fechaLimite || "", Math.abs(t.diasRestantes ?? 0)];

export default function HerenciaPanel({ data = [], tickets = [], perfil, refrescar }) {
  const [cargando, setCargando] = useState(true);
  const [mensual, setMensual] = useState([]);
  const [control, setControl] = useState([]);
  const [archivando, setArchivando] = useState(false);
  const [progreso, setProgreso] = useState({ n: 0, total: 0 });
  const [errores, setErrores] = useState([]);
  const [resumenFinal, setResumenFinal] = useState(null);
  const pausarRef = useRef(false);

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    Promise.all([loadCuadernoDatos("mensual"), loadCuadernoDatos("todos")]).then(([m, t]) => {
      if (!vivo) return;
      setMensual(Array.isArray(m) ? m : []);
      setControl(Array.isArray(t) ? t : []);
      setCargando(false);
    });
    return () => { vivo = false; };
  }, []);

  const esJefe = perfil && (perfil.rol === "GERENTE" || perfil.rol === "COORDINADOR");

  const recByCode = useMemo(() => {
    const m = {}; (data || []).forEach(r => { m[String(r.codigo)] = r; }); return m;
  }, [data]);

  // ---- índice de evidencia: padrón mensual (CORR/RES) ----
  const idxMensual = useMemo(() => {
    const idx = new Map();
    (mensual || []).forEach(row => {
      const valor = norm(row.corr) || norm(row.res);
      if (!valor) return;
      // SOLO llaves que identifican AL RECLAMO (código/OSINERG). El suministro identifica al
      // MEDIDOR: un mismo suministro tiene varios reclamos distintos en el año, y cruzar por él
      // haría heredar la evidencia de OTRO caso → archivado indebido (riesgo pen. 5.5).
      [row.n_solicitud, row.cod_reclamo, row.numero_osinerg].forEach(k => {
        const kk = norm(k);
        if (kk && !idx.has(kk)) idx.set(kk, { valor, fuente: NOMBRE_FUENTE.mensual });
      });
    });
    return idx;
  }, [mensual]);

  // ---- índice de evidencia: registros_control (CORRELATIVO / RESOL_OFICINA / CERRADO_ENTREGA) ----
  const idxControl = useMemo(() => {
    const idx = new Map();
    (control || []).forEach(row => {
      if (!TIPOS_EVIDENCIA.includes(row.tipo)) return;
      const valor = norm(row.correlativo) || norm(row.resolucion) || (row.tipo === "CERRADO_ENTREGA" ? (norm(row.estado) || "cerrado en cuaderno 20") : "");
      if (!valor) return;
      // Igual que el padrón: nunca indexar por suministro (identifica al medidor, no al reclamo).
      [row.reclamo, row.numero_osinerg].forEach(k => {
        const kk = norm(k);
        if (kk && !idx.has(kk)) idx.set(kk, { valor, fuente: NOMBRE_FUENTE[row.tipo] || row.tipo });
      });
    });
    return idx;
  }, [control]);

  // Llaves de cruce EXACTAS al reclamo: n_solicitud/reclamo = CodigoReclamo y
  // numero_osinerg = NumeroOsinerg. El suministro NO participa (ver comentario de los índices):
  // un caso que solo cuadre por suministro cae a "⚠ Sin evidencia" (verificación manual).
  const buscarEvidencia = (t, rec) => {
    const claves = [t.reclamo, rec?.osinerg].map(norm).filter(Boolean);
    for (const k of claves) { const hit = idxMensual.get(k); if (hit) return hit; }
    for (const k of claves) { const hit = idxControl.get(k); if (hit) return hit; }
    return null;
  };

  // ---- universo: ticket activo (1 por caso) + vencido + herencia (fecha_limite < 01/07/2026) ----
  const universo = useMemo(() => activos(tickets).filter(esHerenciaTicket), [tickets]);

  const { conEvidencia, sinEvidencia, yaCerrados } = useMemo(() => {
    const con = [], sin = [], cerr = [];
    universo.forEach(t => {
      const rec = recByCode[String(t.reclamo)];
      const yaCerrado = rec && (rec.estado === "Cerrado" || rec.estadoCom === "CERRADO");
      if (yaCerrado) { cerr.push({ t, rec }); return; }
      const ev = buscarEvidencia(t, rec);
      if (ev) con.push({ t, rec, evidencia: ev }); else sin.push({ t, rec });
    });
    return { conEvidencia: con, sinEvidencia: sin, yaCerrados: cerr };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [universo, recByCode, idxMensual, idxControl]);

  const exportarGrupo = grupo => {
    if (grupo === "con") exportarCSV("herencia_con_evidencia", [...HEAD_COMUN, "Evidencia (RES/CORR)", "Fuente"], conEvidencia.map(o => [...filaBase(o), o.evidencia.valor, o.evidencia.fuente]));
    else if (grupo === "sin") exportarCSV("herencia_sin_evidencia", HEAD_COMUN, sinEvidencia.map(filaBase));
    else exportarCSV("herencia_ya_cerrados", HEAD_COMUN, yaCerrados.map(filaBase));
  };

  // ---- archivado EN LOTE, solo CON evidencia — SECUENCIAL (el backend usa LockService) ----
  const archivarLote = async () => {
    if (!conEvidencia.length || archivando) return;
    setArchivando(true); pausarRef.current = false;
    setErrores([]); setResumenFinal(null);
    setProgreso({ n: 0, total: conEvidencia.length });
    let ok = 0, fail = 0; const errs = [];
    for (let i = 0; i < conEvidencia.length; i++) {
      if (pausarRef.current) break;
      const { t, evidencia } = conEvidencia[i];
      const motivo = `Herencia pre-${fmtFecha(CORTE_TELCOM)} — resuelto por contratista anterior (RES/CORR: ${evidencia.valor} · fuente: ${evidencia.fuente})`;
      try {
        const r = await archivarCaso(t.reclamo, motivo);
        if (r && r.ok !== false) ok++; else { fail++; errs.push({ codigo: t.reclamo, error: (r && r.error) || "sin respuesta" }); }
      } catch (e) { fail++; errs.push({ codigo: t.reclamo, error: String(e) }); }
      setProgreso({ n: i + 1, total: conEvidencia.length });
    }
    setErrores(errs);
    setResumenFinal({ ok, fail, total: conEvidencia.length, pausado: pausarRef.current });
    setArchivando(false);
    toast(`🗄 Archivados ${ok}/${conEvidencia.length}${fail ? ` · ${fail} error(es)` : ""}`);
    refrescar && refrescar();
  };
  const pausar = () => { pausarRef.current = true; };

  if (cargando) return <SkeletonCard rows={5} />;

  return <>
    <Card>
      <h3 style={{ marginTop: 0 }}>⚖ Herencia contractual — casos anteriores al 01/07/2026</h3>
      <div className="muted" style={{ fontSize: 12, lineHeight: 1.6 }}>
        TELCOM tomó el contrato CP-026-2026-ELSE el <b>01/07/2026</b> (se importó el histórico completo de SIELSE, ene→10 jul). Un caso es <b>herencia</b> si su ticket activo está VENCIDO con fecha límite ANTERIOR a ese corte — gestión de la contratista anterior, no de TELCOM.<br />
        <b>Evidencia</b> = el padrón mensual trae CORR/RES, o hay un registro CORRELATIVO / RESOL_OFICINA / CERRADO_ENTREGA (cuaderno 20) en los cuadernos de control. <b>Sin evidencia → se verifica a mano, nunca se archiva en lote</b> (silencio positivo = penalidad 5.5 si en realidad seguía en trámite).
      </div>
    </Card>

    <div className="kpigrid" style={{ marginTop: 14 }}>
      <Kpi label="Herencia vencida" value={universo.length} sub="ticket activo vencido, plazo < 01/07/2026" />
      <Kpi label="✅ Con evidencia" value={conEvidencia.length} sub="archivables en lote" />
      <Kpi label="⚠ Sin evidencia" value={sinEvidencia.length} sub="verificación manual" s={sinEvidencia.length ? "ambar" : null} />
      <Kpi label="Ya cerrados" value={yaCerrados.length} sub="excluidos (ya archivados)" />
    </div>

    <Card style={{ marginTop: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <h3 style={{ margin: 0 }}>✅ Con evidencia ({conEvidencia.length})</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn sm" onClick={() => exportarGrupo("con")} disabled={!conEvidencia.length}>🧮 Excel</button>
          {esJefe && <button className="btn sm primary" onClick={archivarLote} disabled={archivando || !conEvidencia.length}>🗄 Archivar {conEvidencia.length} con evidencia</button>}
        </div>
      </div>
      {archivando && (
        <div style={{ marginTop: 10 }}>
          <div style={{ height: 8, borderRadius: 999, background: "var(--card2)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${progreso.total ? (progreso.n / progreso.total * 100) : 0}%`, background: "var(--acc)", transition: "width .2s" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
            <span className="muted" style={{ fontSize: 11.5 }}>Archivando {progreso.n}/{progreso.total}…</span>
            <button className="btn sm" onClick={pausar}>⏸ Detener</button>
          </div>
        </div>
      )}
      {!archivando && resumenFinal && (
        <div className={"note " + (resumenFinal.fail ? "st-amber" : "st-green")} style={{ fontSize: 12 }}>
          {resumenFinal.pausado ? "Detenido por el usuario. " : ""}Archivados {resumenFinal.ok}/{resumenFinal.total}{resumenFinal.fail ? ` · ${resumenFinal.fail} error(es) (ver abajo)` : " · sin errores"}.
        </div>
      )}
      {errores.length > 0 && (
        <div style={{ marginTop: 8 }}>
          {errores.map((e, i) => <div key={i} style={{ fontSize: 11.5, color: "var(--tint-red-tx)" }}>· {e.codigo}: {e.error}</div>)}
        </div>
      )}
      <div style={{ overflowX: "auto", marginTop: 10 }}>
        <table className="tbl">
          <thead><tr><th>OSINERG</th><th>Suministro</th><th>Solicitante</th><th>Etapa</th><th>Vencido</th><th>Evidencia</th><th>Fuente</th></tr></thead>
          <tbody>
            {conEvidencia.slice(0, 300).map(({ t, rec, evidencia }) => (
              <tr key={t.id}>
                <td className="mono">{rec?.osinerg || t.reclamo}</td><td className="mono">{rec?.suministro || "—"}</td>
                <td>{rec?.solicitante || "—"}</td><td>{t.etapa}</td>
                <td className="mono" style={{ color: "var(--mut)" }}>{Math.abs(t.diasRestantes ?? 0)}d</td>
                <td className="mono">{evidencia.valor}</td><td style={{ fontSize: 11 }}>{evidencia.fuente}</td>
              </tr>
            ))}
            {!conEvidencia.length && <tr><td colSpan={7} className="muted" style={{ textAlign: "center", padding: 14 }}>Sin casos con evidencia por ahora.</td></tr>}
          </tbody>
        </table>
      </div>
      {conEvidencia.length > 300 && <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>Mostrando 300 de {conEvidencia.length} — exporta a Excel para verlos todos.</div>}
    </Card>

    <Card style={{ marginTop: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <h3 style={{ margin: 0 }}>⚠ Sin evidencia — verificación manual ({sinEvidencia.length})</h3>
        <button className="btn sm" onClick={() => exportarGrupo("sin")} disabled={!sinEvidencia.length}>🧮 Excel</button>
      </div>
      <div className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>Estos NO se archivan en lote — verifícalos uno a uno (abre el expediente) antes de archivar a mano.</div>
      <div style={{ overflowX: "auto", marginTop: 10 }}>
        <table className="tbl">
          <thead><tr><th>OSINERG</th><th>Suministro</th><th>Solicitante</th><th>Etapa</th><th>Vencido</th></tr></thead>
          <tbody>
            {sinEvidencia.slice(0, 300).map(({ t, rec }) => (
              <tr key={t.id}>
                <td className="mono">{rec?.osinerg || t.reclamo}</td><td className="mono">{rec?.suministro || "—"}</td>
                <td>{rec?.solicitante || "—"}</td><td>{t.etapa}</td>
                <td className="mono" style={{ color: "var(--tint-amber-tx)" }}>{Math.abs(t.diasRestantes ?? 0)}d</td>
              </tr>
            ))}
            {!sinEvidencia.length && <tr><td colSpan={5} className="muted" style={{ textAlign: "center", padding: 14 }}>Sin pendientes de verificación manual.</td></tr>}
          </tbody>
        </table>
      </div>
      {sinEvidencia.length > 300 && <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>Mostrando 300 de {sinEvidencia.length} — exporta a Excel para verlos todos.</div>}
    </Card>

    <Card style={{ marginTop: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <h3 style={{ margin: 0 }}>🗄 Ya cerrados — excluidos ({yaCerrados.length})</h3>
        <button className="btn sm" onClick={() => exportarGrupo("cerr")} disabled={!yaCerrados.length}>🧮 Excel</button>
      </div>
      <div className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>Ya figuran <b>Cerrados</b> en la cartera — no necesitan archivarse otra vez.</div>
    </Card>
  </>;
}
