import { useEffect, useState } from "react";
import { Card, Kpi, textOn, TOKENS } from "./ui.jsx";
import { TicketCard } from "./Ticket.jsx";
import { TEAM, teamById, ETAPAS, CRITICAS } from "../lib/model.js";
import { abiertos, vencidos, ordenUrgencia, exposicionTotal, verMontos } from "../lib/tickets.js";
import { USERS } from "../lib/auth.js";

const soles = n => "S/ " + Number(n || 0).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const TOPE = 0.10 * 1250000; // 10% del contrato (referencia)

// Vistas guardadas de la cola (F3 §5): trabajador/etapa/chip de urgencia/búsqueda persisten en
// localStorage — al volver a entrar el Coordinador ve el mismo recorte. Cero red, solo UI.
const COLA_FILTROS_KEY = "cola_filtros_v1";
function leerFiltrosGuardados() {
  try { const raw = localStorage.getItem(COLA_FILTROS_KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
}

// ===== Coordinador/Gerente: cola priorizada + asignación de tareas =====
export function AtenderPrimero({ tickets, perfil, recByCode, onEstado, onReasignar, onArchivar, setSelExp }) {
  const [filtro, setFiltro] = useState(() => leerFiltrosGuardados()?.filtro || "todos");   // urgencia: todos | vencidos | porvencer | enplazo
  const [resp, setResp] = useState(() => leerFiltrosGuardados()?.resp || "todos");         // por trabajador (respId) — clave para Gerencia
  const [etapaF, setEtapaF] = useState(() => leerFiltrosGuardados()?.etapaF || "todas");   // por etapa del flujo
  const [q, setQ] = useState(() => leerFiltrosGuardados()?.q || "");                       // búsqueda libre
  useEffect(() => {
    try { localStorage.setItem(COLA_FILTROS_KEY, JSON.stringify({ filtro, resp, etapaF, q })); } catch (e) {}
  }, [filtro, resp, etapaF, q]);
  const limpiarFiltros = () => {
    setResp("todos"); setEtapaF("todas"); setQ(""); setFiltro("todos");
    try { localStorage.removeItem(COLA_FILTROS_KEY); } catch (e) {}
  };
  const ab = abiertos(tickets);

  // Filtros TRANSVERSALES (trabajador · etapa · búsqueda): definen la POBLACIÓN antes de los chips
  // de urgencia, para que los conteos 🔴🟡🟢 reflejen al trabajador/etapa elegidos.
  const norm = s => String(s || "").toUpperCase();
  let base = ab;
  if (resp !== "todos") base = base.filter(t => String(t.respId) === String(resp));
  if (etapaF !== "todas") base = base.filter(t => t.etapa === etapaF);
  if (q.trim()) { const Q = norm(q); base = base.filter(t => { const r = recByCode[t.reclamo] || {}; return norm((r.osinerg || "") + " " + (r.suministro || "") + " " + (r.solicitante || "") + " " + t.reclamo + " " + t.etapa).includes(Q); }); }

  const venc = base.filter(t => t.vencido);
  const porVen = base.filter(t => !t.vencido && t.diasRestantes != null && t.diasRestantes <= 2);
  const enPlazo = base.filter(t => !t.vencido && !(t.diasRestantes != null && t.diasRestantes <= 2));
  const grupo = filtro === "vencidos" ? venc : filtro === "porvencer" ? porVen : filtro === "enplazo" ? enPlazo : base;
  const orden = ordenUrgencia(grupo).slice(0, 60);
  const abrir = t => { const r = recByCode[t.reclamo]; if (r) setSelExp(r.id, t.etapa); };
  const puedeAsignar = perfil.rol === "COORDINADOR" || perfil.rol === "GERENTE";
  const reasignar = (t, id) => { const m = TEAM.find(x => x.id === +id); onReasignar?.(t, +id, m ? m.nombre : "Externo / Call Center"); };

  // opciones de los selectores, solo con lo que existe en la cola (con conteo)
  const respIds = [...new Set(ab.map(t => t.respId))];
  const respOpts = TEAM.filter(m => respIds.includes(m.id)).map(m => ({ id: m.id, txt: m.corto + " · " + m.rol, n: ab.filter(t => t.respId === m.id).length }));
  const hayExterno = respIds.includes(0);
  const etapasPresentes = ETAPAS.filter(e => ab.some(t => t.etapa === e)).map(e => ({ e, n: ab.filter(t => t.etapa === e).length }));
  const hayFiltroTransversal = resp !== "todos" || etapaF !== "todas" || q.trim();

  const chip = (k, txt, n, color) => (
    <button onClick={() => setFiltro(k)} style={{
      border: `1px solid ${filtro === k ? color : "var(--bd)"}`, background: filtro === k ? color : "transparent",
      color: filtro === k ? textOn(color) : "var(--tx)", borderRadius: 999, padding: "4px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", minHeight: 30,
    }}>{txt} <b className="mono">{n}</b></button>
  );
  const selSty = { background: "var(--card2)", color: "var(--tx)", border: "1px solid var(--bd)", borderRadius: 8, padding: "6px 9px", fontSize: 12.5 };
  return (
    <Card>
      <h3 style={{ marginBottom: 4 }}>{puedeAsignar ? "Asignar tareas — " : ""}Cola del equipo</h3>
      <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
        Un caso = una tarea en su etapa actual. Ordenado por urgencia. {puedeAsignar && "Reasigna o "}
        {puedeAsignar && <>🗄 <b>archiva</b> desde el menú «⋯» de cada fila (los cerrados en la vida real salen de la cola y de las alarmas).</>}
      </div>
      {/* Filtros del jefe: por TRABAJADOR · por ETAPA · búsqueda. Los chips de urgencia se recalculan al subconjunto. */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
        <select value={resp} onChange={e => setResp(e.target.value)} style={selSty} title="Filtrar la cola por trabajador">
          <option value="todos">👥 Todo el equipo</option>
          {respOpts.map(o => <option key={o.id} value={o.id}>{o.txt} ({o.n})</option>)}
          {hayExterno && <option value="0">Externo / Call Center ({ab.filter(t => t.respId === 0).length})</option>}
        </select>
        <select value={etapaF} onChange={e => setEtapaF(e.target.value)} style={selSty} title="Filtrar la cola por etapa del flujo">
          <option value="todas">📑 Todas las etapas</option>
          {etapasPresentes.map(o => <option key={o.e} value={o.e}>{o.e} ({o.n})</option>)}
        </select>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="🔎 OSINERG · suministro · nombre" style={{ ...selSty, minWidth: 210, flex: "1 1 210px" }} />
        {hayFiltroTransversal && <button onClick={limpiarFiltros} style={{ ...selSty, cursor: "pointer", fontWeight: 600 }}>✕ Limpiar</button>}
      </div>
      {hayFiltroTransversal && <div className="muted" style={{ fontSize: 11.5, marginBottom: 8 }}>
        Mostrando <b>{base.length}</b> caso(s){resp !== "todos" ? " de " + (TEAM.find(m => String(m.id) === String(resp))?.nombre || (resp === "0" ? "Externo" : "")) : ""}{etapaF !== "todas" ? " en «" + etapaF + "»" : ""}{q.trim() ? " que coinciden con «" + q.trim() + "»" : ""}.
      </div>}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        {chip("todos", "Todos", base.length, TOKENS.acc)}
        {chip("vencidos", "Vencidos", venc.length, TOKENS.red)}
        {chip("porvencer", "Por vencer", porVen.length, TOKENS.amber)}
        {chip("enplazo", "En plazo", enPlazo.length, TOKENS.green)}
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {/* Acciones secundarias (estado/reasignar/archivar) viven en el menú "⋯" de cada fila —
            mismos handlers de siempre (onEstado, reasignar→onReasignar, onArchivar), solo cambió
            dónde viven los controles (antes: select+botón repetidos por fila). */}
        {orden.map(t => (
          <TicketCard key={t.id} t={t} rec={recByCode[t.reclamo]} perfil={perfil} onEstado={onEstado} onAbrir={abrir}
            onReasignar={puedeAsignar ? reasignar : undefined}
            teamOptions={puedeAsignar ? TEAM : undefined}
            onArchivar={puedeAsignar ? onArchivar : undefined} />
        ))}
        {!orden.length && (
          <div className="muted" style={{ padding: 12 }}>
            {filtro === "vencidos" ? "No tienes tareas vencidas ahora mismo. 🎉" :
              filtro === "porvencer" ? "No hay tareas por vencer (≤2 días). 🎉" :
              filtro === "enplazo" ? "No hay tareas en plazo con este filtro." :
              "Sin casos en la cola con este filtro."}
            {hayFiltroTransversal && <> · <a onClick={() => { setResp("todos"); setEtapaF("todas"); setQ(""); }} style={{ color: "var(--linkTx)", cursor: "pointer" }}>✕ Limpiar filtros</a></>}
          </div>
        )}
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
    <div className="kpigrid">
      <Kpi label="Tickets actualizados" value={cuenta("ticket") + cuenta("estado")} sub="hoy" />
      <Kpi label="Evidencias subidas" value={cuenta("evidencia")} sub="hoy" />
      <Kpi label="Documentos generados" value={cuenta("documento")} sub="hoy" />
      <Kpi label="Observaciones" value={cuenta("comentario")} sub="hoy" />
    </div>
    <Card style={{ marginTop: 14 }}>
      <h3>Resumen del día — {hoy} ({deHoy.length} acciones)</h3>
      {Object.keys(byUser).length ? Object.entries(byUser).map(([u, list]) => (
        <div key={u} style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 700, color: "var(--linkTx)", fontSize: 13, marginBottom: 4 }}>{u} <span className="muted" style={{ fontWeight: 400 }}>· {list.length} acción(es)</span></div>
          {list.slice(0, 12).map((r, i) => {
            const d = det(r);
            return <div key={i} className="chk" style={{ fontSize: 12 }}><span style={{ color: "var(--green)" }}>•</span> {accion(r)}{r.reclamo ? ` · ${String(r.reclamo).slice(-6)}` : ""}{d.etapa ? ` · ${d.etapa}` : ""}{d.estado ? ` → ${d.estado}` : ""}</div>;
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
                <td className="mono">{o.total}</td><td className="mono">{o.ab}</td>
                <td className="mono" style={{ color: o.venc ? "var(--red)" : "var(--mut)", fontWeight: o.venc ? 700 : 400 }}>{o.venc}</td>
                <td>{o.riesgo ? <span style={{ color: "var(--amber)" }}>⚠ {o.riesgo}</span> : "—"}</td>
                {ger && <td className="mono" style={{ color: o.exp ? "var(--red)" : "var(--mut)", fontWeight: o.exp ? 700 : 400 }}>{o.exp ? soles(o.exp) : "—"}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!ger && <div className="note st-acc" style={{ marginTop: 10, fontSize: 12 }}>Los importes en S/ de exposición los gestiona Gerencia.</div>}
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
    <div className="kpigrid">
      <Kpi label="Dinero en riesgo hoy" value={soles(total)} sub={`${pct.toFixed(1)}% del tope`} s={pct > 7 ? "rojo" : pct > 4 ? "ambar" : null} />
      <Kpi label="Tope de penalidades" value={soles(TOPE)} sub="10% del contrato → ELSE puede resolver" />
      <Kpi label="Tickets en riesgo" value={ries.length} sub="vencidos con penalidad" s={ries.length ? "rojo" : null} />
    </div>
    <Card style={{ marginTop: 14 }}>
      <h3>Exposición por ticket (mayor a menor)</h3>
      <div style={{ overflowX: "auto" }}>
        <table className="tbl">
          <thead><tr><th>Reclamo</th><th>Suministro</th><th>Etapa</th><th>Responsable</th><th>Penalidad</th><th>Vence</th><th>Exposición</th><th></th></tr></thead>
          <tbody>
            {ries.map(t => (
              <tr key={t.id}>
                <td className="mono">{recByCode[t.reclamo]?.osinerg || t.reclamo}</td>
                <td className="mono">{recByCode[t.reclamo]?.suministro || "—"}</td>
                <td>{t.etapa}</td><td>{t.responsable}</td>
                <td>{t.penalidadItem}</td>
                <td className="mono" style={{ color: "var(--red)" }}>{t.fechaLimite}</td>
                <td className="mono" style={{ fontWeight: 700, color: "var(--red)" }}>{soles(t.exposicion)}</td>
                <td><button className="btn sm" onClick={() => abrir(t)}>ver</button></td>
              </tr>
            ))}
            {!ries.length && <tr><td colSpan={7} className="muted" style={{ textAlign: "center", padding: 14 }}>Sin exposición en riesgo.</td></tr>}
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
// (dedup: usa CRITICAS de lib/model.js — sincronizada con Dominio.ETAPAS_CRITICAS del backend)
const ETAPAS_SILENCIO = CRITICAS;

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
  const semColor = { verde: "var(--green)", ambar: "var(--amber)", rojo: "var(--red)" };

  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
        <div>
          <h3 style={{ margin: 0 }}>🛡 Verificación diaria — {hoyLegible}</h3>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Control nominal del equipo (plantilla 80_Reportes_Diarios). Meta: 0 expedientes en riesgo de silencio positivo.</div>
        </div>
      </div>

      {/* Banner SAP — riesgo REAL de silencio positivo: aquí el rojo está ganado. */}
      {ordenSAP.length === 0 ? (
        <div className="note st-green" style={{ marginTop: 14, fontWeight: 700, fontSize: 13 }}>
          0 expedientes en riesgo de silencio positivo (meta cumplida)
        </div>
      ) : (
        <div className="note st-red" style={{ marginTop: 14, borderWidth: 2, padding: 14 }}>
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 8 }}>
            ⚠ {ordenSAP.length} EXPEDIENTE{ordenSAP.length > 1 ? "S" : ""} EN RIESGO DE SILENCIO POSITIVO — penalidad 5.5: S/300 + el monto del reclamo cada uno
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="tbl">
              <thead><tr><th>Código</th><th>Suministro</th><th>Etapa</th><th>Responsable</th><th>Días vencido</th></tr></thead>
              <tbody>
                {ordenSAP.map(t => (
                  <tr key={t.id}>
                    <td className="mono">{recByCode[t.reclamo]?.osinerg || t.reclamo}</td>
                    <td className="mono">{recByCode[t.reclamo]?.suministro || "—"}</td>
                    <td>{t.etapa}</td>
                    <td>{t.responsable || teamById(t.respId).nombre}</td>
                    <td className="mono" style={{ color: "var(--tint-red-tx)", fontWeight: 700 }}>{Math.abs(t.diasRestantes ?? 0)}d</td>
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
                <td className="mono">{f.enCurso}</td>
                <td className="mono" style={{ color: f.criticos ? "var(--red)" : "var(--mut)", fontWeight: f.criticos ? 700 : 400 }}>{f.criticos}</td>
                <td className="mono" style={{ color: f.venc ? "var(--red)" : "var(--mut)", fontWeight: f.venc ? 700 : 400 }}>{f.venc}</td>
                <td className="mono" style={{ color: f.porVenc ? "var(--amber)" : "var(--mut)", fontWeight: f.porVenc ? 700 : 400 }}>{f.porVenc}</td>
                <td className="mono">{f.actividadHoy}</td>
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
