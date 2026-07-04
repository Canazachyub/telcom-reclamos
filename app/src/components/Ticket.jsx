import { useState } from "react";
import { urgColorTicket, urgLabel, verMontos } from "../lib/tickets.js";
import { INFO_ETAPA } from "../lib/camposEtapa.js";
import { metaEtapa } from "../lib/model.js";

const ESTADOS = ["pendiente", "en_proceso", "hecho", "observado"];
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
        color: t.vencido ? "#fca5a5" : (t.diasRestantes != null && t.diasRestantes <= 2 ? "#fbbf24" : "#86efac") }
    : null;
  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      <button onClick={() => setOpen(o => !o)} title="¿Qué es esta etapa según las bases?" style={{
        width: 22, height: 22, borderRadius: "50%", border: "1px solid #2b6fc0",
        background: open ? "#1F4E8C" : "transparent", color: open ? "#fff" : "#60a5fa",
        fontWeight: 700, fontStyle: "italic", fontFamily: "Georgia,serif", cursor: "pointer", lineHeight: 1,
      }}>i</button>
      {open && (
        <div onMouseLeave={() => setOpen(false)} style={{
          position: "absolute", zIndex: 30, top: 26, left: 0, width: 320, background: "#0e1726",
          border: "1px solid #1F4E8C", borderRadius: 10, padding: 12, boxShadow: "0 10px 30px rgba(0,0,0,.5)",
          color: "#cbd5e1", fontSize: 12,
        }}>
          <div style={{ fontWeight: 700, color: "#93c5fd", marginBottom: 6 }}>«{etapa}» — según las bases (269-2014)</div>
          <Kv b="Qué es" v={info.que_es} />
          <Kv b="Por qué importa" v={info.importa} />
          <div style={{ display: "flex", gap: 6, margin: "3px 0" }}>
            <b style={{ color: "#5b6b80", minWidth: 86, fontWeight: 600 }}>Qué se hace</b>
            <span>{(metaEtapa(etapa)?.pasos || []).map((p, i) => <span key={i} style={{ display: "block", color: "#cbd5e1" }}>• {p}</span>)}</span>
          </div>
          <Kv b="Documento" v={(metaEtapa(etapa)?.evi || []).join(" · ") || "—"} />
          <Kv b="Plazo" v={info.plazo} />
          {concreto && <Kv b="En este caso" v={concreto.txt} color={concreto.color} />}
          <Kv b="Penalidad" v={info.pen + (verMontos(rol) && info.penMonto ? "  ·  " + info.penMonto : "")}
            color={info.pen === "—" ? "#94a3b8" : "#fca5a5"} />
          {!verMontos(rol) && info.pen !== "—" && <div style={{ color: "#64748b", fontSize: 10.5, marginTop: 4 }}>El importe en S/ lo gestiona Gerencia.</div>}
        </div>
      )}
    </span>
  );
}
const Kv = ({ b, v, color }) => (
  <div style={{ display: "flex", gap: 6, margin: "3px 0" }}>
    <b style={{ color: "#5b6b80", minWidth: 86, fontWeight: 600 }}>{b}</b>
    <span style={{ color: color || "#cbd5e1" }}>{v}</span>
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
      background: "#0f1828", border: "1px solid #1e2a3e", borderLeft: `4px solid ${c}`,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <b style={{ color: "#e2e8f0", fontSize: 13 }}>{t.etapa}</b>
          <InfoBoton etapa={t.etapa} rol={rol} t={t} />
          {onAbrir && <a onClick={() => onAbrir(t)} title="Abrir el expediente en esta etapa" style={{ color: "#60a5fa", fontSize: 11, cursor: "pointer" }}>abrir y trabajar ↗</a>}
        </div>
        <div style={{ color: "#8a97a8", fontSize: 11.5, marginTop: 2 }}>
          <span style={{ fontFamily: "ui-monospace,monospace" }}>{rec?.osinerg || "…" + t.reclamo.slice(-6)}</span>
          {rec?.solicitante ? " · " + rec.solicitante.slice(0, 26) : ""}
          {verResp && <> · 👤 {t.responsable}</>}
        </div>
        {t.penalidadItem && t.penalidadItem !== "—" && t.penalidadItem !== "mora" && (
          <div style={{ marginTop: 5, fontSize: 11, color: t.vencido ? "#fca5a5" : "#cbd5e1" }}>
            ⚠ penalidad <b>{t.penalidadItem}</b> · plazo {t.plazoHabiles} días háb.
            {verMontos(rol) && t.exposicion ? <> · <b style={{ color: "#fca5a5" }}>S/ {t.exposicion.toLocaleString("es-PE")}</b></> : ""}
          </div>
        )}
      </div>
      <SemaforoPlazo t={t} />
      {puedeEditar ? (
        <select value={t.estado} onChange={e => onEstado?.(t, e.target.value)} title="Cambiar estado del ticket" style={{
          background: "#0e1726", color: "#e2e8f0", border: "1px solid #334155", borderRadius: 8,
          padding: "5px 7px", fontSize: 12,
        }}>
          {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      ) : <span style={{ fontSize: 11, color: "#64748b" }}>{t.estado}</span>}
    </div>
  );
}
