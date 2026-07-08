import { useState } from "react";
import { Card, Kpi } from "./ui.jsx";
import { TicketCard } from "./Ticket.jsx";
import { TEAM, teamById } from "../lib/model.js";
import { abiertos, vencidos, ordenUrgencia, exposicionTotal, verMontos } from "../lib/tickets.js";
import { USERS } from "../lib/auth.js";

const soles = n => "S/ " + Number(n || 0).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const TOPE = 0.10 * 1250000; // 10% del contrato (referencia)

// ===== Coordinador/Gerente: cola priorizada + asignación de tareas =====
export function AtenderPrimero({ tickets, perfil, recByCode, onEstado, onReasignar, onArchivar, setSelExp }) {
  const [filtro, setFiltro] = useState("todos");   // todos | vencidos | porvencer | enplazo
  const ab = abiertos(tickets);
  const venc = ab.filter(t => t.vencido);
  const porVen = ab.filter(t => !t.vencido && t.diasRestantes != null && t.diasRestantes <= 2);
  const enPlazo = ab.filter(t => !t.vencido && !(t.diasRestantes != null && t.diasRestantes <= 2));
  const grupo = filtro === "vencidos" ? venc : filtro === "porvencer" ? porVen : filtro === "enplazo" ? enPlazo : ab;
  const orden = ordenUrgencia(grupo).slice(0, 60);
  const abrir = t => { const r = recByCode[t.reclamo]; if (r) setSelExp(r.id, t.etapa); };
  const puedeAsignar = perfil.rol === "COORDINADOR" || perfil.rol === "GERENTE";
  const reasignar = (t, id) => { const m = TEAM.find(x => x.id === +id); onReasignar?.(t, +id, m ? m.nombre : "Externo / Call Center"); };
  const chip = (k, txt, n, color) => (
    <button onClick={() => setFiltro(k)} style={{
      border: `1px solid ${filtro === k ? color : "var(--bd)"}`, background: filtro === k ? color : "transparent",
      color: filtro === k ? "#fff" : "var(--tx)", borderRadius: 999, padding: "4px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer",
    }}>{txt} <b>{n}</b></button>
  );
  return (
    <Card>
      <h3 style={{ marginBottom: 4 }}>{puedeAsignar ? "Asignar tareas — " : ""}Cola del equipo</h3>
      <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
        Un caso = una tarea en su etapa actual. Ordenado por urgencia. {puedeAsignar && "Reasigna en el selector de la derecha; "}
        {puedeAsignar && <>🗄 <b>archiva</b> los que ya están cerrados en la vida real (salen de la cola y de las alarmas).</>}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        {chip("todos", "Todos", ab.length, "#1F4E8C")}
        {chip("vencidos", "🔴 Vencidos", venc.length, "#C0392B")}
        {chip("porvencer", "🟡 Por vencer", porVen.length, "#C9821B")}
        {chip("enplazo", "🟢 En plazo", enPlazo.length, "#1E8E5A")}
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {orden.map(t => (
          <div key={t.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ flex: 1, minWidth: 0 }}><TicketCard t={t} rec={recByCode[t.reclamo]} perfil={perfil} onEstado={onEstado} onAbrir={abrir} /></div>
            {puedeAsignar && (
              <select value={t.respId} onChange={e => reasignar(t, e.target.value)} title="Reasignar responsable"
                style={{ background: "var(--card2)", color: "var(--tx)", border: `1px solid ${TEAM.find(x => x.id === t.respId)?.color || "var(--bd)"}`, borderRadius: 8, padding: "6px 8px", fontSize: 12, minWidth: 175 }}>
                {TEAM.map(m => <option key={m.id} value={m.id}>{m.corto} · {m.rol}</option>)}
                <option value={0}>Externo / Call Center</option>
              </select>
            )}
            {puedeAsignar && onArchivar && (
              <button title="Archivar: cerrar el caso y sacarlo de la cola/alarmas (ya está cerrado en la vida real)"
                onClick={() => onArchivar(t)}
                style={{ border: "1px solid var(--bd)", background: "transparent", color: "var(--mut)", borderRadius: 8, padding: "6px 9px", fontSize: 13, cursor: "pointer", flexShrink: 0 }}>🗄</button>
            )}
          </div>
        ))}
        {!orden.length && <div className="muted">Sin casos en «{filtro === "todos" ? "la cola" : filtro}». 🎉</div>}
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
          <div style={{ fontWeight: 700, color: "var(--linkTx)", fontSize: 13, marginBottom: 4 }}>{u} <span className="muted" style={{ fontWeight: 400 }}>· {list.length} acción(es)</span></div>
          {list.slice(0, 12).map((r, i) => {
            const d = det(r);
            return <div key={i} className="chk" style={{ fontSize: 12 }}><span style={{ color: "#15803D" }}>•</span> {accion(r)}{r.reclamo ? ` · ${String(r.reclamo).slice(-6)}` : ""}{d.etapa ? ` · ${d.etapa}` : ""}{d.estado ? ` → ${d.estado}` : ""}</div>;
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
                <td style={{ color: o.venc ? "#C0392B" : "var(--mut)", fontWeight: o.venc ? 700 : 400 }}>{o.venc}</td>
                <td>{o.riesgo ? <span style={{ color: "#B45309" }}>⚠ {o.riesgo}</span> : "—"}</td>
                {ger && <td style={{ color: o.exp ? "#DC2626" : "var(--mut)", fontWeight: o.exp ? 700 : 400 }}>{o.exp ? soles(o.exp) : "—"}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!ger && <div className="note" style={{ marginTop: 10, background: "var(--hoverBg)", border: "1px solid #1F4E8C", color: "var(--tx)", fontSize: 12 }}>Los importes en S/ de exposición los gestiona Gerencia.</div>}
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
                <td style={{ fontWeight: 700, color: "#DC2626" }}>{soles(t.exposicion)}</td>
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

// ===== Coordinador/Gerente: Verificación diaria del admin (plantilla 80_Reportes_Diarios) =====
// Etapas donde un ticket vencido/por vencer expone al contrato a que JARU declare
// silencio administrativo positivo si no se atiende a tiempo (penalidad 5.5: S/300 + el
// monto del reclamo). Son las etapas de plazo legal "duro" hacia el usuario/JARU.
const ETAPAS_SILENCIO = ["Resolución", "Notificación", "Apelación (JARU)"];

// Mapa usuario (login, p.ej. "jcondori") -> resp_id del TEAM (model.js).
// Criterio: USERS (lib/auth.js) YA trae resp_id = TEAM.id para cada login — es el mismo id
// sembrado a mano en ambos archivos, así que es el mapeo más confiable disponible (no hace
// falta derivarlo del nombre). Si en el futuro un usuario de USERS no calza con ningún id de
// TEAM (resp_id 0 = Gerencia, que no está en TEAM), simplemente no suma actividad a ninguna fila.
const USUARIO_A_RESP = USERS.reduce((m, u) => { m[u.usuario] = u.resp_id; return m; }, {});

export function VerificacionDiaria({ tickets = [], registros = [], perfil }) {
  const hoy = new Date().toISOString().slice(0, 10);
  const hoyLegible = new Date().toLocaleDateString("es-PE", { day: "2-digit", month: "long", year: "numeric" });

  // ---- Banner SAP: abiertos + vencidos en etapas de plazo legal (riesgo de silencio positivo) ----
  const enRiesgoSAP = vencidos(tickets).filter(t => ETAPAS_SILENCIO.includes(t.etapa));
  const ordenSAP = ordenUrgencia(enRiesgoSAP);

  // ---- Actividad de hoy por usuario (bitácora `registros`) ----
  const deHoy = (registros || []).filter(r => String(r.fecha || "").slice(0, 10) === hoy);
  const actividadPorResp = {};
  deHoy.forEach(r => {
    const respId = USUARIO_A_RESP[String(r.usuario || "").trim().toLowerCase()];
    if (respId != null) actividadPorResp[respId] = (actividadPorResp[respId] || 0) + 1;
  });

  // ---- Fila nominal por trabajador (los 8 del TEAM) ----
  const filas = TEAM.map(m => {
    const ts = tickets.filter(t => t.respId === m.id);
    const ab = abiertos(ts);
    const venc = ab.filter(t => t.vencido).length;
    const porVenc = ab.filter(t => !t.vencido && t.diasRestantes != null && t.diasRestantes <= 2).length;
    // etapas de plazo legal duro (riesgo SAP/notarial) — distinguen la urgencia REAL del
    // volumen: 200 casos "en Campo" no pesan igual que 5 en Resolución/Notificación/Apelación
    const criticos = ab.filter(t => ETAPAS_SILENCIO.includes(t.etapa)).length;
    const actividadHoy = actividadPorResp[m.id] || 0;
    let semaforo = "verde";
    if (venc > 0) semaforo = "rojo";
    else if (porVenc > 0 || (ab.length > 0 && actividadHoy === 0)) semaforo = "ambar";
    return { m, enCurso: ab.length, venc, porVenc, criticos, actividadHoy, semaforo };
  });

  const semIcon = { verde: "✓", ambar: "⚠", rojo: "✗" };
  const semColor = { verde: "#16A34A", ambar: "#D97706", rojo: "#DC2626" };

  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
        <div>
          <h3 style={{ margin: 0 }}>🛡 Verificación diaria — {hoyLegible}</h3>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Control nominal del equipo (plantilla 80_Reportes_Diarios). Meta: 0 expedientes en riesgo de silencio positivo.</div>
        </div>
      </div>

      {/* Banner SAP */}
      {ordenSAP.length === 0 ? (
        <div className="note" style={{ marginTop: 14, background: "#EAF7EE", border: "1px solid #16A34A", color: "#15803D", fontWeight: 700, fontSize: 13 }}>
          0 expedientes en riesgo de silencio positivo ✓ (meta cumplida)
        </div>
      ) : (
        <div className="note" style={{ marginTop: 14, background: "#FDECEC", border: "2px solid #DC2626", color: "#991B1B", padding: 14 }}>
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 8 }}>
            ⚠ {ordenSAP.length} EXPEDIENTE{ordenSAP.length > 1 ? "S" : ""} EN RIESGO DE SILENCIO POSITIVO — penalidad 5.5: S/300 + el monto del reclamo cada uno
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="tbl">
              <thead><tr><th>Código</th><th>Etapa</th><th>Responsable</th><th>Días vencido</th></tr></thead>
              <tbody>
                {ordenSAP.map(t => (
                  <tr key={t.id}>
                    <td className="mono">…{String(t.reclamo).slice(-6)}</td>
                    <td>{t.etapa}</td>
                    <td>{t.responsable || teamById(t.respId).nombre}</td>
                    <td style={{ color: "#DC2626", fontWeight: 700 }}>{Math.abs(t.diasRestantes ?? 0)}d</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tabla nominal del equipo */}
      <div style={{ overflowX: "auto", marginTop: 16 }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Trabajador</th><th>En curso</th><th title="Tickets abiertos en Resolución / Notificación / Apelación — plazo legal duro (riesgo SAP 5.5 / notarial 5.12)">🚨 En etapa crítica</th><th>Vencidos</th><th>Por vencer ≤2d</th><th>Actividad hoy</th><th>Semáforo</th>
            </tr>
          </thead>
          <tbody>
            {filas.map(f => (
              <tr key={f.m.id}>
                <td><span className="dot" style={{ background: f.m.color }} />{f.m.nombre} <span className="muted" style={{ fontSize: 11 }}>· {f.m.rol}</span></td>
                <td>{f.enCurso}</td>
                <td style={{ color: f.criticos ? "#B91C1C" : "var(--mut)", fontWeight: f.criticos ? 700 : 400 }}>{f.criticos}</td>
                <td style={{ color: f.venc ? "#DC2626" : "var(--mut)", fontWeight: f.venc ? 700 : 400 }}>{f.venc}</td>
                <td style={{ color: f.porVenc ? "#D97706" : "var(--mut)", fontWeight: f.porVenc ? 700 : 400 }}>{f.porVenc}</td>
                <td>{f.actividadHoy}</td>
                <td style={{ color: semColor[f.semaforo], fontWeight: 700, fontSize: 14 }}>{semIcon[f.semaforo]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>
        Actividad hoy = registros de la bitácora del día cuyo usuario de login mapea al resp_id del trabajador (USERS en lib/auth.js). Semáforo: ✓ verde sin vencidos (con actividad o sin tickets) · ⚠ ámbar con casos por vencer o sin actividad hoy teniendo tickets en curso · ✗ rojo con vencidos.
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--bd)" }}>
        <div className="muted" style={{ fontSize: 11.5 }}>Los indicadores se calculan en vivo de tickets y bitácora — la verificación firmada se imprime desde aquí.</div>
        <button className="btn" onClick={() => window.print()}>🖨 Imprimir verificación</button>
      </div>
    </Card>
  );
}
