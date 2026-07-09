import { useState } from "react";
import { Card } from "./ui.jsx";
import { abiertos, urgColorTicket, urgLabel } from "../lib/tickets.js";
import { wName } from "../lib/model.js";

const DOW = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const hoyISO = iso(new Date());
const ICONO_ETAPA = { "Recepción":"📥","Evaluación":"🔍","Campo":"🚙","SIELSE":"💻","Resolución":"⚖️","Firmas":"✍️","Notificación":"📨","Apelación (JARU)":"🏛️","Foliado":"📚","Cierre":"✅" };
const iniciales = n => (n || "").split(" ").map(s => s[0]).slice(0, 2).join("").toUpperCase();

// Calendario MENSUAL de vencimientos. Clic en un día → muestra de qué caso(s) es.
// Cambia por trabajador: recibe sus tickets (o los del equipo para Coordinación/Gerencia).
export default function Calendario({ tickets = [], recByCode = {}, perfil, setSelExp, equipo = false }) {
  const ini = new Date(); ini.setDate(1);
  const [mes, setMes] = useState(new Date(ini));
  const [selDia, setSelDia] = useState(null);

  // eventos por fecha (cada evento conserva el ticket completo `t` para el detalle rico)
  const ev = {};
  abiertos(tickets).filter(t => t.fechaLimite).forEach(t => {
    (ev[t.fechaLimite] = ev[t.fechaLimite] || []).push({
      titulo: t.etapa, sub: (recByCode[t.reclamo]?.osinerg || t.reclamo) + (recByCode[t.reclamo]?.suministro ? ` · ⚡${recByCode[t.reclamo].suministro}` : "") + (equipo ? ` · ${t.responsable}` : ""),
      reclamo: t.reclamo, vencido: t.vencido, d: t.diasRestantes, etapa: t.etapa, responsable: t.responsable, t,
    });
  });
  const esGerCoord = perfil?.rol === "GERENTE" || perfil?.rol === "COORDINADOR";
  if (equipo && esGerCoord) hitosDelMes(mes).forEach(h => (ev[h.fecha] = ev[h.fecha] || []).push(h));

  // clasificación de un día: "vencido" (rojo) prevalece sobre "porVencer" (ámbar) sobre "hito" sobre "ok" (verde)
  const claseDia = list => {
    if (list.some(e => e.vencido)) return "vencido";
    if (list.some(e => e.d != null && e.d <= 2)) return "porVencer";
    if (list.some(e => e.hito)) return "hito";
    return "ok";
  };
  const colorClase = { vencido: "#C0392B", porVencer: "#C9821B", hito: "#1E3A5F", ok: "#1E8E5A" };

  // grilla del mes
  const y = mes.getFullYear(), m = mes.getMonth();
  const primero = new Date(y, m, 1);
  const offset = (primero.getDay() + 6) % 7; // lunes=0
  const dias = new Date(y, m + 1, 0).getDate();
  const celdas = [];
  for (let i = 0; i < offset; i++) celdas.push(null);
  for (let d = 1; d <= dias; d++) celdas.push(new Date(y, m, d));

  // franja resumen del mes: cuenta casos (no hitos) vencidos vs por vencer dentro del mes visible
  const prefijoMes = `${y}-${String(m + 1).padStart(2, "0")}`;
  let totCasos = 0, totVencidos = 0, totPorVencer = 0;
  Object.entries(ev).forEach(([fecha, list]) => {
    if (!fecha.startsWith(prefijoMes)) return;
    list.filter(e => e.reclamo).forEach(e => {
      totCasos++;
      if (e.vencido) totVencidos++; else if (e.d != null && e.d <= 2) totPorVencer++;
    });
  });

  const detalle = selDia && ev[selDia] ? ev[selDia] : null;

  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <h3 style={{ margin: 0 }}>Calendario de plazos {equipo ? "— equipo" : "— mis vencimientos"}</h3>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <button className="btn sm" onClick={() => setMes(new Date(y, m - 1, 1))}>‹</button>
          <b style={{ minWidth: 130, textAlign: "center", color: "var(--titulo)", textTransform: "capitalize" }}>{MESES[m]} {y}</b>
          <button className="btn sm" onClick={() => setMes(new Date(y, m + 1, 1))}>›</button>
        </div>
      </div>

      {/* ===== franja resumen del mes ===== */}
      <div style={{
        display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", fontSize: 12.5,
        background: "var(--card2)", border: "1px solid var(--bd)", borderRadius: 10, padding: "8px 12px", marginBottom: 10,
      }}>
        <span style={{ color: "var(--tx)" }}>Este mes: <b style={{ color: "var(--titulo)" }}>{totCasos}</b> vencimiento{totCasos === 1 ? "" : "s"}</span>
        <span style={{ color: "var(--mut2)" }}>·</span>
        <span style={{ color: "#C0392B", fontWeight: 700 }}>{totVencidos} vencido{totVencidos === 1 ? "" : "s"}</span>
        <span style={{ color: "var(--mut2)" }}>·</span>
        <span style={{ color: "#B45309", fontWeight: 700 }}>{totPorVencer} por vencer</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
        {DOW.map(d => <div key={d} style={{ textAlign: "center", fontSize: 11, color: "var(--mut)", fontWeight: 700, padding: "2px 0" }}>{d}</div>)}
        {celdas.map((d, i) => {
          if (!d) return <div key={i} />;
          const k = iso(d), list = ev[k], es_hoy = k === hoyISO, sel = k === selDia;
          const clase = list ? claseDia(list) : null;
          const nVencidos = list ? list.filter(e => e.vencido).length : 0;
          const nPorVencer = list ? list.filter(e => !e.vencido && e.d != null && e.d <= 2 && !e.hito).length : 0;
          return (
            <div key={i} onClick={() => list && setSelDia(sel ? null : k)} style={{
              minHeight: 58, borderRadius: 8, padding: 5, cursor: list ? "pointer" : "default",
              background: sel ? "var(--selBg)" : "var(--card2)", border: `1px solid ${sel ? "var(--navy)" : es_hoy ? "var(--linkTx)" : "var(--bd)"}`,
            }}>
              <div style={{ fontSize: 11, color: es_hoy ? "var(--linkTx)" : "var(--mut)", fontWeight: es_hoy ? 700 : 400 }}>{d.getDate()}</div>
              {list && (
                <div style={{ marginTop: 3, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 4 }}>
                  {nVencidos > 0 && (
                    <span title={`${nVencidos} vencido(s)`} style={{
                      fontSize: 9.5, fontWeight: 700, color: "#fff", background: "#C0392B", borderRadius: 999,
                      minWidth: 14, height: 14, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 3px",
                    }}>{nVencidos}</span>
                  )}
                  {nPorVencer > 0 && (
                    <span title={`${nPorVencer} por vencer`} style={{
                      fontSize: 9.5, fontWeight: 700, color: "#fff", background: "#C9821B", borderRadius: 999,
                      minWidth: 14, height: 14, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 3px",
                    }}>{nPorVencer}</span>
                  )}
                  {clase === "hito" && <span style={{ width: 8, height: 8, borderRadius: "50%", background: colorClase.hito }} />}
                  {clase === "ok" && <span style={{ width: 8, height: 8, borderRadius: "50%", background: colorClase.ok }} />}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {detalle && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontWeight: 700, color: "var(--titulo)", marginBottom: 8 }}>Vence el {selDia} ({detalle.length})</div>
          <div style={{ display: "grid", gap: 8 }}>
            {detalle.map((e, i) => {
              if (e.hito) {
                return (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8,
                    background: "var(--card2)", border: "1px solid var(--bd)", borderLeft: "4px solid var(--navy)",
                  }}>
                    <span style={{
                      fontSize: 10.5, fontWeight: 700, color: "#fff", background: "var(--navy)", borderRadius: 999, padding: "2px 9px",
                    }}>📌 hito del contrato</span>
                    <span style={{ fontSize: 12.5, color: "var(--titulo)", fontWeight: 600 }}>{e.titulo}</span>
                    <span className="muted" style={{ fontSize: 11.5 }}>{e.sub}</span>
                  </div>
                );
              }
              const r = recByCode[e.reclamo];
              const t = e.t;
              const semaforo = e.vencido ? { tx: `vencido ${Math.abs(t.diasRestantes ?? 0)}d háb.`, cl: "#DC2626", bg: "#FDE7E7" }
                : (t.diasRestantes != null && t.diasRestantes <= 0) ? { tx: "vence hoy", cl: "#B45309", bg: "#FEF3DF" }
                : { tx: `${t.diasRestantes ?? "—"}d háb.`, cl: t.diasRestantes != null && t.diasRestantes <= 2 ? "#B45309" : "#15803D", bg: t.diasRestantes != null && t.diasRestantes <= 2 ? "#FEF3DF" : "#E5F7EC" };
              return (
                <div key={i} style={{
                  display: "flex", flexDirection: "column", gap: 6, padding: "10px 12px", borderRadius: 8,
                  background: "var(--card2)", border: "1px solid var(--bd)", borderLeft: `4px solid ${e.vencido ? "#C0392B" : "#C9821B"}`,
                }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
                        <span className="mono" style={{ fontSize: 12.5, fontWeight: 700, color: "var(--titulo)" }}>{r?.osinerg || String(e.reclamo)}</span>
                        {r?.suministro && <span className="mono muted" style={{ fontSize: 11 }}>⚡{r.suministro}</span>}
                        <span className="muted" style={{ fontSize: 11.5 }} title={r?.solicitante || ""}>{r?.solicitante || ""}</span>
                      </div>
                      <div style={{ fontSize: 11.5, color: "var(--mut)", marginTop: 2 }}>
                        {ICONO_ETAPA[e.etapa] || "📄"} {e.etapa}
                      </div>
                    </div>
                    <span style={{
                      fontSize: 10.5, fontWeight: 700, color: "#fff", background: urgColorTicket(t), borderRadius: 999, padding: "2px 9px", alignSelf: "flex-start",
                    }}>{urgLabel(t)}</span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{
                      width: 22, height: 22, borderRadius: "50%", background: "#1E5FAF", color: "#fff", fontSize: 10, fontWeight: 700,
                      display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    }}>{iniciales(e.responsable)}</span>
                    <span style={{ fontSize: 11.5, color: "var(--tx)" }}>{e.responsable || "—"}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: semaforo.cl, background: semaforo.bg, borderRadius: 999, padding: "2px 8px" }}>{semaforo.tx}</span>
                    {t.exposicion > 0 && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#B45309" }}>S/ {t.exposicion.toLocaleString("es-PE")}</span>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
                    <button className="btn-ghost" style={{ fontSize: 11.5, padding: "4px 10px" }}
                      onClick={() => { if (r) setSelExp?.(r.id); }}>🧭 Ver sala</button>
                    <button className="btn sm" style={{ background: "var(--acc)" }}
                      onClick={() => { if (r) setSelExp?.(r.id, e.etapa); }}>Trabajar</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {!detalle && <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>Clic en un día marcado para ver de qué caso(s) es el vencimiento.</div>}
    </Card>
  );
}

function hitosDelMes(mes) {
  const y = mes.getFullYear(), m = mes.getMonth();
  const ultimoDia = new Date(y, m + 1, 0).getDate();
  const clamp = dd => Math.min(dd, ultimoDia); // evita el "30 de febrero"
  const isoD = (yy, mm, dd) => `${yy}-${String(mm + 1).padStart(2, "0")}-${String(clamp(dd)).padStart(2, "0")}`;
  return [
    { fecha: isoD(y, m, 29), hito: true, titulo: "Capacitación mensual", sub: "acta + fotos (4.1/4.2)" },
    { fecha: isoD(y, m, 30), hito: true, titulo: "Muestra trimestral OSINERGMIN", sub: "ACT-04 (5.11)" },
    { fecha: isoD(y, m, 3), hito: true, titulo: "Valorización mensual", sub: "3 primeros días háb. (3.1)" },
  ];
}
