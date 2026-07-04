import { Card, Kpi } from "./ui.jsx";
import { TicketCard } from "./Ticket.jsx";
import { TEAM, teamById } from "../lib/model.js";
import { abiertos, vencidos, ordenUrgencia, exposicionTotal, verMontos } from "../lib/tickets.js";

const soles = n => "S/ " + Number(n || 0).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const TOPE = 0.10 * 1250000; // 10% del contrato (referencia)

// ===== Coordinador/Gerente: cola priorizada + asignación de tareas =====
export function AtenderPrimero({ tickets, perfil, recByCode, onEstado, onReasignar, setSelExp }) {
  const ab = abiertos(tickets);
  const orden = ordenUrgencia(ab).slice(0, 50);
  const abrir = t => { const r = recByCode[t.reclamo]; if (r) setSelExp(r.id, t.etapa); };
  const puedeAsignar = perfil.rol === "COORDINADOR" || perfil.rol === "GERENTE";
  const reasignar = (t, id) => { const m = TEAM.find(x => x.id === +id); onReasignar?.(t, +id, m ? m.nombre : "Externo / Call Center"); };
  return (
    <Card>
      <h3>{puedeAsignar ? "Asignar tareas — " : ""}Cola del equipo ({ab.length} caso(s) en curso, {vencidos(tickets).length} vencido(s))</h3>
      <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>Un caso = un ticket en su etapa actual; al marcarse hecho pasa solo a la siguiente. Ordenado por urgencia de plazo (días hábiles) y exposición. {puedeAsignar && "Cambia el responsable en el selector de la derecha para reasignar."}</div>
      <div style={{ display: "grid", gap: 8 }}>
        {orden.map(t => (
          <div key={t.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ flex: 1, minWidth: 0 }}><TicketCard t={t} rec={recByCode[t.reclamo]} perfil={perfil} onEstado={onEstado} onAbrir={abrir} /></div>
            {puedeAsignar && (
              <select value={t.respId} onChange={e => reasignar(t, e.target.value)} title="Reasignar responsable"
                style={{ background: "#0e1726", color: "#e2e8f0", border: `1px solid ${TEAM.find(x => x.id === t.respId)?.color || "#334155"}`, borderRadius: 8, padding: "6px 8px", fontSize: 12, minWidth: 190 }}>
                {TEAM.map(m => <option key={m.id} value={m.id}>{m.corto} · {m.rol}</option>)}
                <option value={0}>Externo / Call Center</option>
              </select>
            )}
          </div>
        ))}
        {!orden.length && <div className="muted">Sin tickets abiertos en el equipo. 🎉</div>}
      </div>
    </Card>
  );
}

// ===== Gerente: resumen de la actividad de HOY (reportado por el equipo) =====
export function ResumenDiario({ registros = [], tickets = [] }) {
  const hoy = new Date().toISOString().slice(0, 10);
  const deHoy = (registros || []).filter(r => String(r.fecha || "").slice(0, 10) === hoy);
  const cuenta = tipo => deHoy.filter(r => r.tipo === tipo).length;
  const byUser = {};
  deHoy.forEach(r => { (byUser[r.usuario] = byUser[r.usuario] || []).push(r); });
  const det = r => { try { const d = typeof r.detalle === "string" ? JSON.parse(r.detalle) : (r.detalle || {}); return d; } catch (e) { return {}; } };
  const accion = r => ({ ticket: "actualizó ticket", datos: "registró datos", evidencia: "subió evidencia", documento: "generó documento", comentario: "observación", delegacion: "reasignó", reporte: "cerró su día", estado: "cambió estado" }[r.tipo] || r.tipo);
  return <>
    <div className="grid g4">
      <Kpi label="Tickets actualizados" value={cuenta("ticket") + cuenta("estado")} sub="hoy" s="verde" />
      <Kpi label="Evidencias subidas" value={cuenta("evidencia")} sub="hoy" s="verde" />
      <Kpi label="Documentos generados" value={cuenta("documento")} sub="hoy" s="verde" />
      <Kpi label="Observaciones" value={cuenta("comentario")} sub="hoy" s="verde" />
    </div>
    <Card style={{ marginTop: 14 }}>
      <h3>Resumen del día — {hoy} ({deHoy.length} acciones)</h3>
      {Object.keys(byUser).length ? Object.entries(byUser).map(([u, list]) => (
        <div key={u} style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 700, color: "#93c5fd", fontSize: 13, marginBottom: 4 }}>{u} <span className="muted" style={{ fontWeight: 400 }}>· {list.length} acción(es)</span></div>
          {list.slice(0, 12).map((r, i) => {
            const d = det(r);
            return <div key={i} className="chk" style={{ fontSize: 12 }}><span style={{ color: "#22c55e" }}>•</span> {accion(r)}{r.reclamo ? ` · ${String(r.reclamo).slice(-6)}` : ""}{d.etapa ? ` · ${d.etapa}` : ""}{d.estado ? ` → ${d.estado}` : ""}</div>;
          })}
        </div>
      )) : <div className="muted">Sin actividad registrada hoy ({hoy}). Cuando el equipo trabaje, aquí verás el resumen automático.</div>}
    </Card>
  </>;
}

