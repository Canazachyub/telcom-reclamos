import { useState } from "react";
import { toast } from "./ui.jsx";
import { postAction } from "../lib/api.js";

// ===================== Tope de penalidades (10% del contrato) =====================
// Registro y medidor del acumulado de penalidades notificadas por ELSE contra el tope
// contractual del 10% del monto del contrato. Regla inviolable #5: si se llega al tope,
// ELSE puede RESOLVER el contrato — este panel es el "marcador" para que Gerencia/
// Coordinación lo vea venir con anticipación.

// Escala de penalidades de las bases (montos base; "mas_monto" = además del monto base
// se suma el monto en reclamo/mora del caso, según la causal — ej. 5.5 silencio positivo).
export const ESCALA = [
  { item: "1.1", causal_corta: "Demora en trato directo / proyecto de resolución", monto_base: 1000, mas_monto: false },
  { item: "1.2", causal_corta: "Observación subsanada fuera de plazo", monto_base: 500, mas_monto: false },
  { item: "1.3", causal_corta: "Resolución sin motivación legal completa", monto_base: 1000, mas_monto: false },
  { item: "2.1", causal_corta: "Demora en elevar expediente en apelación", monto_base: 300, mas_monto: false },
  { item: "2.2", causal_corta: "Expediente de apelación incompleto", monto_base: 200, mas_monto: false },
  { item: "2.3", causal_corta: "No elevar expediente en apelación (JARU)", monto_base: 2000, mas_monto: false },
  { item: "2.5", causal_corta: "Formato 6 (informe de elevación) deficiente", monto_base: 200, mas_monto: false },
  { item: "3.1", causal_corta: "Demora en tramitación de expedientes (por día)", monto_base: 100, mas_monto: false },
  { item: "4.1", causal_corta: "Demora en notificación notarial", monto_base: 50, mas_monto: false },
  { item: "4.2", causal_corta: "Notificación notarial no realizada", monto_base: 200, mas_monto: false },
  { item: "5.1", causal_corta: "Demora en transcribir a SIELSE (Recepción)", monto_base: 50, mas_monto: false },
  { item: "5.2", causal_corta: "Datos de SIELSE con error/incompleto", monto_base: 30, mas_monto: false },
  { item: "5.3", causal_corta: "Demora en asignar responsable", monto_base: 30, mas_monto: false },
  { item: "5.4", causal_corta: "Demora en registrar evidencia/documento", monto_base: 30, mas_monto: false },
  { item: "5.5", causal_corta: "Silencio administrativo positivo (JARU)", monto_base: 300, mas_monto: true },
  { item: "5.6", causal_corta: "Incumplimiento de capacitación mensual", monto_base: 100, mas_monto: false },
  { item: "5.7", causal_corta: "Falta de acta/fotos de capacitación", monto_base: 100, mas_monto: false },
  { item: "5.8", causal_corta: "Demora en valorización (3 días hábiles)", monto_base: 100, mas_monto: false },
  { item: "5.9", causal_corta: "Error que genera multa OSINERGMIN a ELSE", monto_base: 100, mas_monto: true },
  { item: "5.10", causal_corta: "Demora en descargo ante observación de ELSE", monto_base: 300, mas_monto: true },
  { item: "5.11", causal_corta: "Muestra trimestral OSINERGMIN incumplida", monto_base: 2000, mas_monto: false },
  { item: "5.12", causal_corta: "Reposición de personal clave fuera de plazo", monto_base: 300, mas_monto: true },
  { item: "5.13", causal_corta: "Otro incumplimiento operativo menor", monto_base: 30, mas_monto: false },
  { item: "6.1", causal_corta: "Incumplimiento de centro de operaciones", monto_base: 150, mas_monto: false },
];

