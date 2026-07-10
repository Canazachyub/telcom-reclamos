import { useState } from "react";
import { toast } from "./ui.jsx";
import { postAction } from "../lib/api.js";
import { fmtFecha, parseFecha, esDiaHabil } from "../lib/model.js";

// ===================== Mejoras a los TR (propuesta técnica, vinculante) =====================
// TELCOM ofertó en su propuesta técnica ("Mejoras a los TR", 20 puntos): (1) informe MENSUAL
// de actividades de las contratistas de campo de ELSE (R01-R07) que incumplieron plazos;
// (2) informe SEMESTRAL de causas raíz. La etapa "Campo" guarda en `datos` (clave
// `${codigo}|Campo`) los campos N_OT_SIELSE, FECHA_INFORME_OT y CAUSA_INCUMPLIMIENTO_OT;
// los tickets de etapa Campo traen fechaLimite/vencido/diasRestantes.

const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

function detalleObj(r) {
  try { const d = typeof r.detalle === "string" ? JSON.parse(r.detalle) : (r.detalle || {}); return d && typeof d === "object" ? d : {}; }
  catch (e) { return {}; }
}

// atraso en días HÁBILES (los plazos R01-R07 de las contratistas son hábiles, no corridos)
function diffDias(a, b) {
  const da = parseFecha(a), db = parseFecha(b);
  if (!da || !db) return null;
  const x = new Date(da.getFullYear(), da.getMonth(), da.getDate());
  const y = new Date(db.getFullYear(), db.getMonth(), db.getDate());
  if (x.getTime() === y.getTime()) return 0;
  const sign = y > x ? 1 : -1;
  const lo = sign > 0 ? x : y, hi = sign > 0 ? y : x;
  let c = 0; const t = new Date(lo);
  while (t < hi) { t.setDate(t.getDate() + 1); if (esDiaHabil(t)) c++; }
  return sign * c;
}

