import { useMemo, useState } from "react";
import { Card } from "./ui.jsx";
import { TicketCard } from "./Ticket.jsx";
import { abiertos, vencidos, ordenUrgencia } from "../lib/tickets.js";
import { ETAPA_ROL, puedeTomar, teamById } from "../lib/model.js";
import { ROL_LABEL } from "../lib/auth.js";

// Chip "asignada a" — a quién la tiene HOY y con qué cargo (para decidir si tomarla).
function AsignadaA({ t }) {
  const m = teamById(t.respId);
  const sinAsignar = !t.respId;
  const nombre = sinAsignar ? "Sin asignar" : (t.responsable || m.nombre);
  const cargo = sinAsignar ? "en el pozo del equipo" : (ROL_LABEL[m.rol] || m.rol);
  return (
    <div style={{ fontSize: 11.5, color: "var(--mut)", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 9, height: 9, borderRadius: "50%", background: sinAsignar ? "#94a3b8" : (m.color || "#64748b"), flexShrink: 0 }} />
      <span>{sinAsignar ? "🫙" : "👤"} <b style={{ color: "var(--tx)" }}>{nombre}</b> · {cargo}</span>
    </div>
  );
}

// ===================== 🌐 TRABAJO DEL EQUIPO (pozo colaborativo) =====================
// El área COMPARTIDA del trabajador: todas las tareas ABIERTAS que trabaja SU rol
// (las suyas y las de sus pares del mismo rol — p.ej. los 3 tramitadores entre sí).
// Puede TOMAR (auto-asignarse) una tarea de un par: pasa a su nombre y a su "Mi día",
// y queda firmado en la bitácora (evidencia). No puede empujar trabajo a otros: eso
// sigue siendo del Coordinador. Ordenado por urgencia de plazo.
export default function TrabajoEquipo({ perfil, tickets, recByCode, onTomar, onEstado, setSelExp }) {
  const [soloOtros, setSoloOtros] = useState(false);
  const rol = perfil?.rol;
  const miId = perfil?.resp_id;

  // el pozo: tickets abiertos cuya etapa la trabaja MI rol (mismo gate que el backend)
  const pool = useMemo(() => {
    const ab = abiertos(tickets || []).filter(t => ETAPA_ROL[t.etapa] === rol);
    return ordenUrgencia(ab);
  }, [tickets, rol]);

  const mostrados = soloOtros ? pool.filter(t => t.respId !== miId) : pool;
  const abrir = t => { const r = recByCode[t.reclamo]; if (r) setSelExp(r.id, t.etapa); };
  const nMias = pool.filter(t => t.respId === miId).length;
  const nOtros = pool.length - nMias;
  const nVenc = vencidos(pool).length;
  const etiquetaRol = ROL_LABEL[rol] || rol;

  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div>
          <h3 style={{ margin: 0 }}>🌐 Trabajo del equipo — {etiquetaRol}</h3>
          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
            Tareas abiertas que trabaja tu rol: <b>{nMias}</b> tuya(s) · <b>{nOtros}</b> de tus pares
            {nVenc ? <> · <span style={{ color: "#C0392B" }}>{nVenc} vencida(s)</span></> : ""}.
            «✋ Tomar» pasa la tarea a tu nombre y a tu «Mi día» (queda en bitácora).
          </div>
        </div>
        <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
          <input type="checkbox" checked={soloOtros} onChange={e => setSoloOtros(e.target.checked)} />
          Solo las de mis pares
        </label>
      </div>

      <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
        {mostrados.map(t => {
          const mia = t.respId === miId;
          const tomable = !mia && puedeTomar(rol, t.etapa);
          return (
            <div key={t.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <TicketCard t={t} rec={recByCode[t.reclamo]} perfil={perfil} onEstado={onEstado} onAbrir={abrir} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5, minWidth: 168 }}>
                <AsignadaA t={t} />
                {mia
                  ? <span title="Ya es tuya — la ves en «Mi día»"
                      style={{ fontSize: 11, fontWeight: 700, color: "#047857", background: "#E8F6EC",
                               border: "1px solid #BFE5CB", borderRadius: 999, padding: "5px 10px", whiteSpace: "nowrap" }}>✓ tuya</span>
                  : tomable
                    ? <button className="btn sm" title={"Tomar esta tarea — hoy la tiene " + (t.responsable || "sin asignar")}
                        onClick={() => onTomar?.(t)}
                        style={{ whiteSpace: "nowrap", fontWeight: 700 }}>✋ Tomar{t.respId ? " de " + teamById(t.respId).corto : ""}</button>
                    : null}
              </div>
            </div>
          );
        })}
        {!mostrados.length && (
          <div className="muted" style={{ padding: 12 }}>
            {pool.length
              ? "Sin tareas de tus pares por tomar ahora mismo. 🎉"
              : "No hay tareas abiertas para tu rol en este momento."}
          </div>
        )}
      </div>
    </Card>
  );
}
