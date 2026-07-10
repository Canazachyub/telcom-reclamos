import { useEffect, useRef, useState } from "react";
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
      display: "inline-flex", alignItems: "center", gap: 5, background: c, color: "var(--ink)",
      borderRadius: 999, padding: big ? "4px 12px" : "2px 9px", fontSize: big ? 13 : 11.5, fontWeight: 700,
    }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--ink)", opacity: .55 }} />
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
    ? { txt: `vence ${fmtDia(t.fechaLimite)} · ${t.vencido ? `vencido ${Math.abs(t.diasRestantes ?? 0)}d háb.` : (t.diasRestantes != null ? `faltan ${t.diasRestantes} día(s) háb.` : "abierto")}`,
        color: t.vencido ? "var(--red)" : (t.diasRestantes != null && t.diasRestantes <= 2 ? "var(--amber)" : "var(--green)") }
    : null;
  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      <button onClick={() => setOpen(o => !o)} title="¿Qué es esta etapa según las bases?" style={{
        width: 22, height: 22, borderRadius: "50%", border: "1px solid var(--acc)",
        background: open ? "var(--acc)" : "transparent", color: open ? "#fff" : "var(--linkTx)",
        fontWeight: 700, fontStyle: "italic", fontFamily: "Georgia,serif", cursor: "pointer", lineHeight: 1,
      }}>i</button>
      {open && (
        <div style={{
          position: "absolute", zIndex: 30, top: 26, left: 0, width: 320, background: "var(--card)",
          border: "1px solid var(--acc)", borderRadius: 10, padding: 12, boxShadow: "var(--shadow-pop)",
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
            color={info.pen === "—" ? "var(--mut)" : "var(--red)"} />
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

// ⋯ Menú contextual de una fila de tarea: agrupa las acciones secundarias (cambiar estado,
// reasignar, archivar) en vez de repetirlas como controles sueltos en cada fila. Mismo estado
// local en todas las colas que usan TicketCard (Mi día, Trabajo del equipo, cola del
// Coordinador). Cierra con clic afuera o Escape. Los handlers son EXACTAMENTE los que ya
// recibía la fila (onEstado/onReasignar/onArchivar) — solo cambia dónde viven los controles.
function MenuAcciones({ t, puedeEditar, onEstado, onReasignar, teamOptions, onArchivar }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const btnRef = useRef(null);   // el botón "⋯" — recupera el foco al cerrar con Escape
  const firstItemRef = useRef(null); // primer control interactivo del menú — recibe el foco al abrir
  useEffect(() => {
    if (!open) return;
    const onDoc = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = e => { if (e.key === "Escape") { setOpen(false); btnRef.current?.focus(); } };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);
  // al abrir, foco al primer ítem del menú (navegación por teclado)
  useEffect(() => { if (open) firstItemRef.current?.focus(); }, [open]);
  const selSty = { display: "block", width: "100%", marginTop: 4, background: "var(--card2)", color: "var(--tx)", border: "1px solid var(--bd)", borderRadius: 8, padding: "8px 7px", fontSize: 12.5, minHeight: 40 };
  const lblSty = { fontSize: 10, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--mut)" };
  const esPrimeroEstado = puedeEditar;
  const esPrimeroReasignar = !esPrimeroEstado && onReasignar && teamOptions;
  const esPrimeroArchivar = !esPrimeroEstado && !esPrimeroReasignar && onArchivar;
  return (
    <span ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button ref={btnRef} className="icon-btn" onClick={() => setOpen(o => !o)} title="Más acciones" aria-haspopup="menu" aria-expanded={open}>⋯</button>
      {open && (
        <div role="menu" style={{ position: "absolute", right: 0, top: 40, zIndex: 40, minWidth: 200, background: "var(--card)", border: "1px solid var(--bd)", borderRadius: 10, padding: 6, boxShadow: "var(--shadow-pop)" }}>
          {puedeEditar && (
            <label style={{ display: "block", padding: "4px 6px 6px" }}>
              <span style={lblSty}>Estado</span>
              <select ref={esPrimeroEstado ? firstItemRef : undefined} value={t.estado} onChange={e => { onEstado?.(t, e.target.value); setOpen(false); }} title="Cambiar estado de la tarea" style={selSty}>
                {ESTADOS.map(s => <option key={s} value={s}>{ESTADO_TICKET_LABEL[s] || s}</option>)}
              </select>
            </label>
          )}
          {onReasignar && teamOptions && (
            <label style={{ display: "block", padding: "4px 6px 6px" }}>
              <span style={lblSty}>Reasignar</span>
              <select ref={esPrimeroReasignar ? firstItemRef : undefined} value={t.respId} onChange={e => { onReasignar(t, e.target.value); setOpen(false); }} title="Reasignar responsable" style={selSty}>
                {teamOptions.map(m => <option key={m.id} value={m.id}>{m.corto} · {m.rol}</option>)}
                <option value={0}>Externo / Call Center</option>
              </select>
            </label>
          )}
          {onArchivar && (
            <button ref={esPrimeroArchivar ? firstItemRef : undefined} role="menuitem" onClick={() => { onArchivar(t); setOpen(false); }}
              title="Archivar: cerrar el caso y sacarlo de la cola/alarmas (ya está cerrado en la vida real)"
              style={{ width: "100%", textAlign: "left", border: 0, background: "transparent", color: "var(--tx)", padding: "9px 10px", borderRadius: 7, fontSize: 12.5, cursor: "pointer", minHeight: 40 }}>🗄 Archivar caso</button>
          )}
        </div>
      )}
    </span>
  );
}

// Tarjeta de un ticket: jerarquía = código completo · ⚡ suministro · reclamante · semáforo con
// días. La etapa y las acciones secundarias (estado/reasignar/archivar) quedan un nivel abajo,
// agrupadas en el menú "⋯" (MenuAcciones) — antes eran controles repetidos en cada fila.
export function TicketCard({ t, rec, perfil, onEstado, onAbrir, onReasignar, teamOptions, onArchivar }) {
  const rol = perfil?.rol;
  const propio = t.respId === perfil?.resp_id;
  const puedeEditar = !!onEstado && (propio || rol === "GERENTE" || rol === "COORDINADOR");
  const verResp = rol === "GERENTE" || rol === "COORDINADOR";
  const c = urgColorTicket(t);
  const hayMenu = puedeEditar || (onReasignar && teamOptions) || onArchivar;
  const nombre = rec?.solicitante || "";
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10,
      background: "var(--card2)", border: "1px solid var(--bd)", borderLeft: `4px solid ${c}`,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* jerarquía #1 — lo primero que se lee: código completo · suministro · reclamante */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <span className="mono" style={{ fontWeight: 700, fontSize: 13, color: "var(--titulo)" }} title={"Código: " + (rec?.osinerg || t.reclamo)}>{rec?.osinerg || t.reclamo}</span>
          {rec?.suministro && <span className="mono" style={{ fontSize: 12.5, color: "var(--tx)" }} title="Suministro — con esto te guías (es la clave del QR y de los cuadernos)">⚡ {rec.suministro}</span>}
          {nombre && <span style={{ fontSize: 12, color: "var(--tx2)" }} title={nombre}>{nombre.length > 26 ? nombre.slice(0, 26) + "…" : nombre}</span>}
        </div>
        {/* jerarquía #2 — contexto de la tarea: etapa · ayuda · abrir */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
          <span style={{ color: "var(--mut)", fontSize: 11.5 }}>{t.etapa}</span>
          <InfoBoton etapa={t.etapa} rol={rol} t={t} />
          {onAbrir && <a onClick={() => onAbrir(t)} title="Abrir el expediente en esta etapa" style={{ color: "var(--linkTx)", fontSize: 11, cursor: "pointer" }}>abrir y trabajar ↗</a>}
          {verResp && <span className="muted" style={{ fontSize: 11 }}>· 👤 {t.responsable}</span>}
        </div>
        {t.penalidadItem && t.penalidadItem !== "—" && t.penalidadItem !== "mora" && (
          <div style={{ marginTop: 5, fontSize: 11, color: t.vencido ? "var(--red)" : "var(--tx)" }}>
            ⚠ penalidad <b>{t.penalidadItem}</b> · plazo {t.plazoHabiles} días háb.
            {verMontos(rol) && t.exposicion ? <> · <b className="mono" style={{ color: "var(--red)" }}>S/ {t.exposicion.toLocaleString("es-PE")}</b></> : ""}
          </div>
        )}
      </div>
      <SemaforoPlazo t={t} />
      {hayMenu
        ? <MenuAcciones t={t} puedeEditar={puedeEditar} onEstado={onEstado} onReasignar={onReasignar} teamOptions={teamOptions} onArchivar={onArchivar} />
        : <span style={{ fontSize: 11, color: "var(--mut)" }}>{ESTADO_TICKET_LABEL[t.estado] || t.estado}</span>}
    </div>
  );
}
