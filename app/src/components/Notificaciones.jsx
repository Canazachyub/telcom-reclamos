import { useState } from "react";
import { wName } from "../lib/model.js";
import { urgColorTicket, urgLabel } from "../lib/tickets.js";
import { Tag } from "./ui.jsx";

// Campana de notificaciones: EL TICKET ACTIVO es la única fuente de verdad (vencidos o por
// vencer ≤2d háb.). Operativo -> solo los suyos. Coordinador/Gerente -> los de todo el equipo.
export default function Notificaciones({ perfil, activosTk = [], recByCode = {}, setSelExp }){
  const [open, setOpen] = useState(false);
  const verTodo = perfil.rol === "GERENTE" || perfil.rol === "COORDINADOR";
  const base = verTodo ? activosTk : activosTk.filter(t => t.respId === perfil.resp_id);
  const pend = base
    .filter(t => t.abierto && (t.vencido || (t.diasRestantes != null && t.diasRestantes <= 2)))
    .sort((a, b) => (a.vencido !== b.vencido ? (a.vencido ? -1 : 1) : (a.diasRestantes ?? 99) - (b.diasRestantes ?? 99)));
  const motivo = t => t.vencido ? "Vencido" : `Por vencer (${t.diasRestantes}d háb.)`;

  return (
    <div className="bellwrap">
      <button className="bell" onClick={() => setOpen(o => !o)} title="Tareas por hacer">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>
        </svg>
        {pend.length > 0 && <span className="badge">{pend.length > 99 ? "99+" : pend.length}</span>}
      </button>
      {open && (
        <div className="notifpanel" onMouseLeave={() => setOpen(false)}>
          <h4>Tareas por hacer ({pend.length}){verTodo ? " — equipo" : ""}</h4>
          {pend.length ? pend.slice(0, 50).map(t => {
            const rec = recByCode[String(t.reclamo)];
            return (
              <div className="notifitem" key={t.id} onClick={() => { const r = recByCode[String(t.reclamo)]; if(r) setSelExp(r.id, t.etapa); setOpen(false); }}>
                <div>
                  <div className="mono" style={{ fontSize: 12 }}>{rec?.osinerg || "…"+String(t.reclamo).slice(-6)}</div>
                  <div className="muted" style={{ fontSize: 11 }}>{t.etapa}{verTodo ? ` · ${wName(t.respId)}` : ""}{rec?.solicitante ? " · " + rec.solicitante.slice(0, 20) : ""}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <Tag bg={urgColorTicket(t)} color="#000">{urgLabel(t)}</Tag>
                  <div className="muted" style={{ fontSize: 10, marginTop: 3 }}>{motivo(t)}</div>
                </div>
              </div>
            );
          }) : <div className="muted" style={{ padding: "12px 9px" }}>Sin tareas pendientes. Todo al día.</div>}
        </div>
      )}
    </div>
  );
}
