import { useState } from "react";
import { urgColorTicket, urgLabel, verMontos } from "../lib/tickets.js";
import { INFO_ETAPA } from "../lib/camposEtapa.js";
import { metaEtapa } from "../lib/model.js";

const ESTADOS = ["pendiente", "en_proceso", "hecho", "observado"];
// Etiquetas humanas para los values internos (el backend/estado sigue viajando en minúscula/snake_case).
const ESTADO_TICKET_LABEL = { pendiente: "Pendiente", en_proceso: "En proceso", hecho: "Hecho", observado: "Observado" };
// "2026-04-10" -> "10/04/2026"
const fmtDia = iso => { const m = String(iso || "").match(/(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : (iso || ""); };

// Píldora de semáforo de plazo (días hábiles restantes).
export function SemaforoPlazo({ t, big = false }) {
  const c = urgColorTicket(t);
  return (
    <span title={`Límite ${t.fechaLimite || "—"}`} style={{
      display: "inline-flex", alignItems: "center", gap: 5, background: c, color: "#08111e",
      borderRadius: 999, padding: big ? "4px 12px" : "2px 9px", fontSize: big ? 13 : 11.5, fontWeight: 700,
    }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#08111e", opacity: .55 }} />
      {urgLabel(t)}
    </span>
  );
}

// Botón ⓘ "según las bases" reutilizable. Muestra qué es la etapa, por qué importa,
// el plazo y la penalidad (el monto S/ SOLO si el rol es Gerencia).
export function InfoBoton({ etapa, rol, t }) {
  const [open, setOpen] = useState(false);
  const info = INFO_ETAPA[etapa];
  if (!info) return null;
  // Plazo concreto de ESTE ticket (fecha límite + días hábiles), si lo tenemos.
  const concreto = t && t.fechaLimite
    ? { txt: `vence ${fmtDia(t.fechaLimite)} · ${t.vencido ? `vencido ${Math.abs(t.diasRestantes ?? 0)}d` : (t.diasRestantes != null ? `faltan ${t.diasRestantes} día(s) háb.` : "abierto")}`,
        color: t.vencido ? "#DC2626" : (t.diasRestantes != null && t.diasRestantes <= 2 ? "#B45309" : "#15803D") }
    : null;
  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      <button onClick={() => setOpen(o => !o)} title="¿Qué es esta etapa según las bases?" style={{
        width: 22, height: 22, borderRadius: "50%", border: "1px solid #2b6fc0",
        background: open ? "#1F4E8C" : "transparent", color: open ? "#fff" : "var(--linkTx)",
        fontWeight: 700, fontStyle: "italic", fontFamily: "Georgia,serif", cursor: "pointer", lineHeight: 1,
      }}>i</button>
      {open && (
        <div style={{
          position: "absolute", zIndex: 30, top: 26, left: 0, width: 320, background: "#fff",
          border: "1px solid #1F4E8C", borderRadius: 10, padding: 12, boxShadow: "0 10px 30px rgba(22,41,75,.2)",
          color: "var(--tx)", fontSize: 12,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, gap: 8 }}>
            <div style={{ fontWeight: 700, color: "var(--linkTx)" }}>«{etapa}» — según las bases (269-2014)</div>
            <button onClick={() => setOpen(false)} style={{
              border: "1px solid var(--bd)", borderRadius: 6, background: "transparent", color: "var(--mut)",
              cursor: "pointer", fontSize: 11, padding: "2px 7px", flexShrink: 0,
            }}>✕ cerrar</button>
          </div>
          <Kv b="Qué es" v={info.que_es} />
          <Kv b="Por qué importa" v={info.importa} />
          <div style={{ display: "flex", gap: 6, margin: "3px 0" }}>
            <b style={{ color: "var(--mut)", minWidth: 86, fontWeight: 600 }}>Qué se hace</b>
            <span>{(metaEtapa(etapa)?.pasos || []).map((p, i) => <span key={i} style={{ display: "block", color: "var(--tx)" }}>• {p}</span>)}</span>
          </div>
          <Kv b="Documento" v={(metaEtapa(etapa)?.evi || []).join(" · ") || "—"} />
          <Kv b="Plazo" v={info.plazo} />
          {concreto && <Kv b="En este caso" v={concreto.txt} color={concreto.color} />}
          <Kv b="Penalidad" v={info.pen + (verMontos(rol) && info.penMonto ? "  ·  " + info.penMonto : "")}
            color={info.pen === "—" ? "var(--mut)" : "#DC2626"} />
          {!verMontos(rol) && info.pen !== "—" && <div style={{ color: "var(--mut)", fontSize: 10.5, marginTop: 4 }}>El importe en S/ lo gestiona Gerencia.</div>}
        </div>
      )}
    </span>
  );
}
const Kv = ({ b, v, color }) => (
  <div style={{ display: "flex", gap: 6, margin: "3px 0" }}>
    <b style={{ color: "var(--mut)", minWidth: 86, fontWeight: 600 }}>{b}</b>
    <span style={{ color: color || "var(--tx)" }}>{v}</span>
  </div>
);

// Tarjeta de un ticket: etapa · reclamo · semáforo · penalidad · acción de estado.
export function TicketCard({ t, rec, perfil, onEstado, onAbrir }) {
  const rol = perfil?.rol;
  const propio = t.respId === perfil?.resp_id;
  const puedeEditar = propio || rol === "GERENTE" || rol === "COORDINADOR";
  const verResp = rol === "GERENTE" || rol === "COORDINADOR";
  const c = urgColorTicket(t);
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10,
      background: "var(--card2)", border: "1px solid var(--bd)", borderLeft: `4px solid ${c}`,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <b style={{ color: "var(--titulo)", fontSize: 13 }}>{t.etapa}</b>
          <InfoBoton etapa={t.etapa} rol={rol} t={t} />
          {onAbrir && <a onClick={() => onAbrir(t)} title="Abrir el expediente en esta etapa" style={{ color: "var(--linkTx)", fontSize: 11, cursor: "pointer" }}>abrir y trabajar ↗</a>}
        </div>
        <div style={{ color: "var(--mut)", fontSize: 11.5, marginTop: 2 }}>
          <span style={{ fontFamily: "ui-monospace,monospace" }}>{rec?.osinerg || "…" + t.reclamo.slice(-6)}</span>
          {rec?.solicitante ? <span title={rec.solicitante}> · {rec.solicitante.length > 26 ? rec.solicitante.slice(0, 26) + "…" : rec.solicitante}</span> : ""}
          {verResp && <> · 👤 {t.responsable}</>}
        </div>
        {t.penalidadItem && t.penalidadItem !== "—" && t.penalidadItem !== "mora" && (
          <div style={{ marginTop: 5, fontSize: 11, color: t.vencido ? "#DC2626" : "var(--tx)" }}>
            ⚠ penalidad <b>{t.penalidadItem}</b> · plazo {t.plazoHabiles} días háb.
            {verMontos(rol) && t.exposicion ? <> · <b style={{ color: "#DC2626" }}>S/ {t.exposicion.toLocaleString("es-PE")}</b></> : ""}
          </div>
        )}
      </div>
      <SemaforoPlazo t={t} />
      {puedeEditar ? (
        <select value={t.estado} onChange={e => onEstado?.(t, e.target.value)} title="Cambiar estado del ticket" style={{
          background: "#fff", color: "var(--tx)", border: "1px solid var(--bd)", borderRadius: 8,
          padding: "5px 7px", fontSize: 12,
        }}>
          {ESTADOS.map(s => <option key={s} value={s}>{ESTADO_TICKET_LABEL[s] || s}</option>)}
        </select>
      ) : <span style={{ fontSize: 11, color: "var(--mut)" }}>{ESTADO_TICKET_LABEL[t.estado] || t.estado}</span>}
    </div>
  );
}
