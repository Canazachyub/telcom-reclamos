import { useState } from "react";
import { wName } from "../lib/model.js";
import { urgColorTicket, urgLabel } from "../lib/tickets.js";
import { Tag } from "./ui.jsx";

// Campana de notificaciones: EL TICKET ACTIVO es la única fuente de verdad (vencidos o por
// vencer ≤2d háb.). Operativo -> solo los suyos. Coordinador/Gerente -> los de todo el equipo.
// v2: cada fila informa etapa + responsable + plazo real, agrupada en Vencidos / Por vencer,
// y ofrece dos rutas de navegación (Sala de seguimiento vs. Trabajar la etapa).
export default function Notificaciones({ perfil, activosTk = [], recByCode = {}, setSelExp }){
  const [open, setOpen] = useState(false);
  const verTodo = perfil.rol === "GERENTE" || perfil.rol === "COORDINADOR";
  const base = verTodo ? activosTk : activosTk.filter(t => t.respId === perfil.resp_id);
  const pend = base
    .filter(t => t.abierto && (t.vencido || (t.diasRestantes != null && t.diasRestantes <= 2)))
    .sort((a, b) => (a.vencido !== b.vencido ? (a.vencido ? -1 : 1) : (a.diasRestantes ?? 99) - (b.diasRestantes ?? 99)));
  const motivo = t => t.vencido ? `Vencido ${Math.abs(t.diasRestantes ?? 0)}d háb.` : `Vence en ${t.diasRestantes}d háb.`;

  const vencidos = pend.filter(t => t.vencido);
  const porVencer = pend.filter(t => !t.vencido);
  const badgeBg = vencidos.length ? "#E3001B" : porVencer.length ? "#C9821B" : "#E3001B";

  const irSala = (t, e) => { const r = recByCode[String(t.reclamo)]; if (r) setSelExp(r.id); e.stopPropagation(); setOpen(false); };
  const irTrabajar = (t, e) => { const r = recByCode[String(t.reclamo)]; if (r) setSelExp(r.id, t.etapa); e.stopPropagation(); setOpen(false); };

  const Fila = ({ t }) => {
    const rec = recByCode[String(t.reclamo)];
    return (
      <div className="notifitem" style={{ flexDirection: "column", alignItems: "stretch", gap: 4 }}
           onClick={() => { const r = recByCode[String(t.reclamo)]; if (r) setSelExp(r.id, t.etapa); setOpen(false); }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: "var(--titulo)" }}>{rec?.osinerg || String(t.reclamo)}</span>
              <span className="muted" style={{ fontSize: 11.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={rec?.solicitante || ""}>
                {rec?.solicitante || ""}
              </span>
            </div>
            <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
              Etapa: {t.etapa}{verTodo ? ` · ${wName(t.respId)}` : ""} · {motivo(t)}
            </div>
          </div>
          <Tag bg={urgColorTicket(t)} color="#fff">{urgLabel(t)}</Tag>
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 2 }}>
          <button className="btn-ghost" style={{ fontSize: 11, padding: "3px 9px" }} onClick={e => irSala(t, e)}>🧭 Sala</button>
          <button style={{ fontSize: 11, background: "transparent", border: 0, color: "var(--acc)", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", padding: "3px 2px" }}
                  onClick={e => irTrabajar(t, e)}>Trabajar →</button>
        </div>
      </div>
    );
  };

  return (
    <div className="bellwrap">
      <button className="bell" onClick={() => setOpen(o => !o)} title="Tareas por hacer">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>
        </svg>
        {pend.length > 0 && <span className="badge" style={{ background: badgeBg }}>{pend.length > 99 ? "99+" : pend.length}</span>}
      </button>
      {open && (
        <div className="notifpanel" onMouseLeave={() => setOpen(false)}>
          <h4>Tareas por hacer ({pend.length}){verTodo ? " — equipo" : ""}</h4>
          {pend.length ? (
            <>
              {vencidos.length > 0 && (
                <div style={{ marginBottom: 6 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#DC2626", padding: "2px 6px" }}>Vencidos ({vencidos.length})</div>
                  <div style={{ display: "grid", gap: 4 }}>{vencidos.slice(0, 30).map(t => <Fila t={t} key={t.id} />)}</div>
                </div>
              )}
              {porVencer.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#B45309", padding: "2px 6px" }}>Por vencer ≤2 d ({porVencer.length})</div>
                  <div style={{ display: "grid", gap: 4 }}>{porVencer.slice(0, 30).map(t => <Fila t={t} key={t.id} />)}</div>
                </div>
              )}
            </>
          ) : <div className="muted" style={{ padding: "12px 9px" }}>Sin tareas pendientes. Todo al día.</div>}
        </div>
      )}
    </div>
  );
}