function csvEscape(v) {
  const s = String(v ?? "");
  return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function descargarCSV(nombre, filas, cols) {
  const header = cols.map(c => c.h).join(";");
  const body = filas.map(f => cols.map(c => csvEscape(f[c.k])).join(";")).join("\n");
  const csv = "﻿" + header + "\n" + body; // BOM para Excel
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nombre; document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

function imprimirTabla(titulo, filas, cols) {
  const w = window.open("", "_blank", "width=1000,height=800");
  if (!w) { toast("El navegador bloqueó la ventana de impresión"); return; }
  const th = cols.map(c => "<th>" + c.h + "</th>").join("");
  const rows = filas.map(f => "<tr>" + cols.map(c => "<td>" + (f[c.k] ?? "—") + "</td>").join("") + "</tr>").join("");
  w.document.write(
    "<html><head><title>" + titulo + "</title><style>" +
    "body{font-family:system-ui,Arial,sans-serif;font-size:12px;padding:20px;color:#16294B}" +
    "h1{font-size:15px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:5px 7px;text-align:left}" +
    "th{background:#F0F4F9;text-transform:uppercase;font-size:10px}" +
    "</style></head><body><h1>" + titulo + "</h1><table><thead><tr>" + th + "</tr></thead><tbody>" + rows + "</tbody></table></body></html>"
  );
  w.document.close(); w.focus();
  setTimeout(() => { try { w.print(); } catch (e) {} }, 250);
}

export default function MejorasTR({ data, tickets, datos, registros, perfil }) {
  const hoy = new Date();
  const [mesSel, setMesSel] = useState(hoy.getFullYear() + "-" + String(hoy.getMonth() + 1).padStart(2, "0"));
  const semestreActual = hoy.getFullYear() + "-S" + (hoy.getMonth() < 6 ? 1 : 2);
  const [semSel, setSemSel] = useState(semestreActual);
  const [analisis, setAnalisis] = useState("");
  const puedeGuardar = ["GERENTE", "COORDINADOR"].includes(perfil?.rol);

  const recByCode = {}; (data || []).forEach(r => { recByCode[String(r.codigo)] = r; });

  // ===== casos con datos de Campo =====
  const camposCampo = Object.keys(datos || {}).filter(k => k.endsWith("|Campo")).map(k => {
    const codigo = k.slice(0, -("|Campo".length));
    const campos = datos[k] || {};
    const tk = (tickets || []).find(t => String(t.reclamo) === codigo && t.etapa === "Campo");
    return { codigo, campos, tk, exp: recByCode[codigo] };
  });

  const [anioMes, mesNum] = mesSel.split("-").map(Number);
  function enMes(fechaStr) {
    const d = parseFecha(fechaStr); if (!d) return false;
    return d.getFullYear() === anioMes && (d.getMonth() + 1) === mesNum;
  }

  // Incumplimientos del mes: ticket de Campo vencido en el mes, o CAUSA_INCUMPLIMIENTO_OT no vacía
  // registrada en el mes (por fecha de informe si existe, si no por vencimiento del ticket).
  const incumplMes = camposCampo.filter(c => {
    const causa = (c.campos.CAUSA_INCUMPLIMIENTO_OT || "").trim();
    const fechaInf = c.campos.FECHA_INFORME_OT;
    if (causa && fechaInf && enMes(fechaInf)) return true;
    if (causa && !fechaInf && c.tk && c.tk.fechaLimite && enMes(c.tk.fechaLimite)) return true;
    if (c.tk && c.tk.vencido && c.tk.fechaLimite && enMes(c.tk.fechaLimite)) return true;
    return false;
  }).map(c => {
    const dias = diffDias(c.tk?.fechaLimite, c.campos.FECHA_INFORME_OT);
    return {
      reclamo: c.exp ? (c.exp.osinerg || c.codigo) : c.codigo,
      suministro: c.exp ? c.exp.suministro : "—",
      ot: c.campos.N_OT_SIELSE || "—",
      fechaLimite: c.tk?.fechaLimite ? fmtFecha(c.tk.fechaLimite) : "—",
      fechaInforme: c.campos.FECHA_INFORME_OT ? fmtFecha(c.campos.FECHA_INFORME_OT) : "—",
      atraso: dias != null && dias > 0 ? dias + " d" : (c.tk?.vencido ? Math.abs(c.tk.diasRestantes || 0) + " d háb." : "—"),
      causa: c.campos.CAUSA_INCUMPLIMIENTO_OT || "(sin causa registrada)",
    };
  });

  const nombreMes = MESES[mesNum - 1] + " " + anioMes;
  const colsMensual = [
    { h: "N° reclamo", k: "reclamo" }, { h: "Suministro", k: "suministro" }, { h: "N° OT", k: "ot" },
    { h: "Fecha límite", k: "fechaLimite" }, { h: "Fecha informe", k: "fechaInforme" },
    { h: "Días de atraso", k: "atraso" }, { h: "Causa", k: "causa" },
  ];

  // ===== semestral: agrupación por causa raíz =====
  const [anioSem, sNum] = (() => { const [a, s] = semSel.split("-S"); return [Number(a), Number(s)]; })();
  function enSemestre(fechaStr) {
    const d = parseFecha(fechaStr); if (!d) return false;
    if (d.getFullYear() !== anioSem) return false;
    const mes = d.getMonth() + 1;
    return sNum === 1 ? mes <= 6 : mes > 6;
  }
  const causasSemestre = camposCampo.filter(c => {
    const causa = (c.campos.CAUSA_INCUMPLIMIENTO_OT || "").trim();
    if (!causa) return false;
    const fechaRef = c.campos.FECHA_INFORME_OT || c.tk?.fechaLimite;
    return fechaRef ? enSemestre(fechaRef) : false;
  }).map(c => (c.campos.CAUSA_INCUMPLIMIENTO_OT || "").trim());

  const conteoCausas = {};
  causasSemestre.forEach(c => { conteoCausas[c] = (conteoCausas[c] || 0) + 1; });
  const totalCausas = causasSemestre.length || 1;
  const causasOrdenadas = Object.entries(conteoCausas).sort((a, b) => b[1] - a[1]);
  const maxCausa = Math.max(1, ...causasOrdenadas.map(([, n]) => n));

  const registroSemestral = (registros || []).filter(r => {
    if (String(r.tipo) !== "reporte") return false;
    const d = detalleObj(r);
    return d.tipo_mejoras_tr === "semestral" && d.semestre === semSel;
  }).sort((a, b) => String(b.fecha || "").localeCompare(String(a.fecha || "")))[0];
  const analisisGuardado = registroSemestral ? detalleObj(registroSemestral).analisis : "";

  function guardarAnalisis() {
    const texto = analisis.trim() || analisisGuardado;
    if (!texto) { toast("Escribe el análisis antes de guardar"); return; }
    postAction("reporte", { tipo_mejoras_tr: "semestral", semestre: semSel, analisis: texto }).then(r => {
      if (r && r.ok !== false) toast("Análisis semestral guardado ✓");
      else toast("⚠ No se guardó: " + ((r && r.error) || "error"));
    });
  }

  // opciones de semestre: los últimos 4 (2 años)
  const opcionesSemestre = [];
  for (let a = hoy.getFullYear(); a >= hoy.getFullYear() - 1; a--) {
    opcionesSemestre.push(a + "-S2"); opcionesSemestre.push(a + "-S1");
  }

  const S = {
    sec: { background: "var(--card)", border: "1px solid var(--bd)", borderRadius: 16, padding: 16, marginTop: 14 },
    tit: { margin: "0 0 8px", fontSize: 14, color: "var(--titulo)", fontWeight: 700 },
    th: { fontSize: 10.5, textTransform: "uppercase", color: "var(--mut)" },
  };

  return (
    <div>
      <div style={S.sec}>
        <h3 style={S.tit}>🛠 Mejoras a los TR — contratistas de campo (R01-R07)</h3>
        <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.6 }}>
          Obligación ofertada por TELCOM en su propuesta técnica: informe mensual de incumplimientos de las contratistas de campo de ELSE y un informe semestral de causas raíz. Se derivan de los datos que el equipo registra en la etapa <b>Campo</b> (N° OT SIELSE, fecha de informe y causa de incumplimiento).
        </div>
      </div>

      {/* ===== informe mensual ===== */}
      <div style={S.sec}>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8, alignItems: "center", marginBottom: 8 }}>
          <h3 style={{ ...S.tit, margin: 0 }}>Informe mensual de incumplimientos — {nombreMes}</h3>
          <input type="month" className="flt" value={mesSel} onChange={e => setMesSel(e.target.value)} />
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="tbl">
            <thead><tr>{colsMensual.map(c => <th key={c.k} style={S.th}>{c.h}</th>)}</tr></thead>
            <tbody>
              {incumplMes.map((f, i) => (
                <tr key={i}>
                  <td className="mono">{f.reclamo}</td><td className="mono">{f.suministro}</td><td>{f.ot}</td>
                  <td>{f.fechaLimite}</td><td>{f.fechaInforme}</td>
                  <td style={{ color: "var(--red)", fontWeight: 700 }}>{f.atraso}</td>
                  <td style={{ maxWidth: 260 }}>{f.causa}</td>
                </tr>
              ))}
              {!incumplMes.length && <tr><td colSpan={colsMensual.length} className="muted" style={{ textAlign: "center", padding: 14 }}>Sin incumplimientos registrados en {nombreMes} ✓</td></tr>}
            </tbody>
          </table>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button className="btn-ghost" onClick={() => descargarCSV("incumplimientos_campo_" + mesSel + ".csv", incumplMes, colsMensual)} disabled={!incumplMes.length}>⬇ CSV</button>
          <button className="btn-ghost" onClick={() => imprimirTabla("Informe mensual de incumplimientos — " + nombreMes, incumplMes, colsMensual)} disabled={!incumplMes.length}>🖨 Imprimir</button>
        </div>
      </div>

      {/* ===== informe semestral de causas raíz ===== */}
      <div style={S.sec}>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8, alignItems: "center", marginBottom: 8 }}>
          <h3 style={{ ...S.tit, margin: 0 }}>Informe semestral de causas raíz</h3>
          <select className="flt" value={semSel} onChange={e => setSemSel(e.target.value)}>
            {opcionesSemestre.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        {!causasOrdenadas.length && <div className="muted" style={{ fontSize: 12.5, marginBottom: 10 }}>Sin causas de incumplimiento registradas en {semSel}.</div>}
        <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
          {causasOrdenadas.map(([causa, n]) => {
            const pct = (n / totalCausas * 100);
            return (
              <div key={causa}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 3 }}>
                  <span style={{ color: "var(--tx)" }}>{causa}</span>
                  <span className="muted">{n} · {pct.toFixed(0)}%</span>
                </div>
                <div style={{ background: "var(--card2)", borderRadius: 6, height: 14, overflow: "hidden" }}>
                  <div style={{ width: Math.max(4, n / maxCausa * 100) + "%", height: "100%", background: "var(--acc)", borderRadius: 6 }} />
                </div>
              </div>
            );
          })}
        </div>

        <label style={{ display: "block", fontSize: 11, textTransform: "uppercase", letterSpacing: ".04em", color: "var(--mut)", marginBottom: 5 }}>Análisis y recomendaciones</label>
        <textarea className="flt" style={{ width: "100%", minHeight: 100, fontFamily: "inherit", resize: "vertical" }}
          placeholder="Análisis de causas raíz y recomendaciones para reducir incumplimientos de las contratistas de campo…"
          value={analisis || analisisGuardado} onChange={e => setAnalisis(e.target.value)} />
        <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
          {puedeGuardar
            ? <button className="btn" onClick={guardarAnalisis}>Guardar análisis semestral</button>
            : <span className="muted" style={{ fontSize: 12 }}>Solo Gerencia/Coordinación puede guardar el análisis.</span>}
          {registroSemestral && <span className="muted" style={{ fontSize: 11.5 }}>Última versión guardada: {String(registroSemestral.fecha || "").slice(0, 10)}</span>}
        </div>
      </div>

      <div className="muted" style={{ fontSize: 11.5, marginTop: 10, textAlign: "center" }}>Obligación vinculante de la propuesta técnica (Mejoras a los TR — 20 puntos ofertados).</div>
    </div>
  );
}
