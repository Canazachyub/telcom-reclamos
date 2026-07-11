import { useState } from "react";
import { Card, Kpi, toast } from "./ui.jsx";
import { TicketCard, SemaforoPlazo, InfoBoton } from "./Ticket.jsx";
import { abiertos, vencidos, porVencer, tareaPrioritaria, agrupaPorEtapa } from "../lib/tickets.js";
import { esHerenciaTicket } from "../lib/model.js";
import RegistrarEvento from "./RegistrarEvento.jsx";

export default function MiDia({ perfil, misReclamos, data = [], tickets = [], recByCode = {}, onEstadoTicket, setSelExp, onCerrarDia, onEscanear }) {
  const [registrar, setRegistrar] = useState(false);
  // aviso de primer uso (una vez por navegador) — orienta al trabajador a las 3 acciones clave
  const [tip, setTip] = useState(() => { try { return localStorage.getItem("tip_midia_v1") !== "off"; } catch (e) { return true; } });
  const cerrarTip = () => { setTip(false); try { localStorage.setItem("tip_midia_v1", "off"); } catch (e) {} };
  const ab = abiertos(tickets);
  const venc = vencidos(tickets);
  const pv = porVencer(tickets, 2);
  // HERENCIA (§HerenciaPanel): "tu próxima tarea" prioriza lo NUESTRO — solo si únicamente le
  // quedan herencias (vencidas antes del 01/07/2026, contratista anterior) se muestra una, ya
  // con su chip apagado (SemaforoPlazo la reconoce sola por t.vencido+t.fechaLimite).
  const prio = tareaPrioritaria(ab.filter(t => !esHerenciaTicket(t))) || tareaPrioritaria(ab.filter(esHerenciaTicket));
  const prioHerencia = !!(prio && esHerenciaTicket(prio));
  // dentro de cada etapa, nuestros primero (herencia al final) — mismo orden de urgencia adentro de cada grupo
  const grupos = agrupaPorEtapa(ab).map(g => ({ ...g, tickets: [...g.tickets].sort((a, b) => Number(esHerenciaTicket(a)) - Number(esHerenciaTicket(b))) }));
  const recDe = t => recByCode[t.reclamo];
  // abre el expediente EN la etapa del ticket: ahí se sube evidencia, se llenan datos y se marca hecho
  const abrir = t => { const r = recDe(t); if (r) setSelExp(r.id, t.etapa); else toast("Este ticket apunta a un expediente que no está en la lista (¿recarga la página?)"); };

  return <>
    {registrar && <RegistrarEvento perfil={perfil} data={data} onClose={()=>setRegistrar(false)} onGuardado={()=>{}} />}
    <Card style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div><h3 style={{ margin: 0 }}>Hola, {perfil.nombre.split(" ")[0]}</h3><div className="muted" style={{ fontSize: 12 }}>Tu jornada · {ab.length} caso(s) en tu etapa</div></div>
        <button className="btn" title="Enviar tu reporte de hoy al Coordinador" onClick={() => { onCerrarDia(); toast("Día cerrado. Reporte enviado al Coordinador."); }}>Cerrar mi día</button>
      </div>
    </Card>

    {/* AVISO DE PRIMER USO — una vez por navegador, orienta a las 3 acciones clave */}
    {tip && (
      <div style={{ position: "relative", marginBottom: 14, padding: "13px 40px 13px 14px", borderRadius: 12, background: "var(--card2)", border: "1px dashed var(--navy)" }}>
        <button onClick={cerrarTip} title="Entendido, no mostrar más" style={{ position: "absolute", top: 8, right: 10, background: "transparent", border: 0, fontSize: 18, color: "var(--mut)", cursor: "pointer" }}>✕</button>
        <div style={{ fontWeight: 800, color: "var(--titulo)", marginBottom: 4 }}>👋 Bienvenido, {perfil.nombre.split(" ")[0]}</div>
        <div style={{ fontSize: 12.5, lineHeight: 1.6, color: "var(--tx)" }}>
          Trabaja como en tus hojas de siempre. Solo tres cosas:<br />
          <b>➕ Registrar</b> — anota un evento en un cuaderno (como en tu Excel). ·
          <b> 📷 Escanear QR</b> — apunta al código pegado en el libro y abre ese caso. ·
          <b> Tu próxima tarea</b> — abajo te decimos qué sigue; no tienes que buscar nada.
        </div>
      </div>
    )}

    {/* ACCIONES PRINCIPALES — grandes y claras: registrar (como en sus hojas) y escanear el QR del libro */}
    <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
      <button onClick={() => setRegistrar(true)}
        style={{ flex: "2 1 240px", padding: "16px", borderRadius: 14, border: 0, background: "var(--navy)", color: "#fff", fontSize: 17, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, boxShadow: "0 4px 14px rgba(31,78,140,.28)" }}>
        ➕ Registrar en un cuaderno
        <span style={{ fontSize: 12, fontWeight: 500, opacity: .85 }}>(anota un evento como en tu Excel)</span>
      </button>
      {onEscanear && <button onClick={onEscanear} title="Escanea el QR pegado en el libro para abrir el caso"
        style={{ flex: "1 1 160px", padding: "16px", borderRadius: 14, border: "2px solid var(--acc)", background: "var(--card)", color: "var(--tx)", fontSize: 16, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 44 }}>
        📷 Escanear QR
      </button>}
    </div>

    {/* ¿QUÉ HAGO AHORA? — una sola tarea prioritaria */}
    {prio ? (
      <Card style={{ marginBottom: 14, borderLeft: `4px solid ${prioHerencia ? "var(--mut2)" : prio.vencido ? "var(--red)" : "var(--amber)"}` }}>
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--mut)", fontWeight: 700, marginBottom: 8 }}>
          Tu próxima tarea {prioHerencia ? "· ⚖ herencia (contratista anterior)" : prio.vencido ? "· ⚠ vencida" : ""}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <SemaforoPlazo t={prio} big />
          <b style={{ fontSize: 16, color: "var(--titulo)" }}>{prio.etapa}</b>
          <InfoBoton etapa={prio.etapa} rol={perfil.rol} t={prio} />
        </div>
        <div className="muted" style={{ fontSize: 12.5, margin: "6px 0 10px" }}>
          <span className="mono">{recDe(prio)?.osinerg || prio.reclamo}</span>
          {recDe(prio)?.suministro && <> · ⚡ <b className="mono" style={{ fontWeight: 600, color: "var(--tx)" }}>{recDe(prio).suministro}</b></>}
          {recDe(prio)?.solicitante ? " · " + recDe(prio).solicitante : ""}
          {prio.penalidadItem && prio.penalidadItem !== "—" && <> · ⚠ penalidad {prio.penalidadItem} (plazo {prio.plazoHabiles} días háb.)</>}
        </div>
        {/* Abrir = navegación (acento); Marcar hecha = acción POSITIVA → éxito, NUNCA riesgo */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn sm" onClick={() => abrir(prio)}>Abrir y trabajar</button>
          {prio.estado !== "hecho" && <button className="btn sm ok" onClick={() => onEstadoTicket?.(prio, "hecho")}>Marcar etapa hecha</button>}
        </div>
      </Card>
    ) : (
      <Card style={{ marginBottom: 14 }}>
        {tickets.length
          ? <div className="muted">Sin tareas abiertas. Todo al día. 🎉</div>
          : <div className="muted">Aún no tienes tareas asignadas. No hace falta que busques nada: el trabajo te llegará solo cuando un caso entre a la etapa que te corresponde.</div>}
      </Card>
    )}

    {/* mini-KPIs (sin montos) — grid único, informativos en neutro; solo Vencidas lleva acento
        de riesgo (y Por vencer, ámbar) cuando de verdad hay algo que atender. */}
    <div className="kpigrid">
      <Kpi label="Abiertas" value={ab.length} sub="en mi bandeja" />
      <Kpi label="Por vencer (≤2d)" value={pv.length} sub="atención" s={pv.length ? "ambar" : null} />
      <Kpi label="Vencidas" value={venc.length} sub="urgente" s={venc.length ? "rojo" : null} />
      <Kpi label="Expedientes" value={misReclamos.length} sub="míos" />
    </div>

    {/* tickets por etapa, colapsables — solo la etapa urgente abierta por defecto */}
    <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
      {grupos.map(g => <GrupoEtapa key={g.etapa} g={g} perfil={perfil} recByCode={recByCode} onEstado={onEstadoTicket} onAbrir={abrir} defAbierto={g.urgente} />)}
      {!grupos.length && <Card><div className="muted">No tienes tareas abiertas.</div></Card>}
    </div>
  </>;
}

function GrupoEtapa({ g, perfil, recByCode, onEstado, onAbrir, defAbierto }) {
  const [open, setOpen] = useState(defAbierto);
  return (
    <Card style={{ padding: 0 }}>
      <div onClick={() => setOpen(o => !o)} style={{
        display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", cursor: "pointer",
        borderLeft: `4px solid ${g.urgente ? "var(--amber)" : "var(--acc)"}`,
      }}>
        <span style={{ color: "var(--mut)", width: 14 }}>{open ? "▾" : "▸"}</span>
        <b style={{ color: "var(--titulo)", fontSize: 13 }}>{g.etapa}</b>
        <span className="muted" style={{ fontSize: 11 }}>{g.abiertos} abierta(s)</span>
        {g.urgente && <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--tint-amber-tx)" }}>⚠ urgente</span>}
      </div>
      {open && (
        <div style={{ padding: "0 12px 12px", display: "grid", gap: 8 }}>
          {g.tickets.map(t => (
            <TicketCard key={t.id} t={t} rec={recByCode[t.reclamo]} perfil={perfil} onEstado={onEstado} onAbrir={onAbrir} />
          ))}
        </div>
      )}
    </Card>
  );
}