// ===== Resumen del equipo: carga por trabajador =====
export function ResumenEquipo({ tickets, perfil }) {
  const ger = verMontos(perfil.rol);
  const porResp = TEAM.map(m => {
    const ts = tickets.filter(t => t.respId === m.id);
    const ab = abiertos(ts);
    const v = ab.filter(t => t.vencido);
    const exp = ts.filter(t => t.riesgo).reduce((s, t) => s + (t.exposicion || 0), 0);
    return { m, total: ts.length, ab: ab.length, venc: v.length, riesgo: ts.filter(t => t.riesgo).length, exp };
  }).filter(o => o.total > 0);
  return (
    <Card>
      <h3>Resumen del equipo — casos en la etapa de cada trabajador</h3>
      <div style={{ overflowX: "auto" }}>
        <table className="tbl">
          <thead><tr><th>Trabajador</th><th>Casos</th><th>Abiertos</th><th>Vencidos</th><th>En riesgo</th>{ger && <th>Exposición</th>}</tr></thead>
          <tbody>
            {porResp.map(o => (
              <tr key={o.m.id}>
                <td><span className="dot" style={{ background: o.m.color }} />{o.m.nombre} <span className="muted" style={{ fontSize: 11 }}>· {o.m.rol}</span></td>
                <td>{o.total}</td><td>{o.ab}</td>
                <td style={{ color: o.venc ? "#C0392B" : "#94a3b8", fontWeight: o.venc ? 700 : 400 }}>{o.venc}</td>
                <td>{o.riesgo ? <span style={{ color: "#fbbf24" }}>⚠ {o.riesgo}</span> : "—"}</td>
                {ger && <td style={{ color: o.exp ? "#fca5a5" : "#94a3b8", fontWeight: o.exp ? 700 : 400 }}>{o.exp ? soles(o.exp) : "—"}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!ger && <div className="note" style={{ marginTop: 10, background: "rgba(31,78,140,.15)", border: "1px solid #1F4E8C", color: "#cbd5e1", fontSize: 12 }}>Los importes en S/ de exposición los gestiona Gerencia.</div>}
    </Card>
  );
}

// ===== Gerente: "Dinero en riesgo hoy" =====
export function DineroRiesgo({ tickets, perfil, recByCode, setSelExp }) {
  const ries = ordenUrgencia(tickets.filter(t => t.riesgo));
  const total = exposicionTotal(tickets);
  const pct = total / TOPE * 100;
  const abrir = t => { const r = recByCode[t.reclamo]; if (r) setSelExp(r.id, t.etapa); };
  return <>
    <div className="grid g3">
      <Kpi label="Dinero en riesgo hoy" value={soles(total)} sub={`${pct.toFixed(1)}% del tope`} s={pct > 7 ? "rojo" : pct > 4 ? "ambar" : "verde"} />
      <Kpi label="Tope de penalidades" value={soles(TOPE)} sub="10% del contrato → ELSE puede resolver" s="ambar" />
      <Kpi label="Tickets en riesgo" value={ries.length} sub="vencidos con penalidad" s={ries.length ? "rojo" : "verde"} />
    </div>
    <Card style={{ marginTop: 14 }}>
      <h3>Exposición por ticket (mayor a menor)</h3>
      <div style={{ overflowX: "auto" }}>
        <table className="tbl">
          <thead><tr><th>Reclamo</th><th>Etapa</th><th>Responsable</th><th>Penalidad</th><th>Vence</th><th>Exposición</th><th></th></tr></thead>
          <tbody>
            {ries.map(t => (
              <tr key={t.id}>
                <td className="mono">{recByCode[t.reclamo]?.osinerg || "…" + t.reclamo.slice(-6)}</td>
                <td>{t.etapa}</td><td>{t.responsable}</td>
                <td>{t.penalidadItem}</td>
                <td style={{ color: "#C0392B" }}>{t.fechaLimite}</td>
                <td style={{ fontWeight: 700, color: "#fca5a5" }}>{soles(t.exposicion)}</td>
                <td><button className="btn sm" onClick={() => abrir(t)}>ver</button></td>
              </tr>
            ))}
            {!ries.length && <tr><td colSpan={7} className="muted" style={{ textAlign: "center", padding: 14 }}>Sin exposición en riesgo. 🎉</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>Exposición = penalidad fija + monto del reclamo (en penalidades 5.5/5.9/5.10/5.12). Recalculada por días hábiles.</div>
    </Card>
  </>;
}
