import { useState } from "react";
import { Card } from "./ui.jsx";
import { abiertos } from "../lib/tickets.js";

const DOW = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const hoyISO = iso(new Date());

// Calendario MENSUAL de vencimientos. Clic en un día → muestra de qué caso(s) es.
// Cambia por trabajador: recibe sus tickets (o los del equipo para Coordinación/Gerencia).
export default function Calendario({ tickets = [], recByCode = {}, perfil, setSelExp, equipo = false }) {
  const ini = new Date(); ini.setDate(1);
  const [mes, setMes] = useState(new Date(ini));
  const [selDia, setSelDia] = useState(null);

  // eventos por fecha
  const ev = {};
  abiertos(tickets).filter(t => t.fechaLimite).forEach(t => {
    (ev[t.fechaLimite] = ev[t.fechaLimite] || []).push({
      titulo: `${t.etapa}`, sub: (recByCode[t.reclamo]?.osinerg || "…" + t.reclamo.slice(-6)) + (equipo ? ` · ${t.responsable}` : ""),
      reclamo: t.reclamo, vencido: t.vencido, d: t.diasRestantes, etapa: t.etapa, responsable: t.responsable,
    });
  });
  if (equipo && (perfil?.rol === "GERENTE" || perfil?.rol === "COORDINADOR")) hitosDelMes(mes).forEach(h => (ev[h.fecha] = ev[h.fecha] || []).push(h));

  const colorDia = list => {
    if (list.some(e => e.vencido)) return "#C0392B";
    if (list.some(e => e.d != null && e.d <= 1)) return "#C0392B";
    if (list.some(e => e.d != null && e.d <= 2)) return "#C9821B";
    if (list.some(e => e.hito)) return "#C9821B";
    return "#1E8E5A";
  };

  // grilla del mes
  const y = mes.getFullYear(), m = mes.getMonth();
  const primero = new Date(y, m, 1);
  const offset = (primero.getDay() + 6) % 7; // lunes=0
  const dias = new Date(y, m + 1, 0).getDate();
  const celdas = [];
  for (let i = 0; i < offset; i++) celdas.push(null);
  for (let d = 1; d <= dias; d++) celdas.push(new Date(y, m, d));

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

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
        {DOW.map(d => <div key={d} style={{ textAlign: "center", fontSize: 11, color: "var(--mut)", fontWeight: 700, padding: "2px 0" }}>{d}</div>)}
        {celdas.map((d, i) => {
          if (!d) return <div key={i} />;
          const k = iso(d), list = ev[k], es_hoy = k === hoyISO, sel = k === selDia;
          return (
            <div key={i} onClick={() => list && setSelDia(sel ? null : k)} style={{
              minHeight: 58, borderRadius: 8, padding: 5, cursor: list ? "pointer" : "default",
              background: sel ? "var(--selBg)" : "var(--card2)", border: `1px solid ${sel ? "var(--navy)" : es_hoy ? "var(--linkTx)" : "var(--bd)"}`,
            }}>
              <div style={{ fontSize: 11, color: es_hoy ? "var(--linkTx)" : "var(--mut)", fontWeight: es_hoy ? 700 : 400 }}>{d.getDate()}</div>
              {list && <div style={{ marginTop: 3, display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: colorDia(list) }} />
                <span style={{ fontSize: 10.5, color: "var(--tx)" }}>{list.length}</span>
              </div>}
            </div>
          );
        })}
      </div>

      {detalle && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontWeight: 700, color: "var(--titulo)", marginBottom: 8 }}>Vence el {selDia} ({detalle.length})</div>
          <div style={{ display: "grid", gap: 6 }}>
            {detalle.map((e, i) => (
              <div key={i} onClick={() => { const r = recByCode[e.reclamo]; if (r) setSelExp?.(r.id, e.etapa); }} style={{
                display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8,
                background: "var(--card2)", border: "1px solid var(--bd)", borderLeft: `4px solid ${e.vencido ? "#C0392B" : e.hito ? "#C9821B" : "#1E8E5A"}`,
                cursor: e.reclamo ? "pointer" : "default",
              }}>
                <span style={{ fontSize: 12.5, color: "var(--titulo)", fontWeight: 600 }}>{e.hito ? "📌 " : ""}{e.titulo}</span>
                <span className="muted" style={{ fontSize: 11.5 }}>{e.sub}</span>
                {e.vencido && <span style={{ marginLeft: "auto", fontSize: 11, color: "#DC2626" }}>vencido</span>}
              </div>
            ))}
          </div>
        </div>
      )}
      {!detalle && <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>Clic en un día marcado para ver de qué caso(s) es el vencimiento.</div>}
    </Card>
  );
}

function hitosDelMes(mes) {
  const y = mes.getFullYear(), m = mes.getMonth();
  const isoD = (yy, mm, dd) => `${yy}-${String(mm + 1).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  return [
    { fecha: isoD(y, m, 29), hito: true, titulo: "Capacitación mensual", sub: "acta + fotos (4.1/4.2)" },
    { fecha: isoD(y, m, 30), hito: true, titulo: "Muestra trimestral OSINERGMIN", sub: "ACT-04 (5.11)" },
    { fecha: isoD(y, m, 3), hito: true, titulo: "Valorización mensual", sub: "3 primeros días háb. (3.1)" },
  ];
}
