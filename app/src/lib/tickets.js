// ===== Capa de dominio de TICKETS (esquema v2) =====
// Un ticket = (reclamo × etapa). Es la unidad de trabajo de toda la UI.
import { ETAPAS, wName } from "./model.js";

const ORDEN = ETAPAS;  // orden canónico de las 10 etapas

const numOr = (v, d=null) => {
  if (v === "" || v == null) return d;
  const n = Number(v); return Number.isNaN(n) ? d : n;
};
const isoDia = s => String(s || "").slice(0, 10);  // "2026-04-20T..." -> "2026-04-20"

// Normaliza una fila cruda de la hoja `tickets` al modelo de la app.
export function mapTicket(r) {
  const estado = String(r.estado || "pendiente");
  return {
    id: r.ticket_id,
    reclamo: String(r.reclamo || ""),
    etapaNN: r.etapa_nn,
    etapa: r.etapa,
    respId: numOr(r.responsable_id, 0),
    // el nombre VIGENTE del equipo manda sobre el texto grabado en la hoja: tickets antiguos
    // guardaron nombres de personal que ya salió (los resp_id 4/6/7 se conservaron al reemplazar)
    responsable: (numOr(r.responsable_id, 0) ? wName(numOr(r.responsable_id, 0)) : "") || r.responsable || "",
    estado,
    abierto: estado === "pendiente" || estado === "en_proceso",
    hecho: estado === "hecho",
    fechaInicio: isoDia(r.fecha_inicio),
    plazoHabiles: numOr(r.dias_habiles_plazo, null),
    fechaLimite: isoDia(r.fecha_limite),
    diasRestantes: numOr(r.dias_restantes, null),   // días HÁBILES (negativo = vencido)
    vencido: String(r.vencido) === "sí",
    prioridad: r.prioridad || "",
    penalidadItem: r.penalidad_item == null ? "" : String(r.penalidad_item),
    exposicion: numOr(r.exposicion_soles, 0),       // S/ — solo se muestra a Gerencia
    riesgo: String(r.riesgo_penalidad) === "sí",
    carpeta: r.carpeta_drive || "",
    contextoIA: r.contexto_ia || "",
    notas: r.notas || "",
  };
}
export const mapTickets = rows => (rows || []).map(mapTicket);

// ¿Qué tickets ve este perfil? Gerente/Coordinador ven todos; operativos solo los suyos.
export function misTickets(tickets, perfil) {
  if (!perfil) return [];
  if (perfil.rol === "GERENTE" || perfil.rol === "COORDINADOR") return tickets;
  return tickets.filter(t => t.respId === perfil.resp_id);
}

export const abiertos = ts => ts.filter(t => t.abierto);
export const vencidos = ts => ts.filter(t => t.abierto && t.vencido);
export const porVencer = (ts, n=2) => ts.filter(t => t.abierto && !t.vencido && t.diasRestantes != null && t.diasRestantes <= n);

// EL TICKET DEL CASO: cada reclamo tiene UN solo ticket vivo — su etapa actual (la primera
// no terminada en el orden del flujo). Las etapas posteriores existen en la BD (cada una con
// su plazo/penalidad) pero NO son tarea de nadie hasta que el caso llegue a ellas.
// Al marcar "hecho", el ticket del caso "avanza" solo a la siguiente etapa.
export function activos(ts) {
  const by = {};
  ts.forEach(t => { (by[t.reclamo] = by[t.reclamo] || []).push(t); });
  const out = [];
  Object.values(by).forEach(list => {
    const orden = [...list].sort((a, b) => String(a.etapaNN).localeCompare(String(b.etapaNN)));
    const act = orden.find(t => !t.hecho);
    if (act) out.push(act);
  });
  return out;
}

// Color de semáforo por plazo (días hábiles restantes).
export function urgColorTicket(t) {
  if (t.hecho) return "#1E8E5A";
  if (t.vencido) return "#C0392B";
  const d = t.diasRestantes;
  if (d == null) return "#5b6b80";
  if (d <= 1) return "#C0392B";
  if (d <= 2) return "#C9821B";
  return "#1E8E5A";
}
export function urgLabel(t) {
  if (t.hecho) return "hecho";
  if (t.vencido) return `vencido ${Math.abs(t.diasRestantes ?? 0)}d`;
  if (t.diasRestantes == null) return "—";
  return `${t.diasRestantes}d háb.`;
}

// Orden por urgencia: vencidos primero, luego menor días hábiles restantes, luego mayor exposición.
export function ordenUrgencia(ts) {
  return [...ts].sort((a, b) => {
    if (a.vencido !== b.vencido) return a.vencido ? -1 : 1;
    const da = a.diasRestantes ?? 99, db = b.diasRestantes ?? 99;
    if (da !== db) return da - db;
    return (b.exposicion || 0) - (a.exposicion || 0);
  });
}
// La tarea más urgente (mayor riesgo).
export function tareaPrioritaria(ts) {
  const ab = abiertos(ts);
  return ab.length ? ordenUrgencia(ab)[0] : null;
}

// Agrupa tickets por etapa, en el orden canónico del flujo. Devuelve [{etapa, tickets, urgente}].
export function agrupaPorEtapa(ts) {
  const by = {};
  ts.forEach(t => { (by[t.etapa] = by[t.etapa] || []).push(t); });
  return ORDEN.filter(e => by[e]).map(e => {
    const grupo = by[e];
    const urgente = grupo.some(t => t.abierto && (t.vencido || (t.diasRestantes != null && t.diasRestantes <= 2)));
    return { etapa: e, tickets: grupo, urgente, abiertos: grupo.filter(t => t.abierto).length };
  });
}

// Exposición total en riesgo (suma de tickets con riesgo). Solo tiene sentido mostrarla a Gerencia.
export const exposicionTotal = ts => ts.filter(t => t.riesgo).reduce((s, t) => s + (t.exposicion || 0), 0);

// ¿Se le muestran montos S/ a este rol? Gerencia y Coordinación (auditoría: el Coordinador
// gestiona la operación a diario y necesita ver el dinero en riesgo para priorizar).
export const verMontos = rol => rol === "GERENTE" || rol === "COORDINADOR";