function det(r) {
  try { return typeof r.detalle === "string" ? JSON.parse(r.detalle) : (r.detalle || {}); }
  catch (e) { return {}; }
}
const money = n => "S/ " + Number(n || 0).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function PenalidadesTope({ registros, config, perfil }) {
  const puedeRegistrar = ["GERENTE", "COORDINADOR"].includes(perfil?.rol);
  const [itemSel, setItemSel] = useState(ESCALA[0].item);
  const escalaSel = ESCALA.find(e => e.item === itemSel) || ESCALA[0];
  const [monto, setMonto] = useState(String(ESCALA[0].monto_base));
  const [expediente, setExpediente] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [nota, setNota] = useState("");
  const [busy, setBusy] = useState(false);

  function elegirItem(item) {
    setItemSel(item);
    const e = ESCALA.find(x => x.item === item);
    setMonto(String(e ? e.monto_base : 0));
  }

  const historial = (registros || [])
    .filter(r => String(r.tipo) === "reporte")
    .map(r => ({ ...det(r), fecha_reg: String(r.fecha || "").slice(0, 10), usuario: r.usuario }))
    .filter(d => !!d.tipo_penalidad)
    .sort((a, b) => (b.fecha || b.fecha_reg || "").localeCompare(a.fecha || a.fecha_reg || ""));

  const acumulado = historial.reduce((s, h) => s + (Number(h.monto) || 0), 0);
  const tope = 0.10 * Number(config?.MONTO_CONTRATO || 1250000);
  const pct = tope > 0 ? Math.min(100, (acumulado / tope) * 100) : 0;
  const colorBarra = pct < 50 ? "var(--green)" : pct < 80 ? "var(--amber)" : "var(--red)";

  function registrar() {
    if (!itemSel) { toast("Elige el ítem de la escala"); return; }
    const m = parseFloat(monto);
    if (isNaN(m) || m <= 0) { toast("⚠ El monto debe ser un número mayor a 0"); return; }
    setBusy(true);
    const escala = ESCALA.find(e => e.item === itemSel);
    const payload = {
      tipo_penalidad: itemSel,
      causal_corta: escala?.causal_corta || "",
      monto: m,
      expediente: expediente || "",
      fecha: fecha || new Date().toISOString().slice(0, 10),
      nota: nota || "",
    };
    postAction("reporte", payload).then(r => {
      setBusy(false);
      if (r && r.ok !== false) {
        toast("Penalidad registrada: " + itemSel + " — " + money(m));
        setExpediente(""); setNota("");
      } else {
        toast("⚠ No se guardó: " + ((r && r.error) || "error"));
      }
    });
  }

  const S = {
    sec: { background: "var(--card)", border: "1px solid var(--bd)", borderRadius: 16, padding: 16, marginTop: 14 },
    tit: { margin: "0 0 8px", fontSize: 14, color: "var(--titulo)", fontWeight: 700 },
    th: { fontSize: 10.5, textTransform: "uppercase", color: "var(--mut)" },
    lblSpan: { color: "var(--mut)", fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".05em", fontWeight: 600, display: "block", marginBottom: 3 },
    inp: { width: "100%", padding: "7px 9px", borderRadius: 8, fontSize: 13, fontFamily: "inherit", background: "var(--card2)", color: "var(--tx)", border: "1px solid var(--bd)", boxSizing: "border-box" },
  };

  return (
    <div>
      {/* ===== cabecera / medidor ===== */}
      <div style={S.sec}>
        <h3 style={S.tit}>⚠️ Tope de penalidades — 10% del contrato</h3>
        <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.6, marginBottom: 12 }}>
          Registro interno del acumulado de penalidades <b>notificadas por ELSE</b> contra el tope contractual del <b>10%</b>. Si se llega al tope, <b>ELSE puede resolver el contrato</b> (regla inviolable #5).
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6, flexWrap: "wrap", gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--titulo)" }}>
            {money(acumulado)} de {money(tope)} <span style={{ color: colorBarra }}>({pct.toFixed(1)}%)</span>
          </span>
          <span className="muted" style={{ fontSize: 11.5 }}>— al llegar al tope ELSE puede resolver el contrato</span>
        </div>
        <div style={{ height: 16, borderRadius: 999, background: "var(--card2)", border: "1px solid var(--bd)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: pct + "%", background: colorBarra, transition: "width .2s, background .2s" }} />
        </div>

        <div className="note" style={{ marginTop: 12, background: "var(--card2)", border: "1px solid var(--bd)", color: "var(--tx)" }}>
          Fórmula de mora de las bases: <span className="mono">Mora diaria = (0.10 × monto) / (0.40 × plazo)</span>
        </div>
      </div>

      {/* ===== escala de penalidades ===== */}
      <div style={S.sec}>
        <h3 style={S.tit}>Escala de penalidades (bases del contrato)</h3>
        <div style={{ overflowX: "auto", maxHeight: 320, overflowY: "auto" }}>
          <table className="tbl">
            <thead><tr>
              <th style={S.th}>Ítem</th><th style={S.th}>Causal</th><th style={S.th}>Monto base</th><th style={S.th}></th>
            </tr></thead>
            <tbody>
              {ESCALA.map(e => (
                <tr key={e.item} style={e.item === itemSel ? { background: "var(--selBg)" } : null}>
                  <td className="mono">{e.item}</td>
                  <td>{e.causal_corta}</td>
                  <td className="mono">{money(e.monto_base)}{e.mas_monto ? " + monto" : ""}</td>
                  <td><button className="btn-ghost" style={{ fontSize: 11 }} onClick={() => elegirItem(e.item)}>usar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===== registrar penalidad ===== */}
      <div style={S.sec}>
        <h3 style={S.tit}>Registrar penalidad notificada por ELSE</h3>
        {puedeRegistrar ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, maxWidth: 640 }}>
              <label style={{ fontSize: 12 }}>
                <span style={S.lblSpan}>Ítem de la escala</span>
                <select value={itemSel} onChange={e => elegirItem(e.target.value)} style={S.inp}>
                  {ESCALA.map(e => <option key={e.item} value={e.item}>{e.item} — {e.causal_corta}</option>)}
                </select>
              </label>
              <label style={{ fontSize: 12 }}>
                <span style={S.lblSpan}>Monto TOTAL S/ {escalaSel.mas_monto && <span style={{ color: "var(--mut)", textTransform: "none", fontWeight: 400 }}>(base {money(escalaSel.monto_base)} + monto/mora — edítalo)</span>}</span>
                <input type="number" value={monto} onChange={e => setMonto(e.target.value)} style={S.inp} />
              </label>
              <label style={{ fontSize: 12 }}>
                <span style={S.lblSpan}>Expediente (opcional)</span>
                <input type="text" value={expediente} onChange={e => setExpediente(e.target.value)} style={S.inp} />
              </label>
              <label style={{ fontSize: 12 }}>
                <span style={S.lblSpan}>Fecha</span>
                <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={S.inp} />
              </label>
              <label style={{ fontSize: 12, gridColumn: "1 / -1" }}>
                <span style={S.lblSpan}>Nota</span>
                <textarea rows={2} value={nota} onChange={e => setNota(e.target.value)} style={S.inp} />
              </label>
            </div>
            <button className="btn" style={{ marginTop: 12 }} onClick={registrar} disabled={busy}>{busy ? "Guardando…" : "Registrar penalidad"}</button>
          </>
        ) : (
          <div className="muted" style={{ fontSize: 12 }}>Solo Gerencia/Coordinación puede registrar penalidades.</div>
        )}
      </div>

      {/* ===== historial ===== */}
      <div style={S.sec}>
        <h3 style={S.tit}>Historial de penalidades ({historial.length})</h3>
        <div style={{ overflowX: "auto" }}>
          <table className="tbl">
            <thead><tr>
              <th style={S.th}>Ítem</th><th style={S.th}>Expediente</th><th style={S.th}>Fecha</th><th style={S.th}>Monto</th><th style={S.th}>Nota</th>
            </tr></thead>
            <tbody>
              {historial.map((h, i) => (
                <tr key={i}>
                  <td className="mono" title={h.causal_corta || ""}>{h.tipo_penalidad}</td>
                  <td className="mono">{h.expediente || "—"}</td>
                  <td>{h.fecha || h.fecha_reg || "—"}</td>
                  <td className="mono">{money(h.monto)}</td>
                  <td>{h.nota || <span className="muted">—</span>}</td>
                </tr>
              ))}
              {!historial.length && <tr><td colSpan={5} className="muted" style={{ textAlign: "center", padding: 12 }}>Sin penalidades registradas todavía.</td></tr>}
            </tbody>
            {!!historial.length && (
              <tfoot>
                <tr style={{ fontWeight: 700 }}>
                  <td colSpan={3} style={{ textAlign: "right", color: "var(--titulo)" }}>Total acumulado</td>
                  <td className="mono" style={{ color: "var(--titulo)" }}>{money(acumulado)}</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <div className="muted" style={{ fontSize: 11.5, marginTop: 14, textAlign: "center" }}>
        Registro interno de penalidades notificadas — el descargo se presenta en ≤5 días calendario (correo designado).
      </div>
    </div>
  );
}
