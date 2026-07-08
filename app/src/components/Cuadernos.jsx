import { useEffect, useMemo, useState } from "react";
import { Card, Tag, toast } from "./ui.jsx";
import { loadCuadernosResumen, loadCuadernoDatos, registroControl, regenerarCuadernos, cuadernosBulk } from "../lib/api.js";
import { CUADERNOS, MESES_NOMBRE, valCuaderno } from "../lib/cuadernosDef.js";
import { parseFecha } from "../lib/model.js";

// ===================== 📒 CUADERNOS DE CONTROL 2026 =====================
// Los 22 Excel del sistema anterior, vivos DENTRO de la plataforma (V2_06):
// - hub de tarjetas con contadores y huecos (celda vacía = pendiente real §9.4)
// - vista de cada cuaderno con SUS títulos/columnas de siempre; la periodicidad
//   (encabezados-fecha del Excel) volvió como filtro/agrupación por fecha_evento
// - fila clickeable → Sala del expediente · ✏ editar / ➕ registrar (bitácora firmada)
// - 🖨 cargo imprimible con ENTREGADO/RECIBIDO en blanco (el papel de siempre)

const fmtF = v => {
  if (!v) return "";
  const d = parseFecha(String(v).slice(0, 10));
  return d ? d.toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" }) : String(v);
};
const hoyISO = () => new Date().toISOString().slice(0, 10);

// ¿el valor parece una fecha/fecha-hora ISO? -> se muestra como dd/mm/yyyy (nunca "2026-06-18T05:00:00.000Z")
const esISO = v => /^\d{4}-\d{2}-\d{2}/.test(String(v || ""));
const fmtCel = v => (esISO(v) ? fmtF(v) : (v == null ? "" : String(v)));

// Campos que son FECHA (llevan date-picker en el editor y se muestran dd/mm/yyyy).
const CAMPOS_FECHA = new Set(["fecha_evento", "f2", "f3", "f4"]);
// No se ofrecen para editar (autogenerados o de solo lectura).
const NO_EDITABLES = new Set(["item", "usuario", "origen", "cod_reclamo", "numero_osinerg"]);

// Campos editables de un cuaderno, derivados de SUS columnas reales (etiquetas de siempre):
// así el formulario de «1ra Inspección» dice EJECUTADO/DEVUELTO en vez de «Fecha 2/3».
function camposEditables(def) {
  const vistos = new Set(), out = [];
  (def.cols || []).forEach(([label, path]) => {
    if (!path || NO_EDITABLES.has(path) || vistos.has(path)) return;
    vistos.add(path);
    out.push({ path, label, fecha: CAMPOS_FECHA.has(path), extra: path.indexOf("extra.") === 0 });
  });
  if (!vistos.has("observaciones")) out.push({ path: "observaciones", label: "Observaciones", ancho: true });
  return out;
}
// extra{} de una fila (para no PISAR los demás campos extra al guardar uno).
const extraDe = fila => {
  try { return typeof fila.extra === "string" ? JSON.parse(fila.extra || "{}") : (fila.extra || {}); }
  catch (e) { return {}; }
};

// Número con separador de miles (es-PE); "" si es nulo.
const nMil = v => (v == null || v === "") ? "" : Number(v).toLocaleString("es-PE");

// Agrupación de los cuadernos por FASE del trabajo (organiza el hub, en vez de 19 tarjetas sueltas).
const GRUPOS = [
  { titulo: "Padrón mensual", keys: ["mensual"] },
  { titulo: "Campo e inspección", keys: ["1ra_inspeccion", "contrastes", "contraste_resultado", "cambios_medidor"] },
  { titulo: "Resoluciones y envíos", keys: ["resol_oficina", "correlativos", "cartas_cvr", "cargo_consorcio", "notaria", "notaria_retorno", "oposiciones"] },
  { titulo: "Apelaciones (JARU)", keys: ["apelaciones", "cargos_apelacion"] },
  { titulo: "Cierre y control", keys: ["cerrados", "espera_cedula", "suspendidos", "reintegros", "sectores"] },
];
const DEF_POR_KEY = {}; CUADERNOS.forEach(d => { DEF_POR_KEY[d.key] = d; });

// métrica compacta del resumen del hub (etiqueta pequeña + número grande tabular)
const Metric = ({ label, value }) => (
  <div>
    <div style={{ fontSize: 19, fontWeight: 800, color: "var(--titulo,#16294B)", fontVariantNumeric: "tabular-nums", lineHeight: 1.1 }}>{value}</div>
    <div className="muted" style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: .4, marginTop: 2 }}>{label}</div>
  </div>
);

function semaforoElev(fila) {          // solo APELACION: plazo máx de elevación (5 d.h. — pen. 5.10)
  const plazo = String(fila.f2 || "").slice(0, 10);
  const elevada = valCuaderno(fila, "extra.siged");
  if (!plazo || elevada) return null;
  const dif = Math.round((new Date(plazo) - new Date(hoyISO())) / 86400000);
  if (dif < 0) return <Tag bg="#FDE2E2" color="#B91C1C">vencido {plazo.slice(5)}</Tag>;
  if (dif <= 2) return <Tag bg="#FEF3DF" color="#B45309">vence {plazo.slice(5)}</Tag>;
  return <Tag bg="#E8F6EC" color="#14532d">{plazo.slice(5)}</Tag>;
}

export default function Cuadernos({ data, setSelExp, perfil, abrir, onAbierto, onVolver }) {
  const [resumen, setResumen] = useState(null);
  const [sel, setSel] = useState(null);            // def del cuaderno abierto
  const [filas, setFilas] = useState(null);
  const [filtro, setFiltro] = useState("");        // mes (mensual) o mes de fecha_evento
  const [dia, setDia] = useState("");              // FECHA exacta (YYYY-MM-DD) — filtro fino por día
  const [q, setQ] = useState("");
  const [tope, setTope] = useState(300);
  const [edit, setEdit] = useState(null);          // fila en edición | {} alta
  const [pegar, setPegar] = useState(false);       // modal "pegar desde Excel"
  const [regen, setRegen] = useState(false);
  const [verFlujo, setVerFlujo] = useState(false); // flujograma "¿cómo funciona esta sección?"
  const esJefe = perfil && (perfil.rol === "GERENTE" || perfil.rol === "COORDINADOR");

  const cargarResumen = () => loadCuadernosResumen().then(setResumen);
  useEffect(() => { cargarResumen(); }, []);

  const [deepLinked, setDeepLinked] = useState(false); // llegó por deep-link (desde la Sala) → muestra "← Volver"
  const recargar = () => loadCuadernoDatos(sel.fuente).then(setFilas);
  const abrirCuaderno = (def, q) => {
    setSel(def); setFilas(null); setFiltro(""); setDia(""); setQ(q || ""); setTope(300);
    loadCuadernoDatos(def.fuente).then(setFilas);
  };
  // deep-link desde la Sala: abrir un cuaderno YA FILTRADO a ese caso (abrir = {fuente, q})
  useEffect(() => {
    if (!abrir) return;
    const def = CUADERNOS.find(c => c.fuente === abrir.fuente || c.key === abrir.fuente);
    if (def) { abrirCuaderno(def, abrir.q ? String(abrir.q) : ""); setDeepLinked(true); }
    onAbierto && onAbierto();
  }, [abrir]);

  // expediente de la plataforma para una fila (cruce por NumeroOsinerg / CodigoReclamo)
  const recDe = fila => {
    const caso = sel.fuente === "mensual" ? String(fila.n_solicitud || "") : String(fila.reclamo || "");
    if (!caso) return null;
    return (data || []).find(x => String(x.osinerg) === caso || String(x.codigo) === caso) || null;
  };

  // campo de fecha del cuaderno: el padrón filtra por FechaRegistroReclamo; los demás por fecha_evento
  const fechaCampo = sel && sel.fuente === "mensual" ? "fecha_registro" : "fecha_evento";
  // columnas de la vista: la tabla ya pone su propio N°, así que ocultamos la columna 'item'
  // (evita el doble «N°» del padrón). Se usa en tabla, export, cargo e impresión.
  const colsVista = sel ? sel.cols.filter(c => c[1] !== "item") : [];
  const filtradas = useMemo(() => {
    if (!filas) return [];
    let out = filas;
    if (sel && dia) {                                   // FECHA exacta manda sobre el mes
      out = out.filter(f => String(f[fechaCampo] || "").slice(0, 10) === dia);
    } else if (sel && filtro) {
      out = sel.fuente === "mensual"
        ? out.filter(f => String(f.mes) === filtro)
        : out.filter(f => String(f.fecha_evento || "").slice(0, 7) === filtro);
    }
    if (q.trim()) {
      const t = q.trim().toUpperCase();
      out = out.filter(f => JSON.stringify(f).toUpperCase().includes(t));
    }
    return out;
  }, [filas, filtro, dia, q, sel]);

  // opciones del filtro: meses (mensual) o meses de fecha_evento (registros)
  const opcionesFiltro = useMemo(() => {
    if (!filas || !sel) return [];
    if (sel.fuente === "mensual")
      return [...new Set(filas.map(f => String(f.mes)))].sort((a, b) => a - b)
        .map(m => [m, MESES_NOMBRE[+m] || m]);
    return [...new Set(filas.map(f => String(f.fecha_evento || "").slice(0, 7)).filter(Boolean))]
      .sort().reverse().map(m => [m, (MESES_NOMBRE[+m.slice(5, 7)] || m) + " " + m.slice(0, 4)]);
  }, [filas, sel]);

  const regenerar = async () => {
    if (regen) return;
    setRegen(true);
    const r = await regenerarCuadernos();
    setRegen(false);
    if (r && r.ok) { toast("Google Sheet CUADERNOS 2026 regenerado"); cargarResumen(); }
    else toast("No se pudo regenerar: " + (r && r.error || "sin respuesta"));
  };

  // Etiqueta legible del período elegido (día exacto > mes > todos) — para el título del cargo.
  const periodoLabel = () => {
    if (dia) return fmtF(dia);
    if (!filtro) return "todos los períodos";
    const op = opcionesFiltro.find(([v]) => String(v) === String(filtro));
    return op ? op[1] : filtro;
  };

  // subir filas pegadas de Excel (upsert idempotente por sesión) — padrón o temático
  const subirPegado = async rows => {
    const payload = sel.fuente === "mensual" ? { hoja: "cuaderno_mensual", rows } : { tipo: sel.fuente, rows };
    const r = await cuadernosBulk(payload);
    if (r && r.ok) {
      toast(`Subido: ${r.nuevos} nuevo(s) · ${r.actualizados} actualizado(s)`);
      setPegar(false); recargar(); cargarResumen();
    } else toast("No se pudo subir: " + (r && r.error || "sin respuesta"));
  };

  // 🖨 cargo imprimible: bloques por fecha con ENTREGADO/RECIBIDO en blanco (mockup 8.4).
  // Respeta el PERÍODO elegido en el filtro (mes/fecha) — como los Excel, ahora unificado pero filtrable.
  const imprimirCargo = () => {
    const porFecha = {};
    filtradas.forEach(f => { const k = String(f.fecha_evento || "s/f").slice(0, 10); (porFecha[k] = porFecha[k] || []).push(f); });
    const bloques = Object.keys(porFecha).sort().map(fecha => {
      const rows = porFecha[fecha].map((f, i) =>
        `<tr><td>${i + 1}</td>${colsVista.map(c => `<td>${fmtCel(valCuaderno(f, c[1]))}</td>`).join("")}</tr>`).join("");
      return `<h3>${sel.titulo}${fecha !== "s/f" ? " — " + fmtF(fecha) : ""}</h3>
        <table><thead><tr><th>N°</th>${colsVista.map(c => `<th>${c[0]}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table>
        <div class="firmas">
          <div class="fila"><span class="et">ENTREGADO POR:</span><span class="ln"></span></div>
          <div class="fila"><span class="et">RECIBIDO POR:</span><span class="ln"></span></div>
          <div class="fila"><span class="et">DNI:</span><span class="ln corto"></span>
            <span class="et">FECHA / HORA:</span><span class="ln corto"></span></div>
          <div class="fila"><span class="et">FIRMA / SELLO:</span><span class="ln"></span></div>
        </div>`;
    }).join("");
    const w = window.open("", "_blank");
    w.document.write(`<html><head><title>Cargo — ${sel.nombre} — ${periodoLabel()}</title><style>
      body{font-family:Arial,sans-serif;font-size:11px;margin:24px;color:#111}
      h2{margin:0 0 2px}h3{margin:18px 0 6px}
      table{border-collapse:collapse;width:100%}td,th{border:1px solid #333;padding:3px 5px;text-align:left}
      th{background:#eee}
      .firmas{margin:20px 0 30px}
      .firmas .fila{display:flex;align-items:flex-end;gap:10px;margin:16px 0}
      .firmas .et{font-weight:bold;white-space:nowrap;font-size:12px}
      .firmas .ln{flex:1;border-bottom:1px solid #333;height:22px}
      .firmas .ln.corto{flex:0 0 210px}
      @media print{.firmas{page-break-inside:avoid}}</style></head><body>
      <h2>INGENIERIA TELCOM E.I.R.L. · CP-026-2026-ELSE</h2>
      <div>📒 <b>${sel.nombre}</b> — período: <b>${periodoLabel()}</b> · ${filtradas.length} registro(s)
        · cargo generado por la plataforma ${new Date().toLocaleString("es-PE")}</div>
      ${bloques}</body></html>`);
    w.document.close(); w.print();
  };

  // 🖨 imprimir / PDF: la vista actual (respeta el filtro) como tabla limpia. El navegador
  // ofrece «Guardar como PDF». Sirve para el padrón y cualquier cuaderno que no sea cargo.
  const imprimirTabla = () => {
    const rows = filtradas.map((f, i) =>
      `<tr><td>${i + 1}</td>${colsVista.map(c => `<td>${fmtCel(valCuaderno(f, c[1]))}</td>`).join("")}</tr>`).join("");
    const w = window.open("", "_blank");
    w.document.write(`<html><head><title>${sel.nombre} — ${periodoLabel()}</title><style>
      body{font-family:Arial,sans-serif;font-size:10px;margin:18px;color:#111}
      h2{margin:0 0 2px}table{border-collapse:collapse;width:100%}
      td,th{border:1px solid #333;padding:2px 5px;text-align:left}th{background:#eee}
      @media print{@page{size:landscape}}</style></head><body>
      <h2>INGENIERIA TELCOM E.I.R.L. · CP-026-2026-ELSE</h2>
      <div>📒 <b>${sel.nombre}</b> — período: <b>${periodoLabel()}</b> · ${filtradas.length} registro(s)
        · ${new Date().toLocaleString("es-PE")}</div><br>
      <table><thead><tr><th>N°</th>${colsVista.map(c => `<th>${c[0]}</th>`).join("")}</tr></thead>
        <tbody>${rows}</tbody></table></body></html>`);
    w.document.close(); w.print();
  };

  // 🧮 exportar a Excel/CSV la vista actual (para trabajarla también en Excel). Sin fugas: solo lo filtrado.
  const exportarCSV = () => {
    const esc = v => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
    const head = ["N°", ...colsVista.map(c => c[0])];
    const lineas = [head.map(esc).join(";")];
    filtradas.forEach((f, i) => lineas.push([i + 1, ...colsVista.map(c => fmtCel(valCuaderno(f, c[1])))].map(esc).join(";")));
    const blob = new Blob(["﻿" + lineas.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${sel.key}_${(filtro || "todo").replace(/\W+/g, "-")}.csv`;
    a.click(); URL.revokeObjectURL(a.href);
    toast("Exportado — ábrelo en Excel");
  };

  const guardarEdicion = async form => {
    const r = await registroControl(form);
    if (r && r.ok) {
      toast(form.id ? "Registro actualizado" : "Registro creado");
      setEdit(null);
      recargar();
      cargarResumen();
    } else toast("Error: " + (r && r.error || "sin respuesta"));
  };

  /* ============================== HUB ================================== */
  if (!sel) {
    const porTipo = (resumen && resumen.registros && resumen.registros.porTipo) || {};
    const men = (resumen && resumen.mensual) || { total: 0, porMes: {}, huecos: 0 };
    const estDe = def => def.fuente === "mensual"
      ? { total: men.total, huecos: men.huecos, cruzan: null }
      : (porTipo[def.fuente] || { total: 0, huecos: 0, cruzan: 0 });
    const totalReg = Object.values(porTipo).reduce((s, o) => s + (o.total || 0), 0);
    return <>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <div>
            <h3 style={{ margin: 0 }}>Cuadernos de Control 2026</h3>
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
              Los cuadernos de siempre, dentro de la plataforma. Clic en un cuaderno para verlo, editar o imprimir su cargo.
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn sm" onClick={() => setVerFlujo(v => !v)}>{verFlujo ? "▲ Ocultar" : "ⓘ ¿Cómo funciona?"}</button>
            {resumen && resumen.sheetUrl &&
              <a className="btn sm" href={resumen.sheetUrl} target="_blank" rel="noreferrer">🔗 Google Sheet</a>}
            {esJefe && <button className="btn sm" disabled={regen} onClick={regenerar}>{regen ? "Regenerando…" : "🔄 Regenerar"}</button>}
          </div>
        </div>
        {/* resumen general */}
        {resumen && <div style={{ display: "flex", flexWrap: "wrap", gap: 22, marginTop: 12, paddingTop: 11, borderTop: "1px solid var(--bd)" }}>
          <Metric label="Padrón (reclamos)" value={nMil(men.total)} />
          <Metric label="Registros de control" value={nMil(totalReg)} />
          <Metric label="Cuadernos" value={CUADERNOS.length} />
          {resumen.generado && <Metric label="Actualizado" value={fmtF(resumen.generado)} />}
        </div>}
        {verFlujo && <ComoFunciona />}
        {!resumen && <div className="muted" style={{ marginTop: 12, fontSize: 12 }}>Cargando contadores… (tarda unos segundos)</div>}
      </Card>

      {/* cuadernos AGRUPADOS por fase del trabajo */}
      {GRUPOS.map(g => {
        const defs = g.keys.map(k => DEF_POR_KEY[k]).filter(Boolean);
        const sub = defs.reduce((s, d) => s + (estDe(d).total || 0), 0);
        return <div key={g.titulo} style={{ marginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: "1px solid var(--bd)", paddingBottom: 5, marginBottom: 9 }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: .6, textTransform: "uppercase", color: "var(--mut)" }}>{g.titulo}</span>
            {resumen && <span className="muted" style={{ fontSize: 11 }}>{nMil(sub)} registros</span>}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(215px,1fr))", gap: 10 }}>
            {defs.map(def => {
              const est = estDe(def);
              return <div key={def.key} className="clk" onClick={() => { setDeepLinked(false); abrirCuaderno(def); }}
                style={{ cursor: "pointer", background: "var(--card)", border: "1px solid var(--bd)", borderRadius: 10, padding: "11px 13px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--tx)", lineHeight: 1.25 }}>{def.nombre}</span>
                  <span style={{ fontSize: 20, fontWeight: 800, color: "var(--titulo,#16294B)", fontVariantNumeric: "tabular-nums" }}>{resumen ? nMil(est.total) : "—"}</span>
                </div>
                <div style={{ fontSize: 11, marginTop: 4, minHeight: 15 }}>
                  {est.cruzan != null && est.cruzan > 0 && <span className="muted">{nMil(est.cruzan)} con expediente</span>}
                  {est.huecos > 0 && <span style={{ color: "#B45309" }}>{est.cruzan ? " · " : ""}{nMil(est.huecos)} por llenar</span>}
                </div>
              </div>;
            })}
          </div>
        </div>;
      })}
    </>;
  }

  /* ========================= VISTA DE UN CUADERNO ======================= */
  return <>
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {onVolver && deepLinked && <button className="btn sm" style={{ fontWeight: 700 }} onClick={onVolver}>← Volver al expediente</button>}
          <button className="btn sm" onClick={() => { setSel(null); setFilas(null); setDeepLinked(false); }}>← Cuadernos</button>
          <b>{sel.emoji} {sel.nombre}</b>
          <span className="muted" style={{ fontSize: 11.5 }}>{filas ? filtradas.length + " filas" : "cargando…"}</span>
          {deepLinked && q && <span className="muted" style={{ fontSize: 11 }}>· filtrado a {q}</span>}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {opcionesFiltro.length > 0 &&
            <select value={filtro} onChange={e => { setFiltro(e.target.value); setDia(""); }} title="Filtrar por mes">
              <option value="">— mes —</option>
              {opcionesFiltro.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>}
          <label title={sel.fuente==="mensual" ? "Filtrar por fecha de registro del reclamo" : "Filtrar por FECHA exacta (para emitir el cargo de ese día)"} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11.5 }}>
            <span className="muted">📅 día</span>
            <input type="date" value={dia} onChange={e => { setDia(e.target.value); setFiltro(""); }} />
            {dia && <button className="btn sm" title="Quitar filtro de día" onClick={() => setDia("")}>✕</button>}
          </label>
          <input placeholder="🔎 buscar…" value={q} onChange={e => setQ(e.target.value)} style={{ minWidth: 130 }} />
          {sel.fuente !== "mensual" &&
            <button className="btn sm" onClick={() => setEdit({ tipo: sel.fuente, fecha_evento: dia || hoyISO() })}>➕ Registrar</button>}
          <button className="btn sm" title="Copia filas de tu Excel y pégalas aquí — se suben al sistema (no duplica)" onClick={() => setPegar(true)}>📋 Pegar de Excel</button>
          {sel.fuente !== "mensual"
            ? <button className="btn sm" title="Imprimir el cargo del período/día filtrado (ENTREGADO/RECIBIDO)" onClick={imprimirCargo}>🖨 Cargo</button>
            : <button className="btn sm" title="Imprimir / guardar como PDF la vista actual" onClick={imprimirTabla}>🖨 Imprimir (PDF)</button>}
          <button className="btn sm" title="Descargar la vista actual (respeta el filtro) para abrirla en Excel" onClick={exportarCSV}>🧮 Excel</button>
        </div>
      </div>
      <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>
        {sel.titulo} — clic en una fila abre la Sala del expediente; ✏ edita el registro (queda en bitácora).
        {" "}Para emitir un cargo de un día: elige 📅 <b>día</b> y pulsa 🖨 Cargo.
      </div>
    </Card>
    <Card>
      <div style={{ overflowX: "auto" }}>
        <table className="tbl">
          <thead><tr>
            <th>N°</th>
            {sel.semaforoElev && <th>⚠ ELEV</th>}
            {colsVista.map(c => <th key={c[0]}>{c[0]}</th>)}
            {sel.fuente !== "mensual" && <th></th>}
          </tr></thead>
          <tbody>
            {filas && filtradas.slice(0, tope).map((f, i) => {
              const rec = recDe(f);
              return <tr key={f.id || i} className={rec ? "clk" : ""}
                onClick={() => rec && setSelExp(rec.id)}
                title={rec ? "Abrir la Sala del expediente" : "Caso aún no cargado en la plataforma (2025 / ene-mar 2026)"}>
                <td>{i + 1}</td>
                {sel.semaforoElev && <td>{semaforoElev(f)}</td>}
                {colsVista.map(c => {
                  const v = valCuaderno(f, c[1]);
                  const esFecha = /^(\d{4})-(\d{2})-(\d{2})/.test(v);
                  return <td key={c[0]} style={!v ? { background: "#FFF8E6" } : undefined}>{esFecha ? fmtF(v) : v}</td>;
                })}
                {sel.fuente !== "mensual" &&
                  <td onClick={e => e.stopPropagation()}>
                    <button className="btn sm" title="Editar registro" onClick={() => setEdit({ ...f })}>✏</button>
                  </td>}
              </tr>;
            })}
            {filas && !filtradas.length && <tr><td colSpan={colsVista.length + 3} className="muted">Sin filas {filtro ? "para ese período" : "aún"}.</td></tr>}
          </tbody>
        </table>
      </div>
      {filas && filtradas.length > tope &&
        <button className="btn sm" style={{ marginTop: 8 }} onClick={() => setTope(tope + 500)}>Mostrar 500 más ({filtradas.length - tope} restantes)</button>}
      <div className="muted" style={{ fontSize: 10.5, marginTop: 6 }}>
        Celda ámbar = hueco (esa etapa aún no registró el dato — §9.4). Si un dato existe también en la etapa
        (datos_etapa), la vista generada del Google Sheet prefiere el de la etapa (primera fuente, firmada).
      </div>
    </Card>
    {edit && <EditorRegistro fila={edit} def={sel} onCerrar={() => setEdit(null)} onGuardar={guardarEdicion} />}
    {pegar && <PegarExcel def={sel} diaInicial={dia || hoyISO()} onCerrar={() => setPegar(false)} onSubir={subirPegado} />}
  </>;
}

/* ===== modal de alta/edición — CUADERNO-AWARE =====
 * Los campos y ETIQUETAS salen de las columnas reales del cuaderno (def.cols): el
 * formulario de «1ra Inspección» dice EJECUTADO/DEVUELTO en vez de «Fecha 2/3». Las
 * fechas llevan date-picker. Los campos `extra.*` se editan y se MERGEAN sin pisar los demás. */
function EditorRegistro({ fila, def, onCerrar, onGuardar }) {
  // cada campo sabe si es fecha (por su path base O porque su valor viene en ISO) → date-picker
  const campos = useMemo(() => camposEditables(def).map(c => {
    const raw = c.extra ? valCuaderno(fila, c.path) : (fila[c.path] != null ? String(fila[c.path]) : "");
    return { ...c, fecha: c.fecha || esISO(raw) };
  }), [def, fila]);
  const [form, setForm] = useState(() => {
    const o = { id: fila.id, tipo: fila.tipo || def.fuente };
    campos.forEach(c => {
      const v = c.extra ? valCuaderno(fila, c.path) : (fila[c.path] != null ? String(fila[c.path]) : "");
      o[c.path] = c.fecha && v ? String(v).slice(0, 10) : v;   // date-picker necesita YYYY-MM-DD
    });
    return o;
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const guardar = () => {
    const payload = { id: form.id, tipo: form.tipo, reclamo: form.reclamo };
    const extra = { ...extraDe(fila) };
    let hayExtra = false;
    campos.forEach(c => {
      if (c.extra) { extra[c.path.slice(6)] = form[c.path]; hayExtra = true; }
      else payload[c.path] = form[c.path];
    });
    if (hayExtra) payload.extra = extra;   // solo si el cuaderno tiene campos extra (los base quedan intactos)
    onGuardar(payload);
  };
  return <div className="modal-bg" onClick={onCerrar} style={{ position: "fixed", inset: 0, background: "rgba(22,41,75,.45)", zIndex: 90, display: "flex", alignItems: "center", justifyContent: "center" }}>
    <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, padding: 18, width: "min(620px,94vw)", maxHeight: "88vh", overflowY: "auto", boxShadow: "0 12px 40px rgba(0,0,0,.25)" }}>
      <h3 style={{ marginTop: 0 }}>{form.id ? "✏ Editar" : "➕ Registrar"} — {def.nombre}</h3>
      <div className="muted" style={{ fontSize: 11, marginBottom: 10 }}>
        Campos y nombres de <b>{def.nombre}</b> (los mismos del cuaderno). Las fechas se eligen del calendario;
        se muestran como dd/mm/aaaa. Todo cambio queda firmado en la bitácora.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {campos.map(c =>
          <label key={c.path} style={{ fontSize: 11.5, display: "flex", flexDirection: "column", gap: 3, gridColumn: c.ancho ? "1/-1" : undefined }}>
            <span className="muted">{c.label}</span>
            <input type={c.fecha ? "date" : "text"} value={form[c.path] || ""} onChange={e => set(c.path, e.target.value)} />
          </label>)}
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
        <button className="btn sm" onClick={onCerrar}>Cancelar</button>
        <button className="btn sm primary" onClick={guardar}>Guardar</button>
      </div>
    </div>
  </div>;
}

/* ===== guía para el TRABAJADOR: cómo trabajar esta sección (no es la arquitectura) ===== */
function ComoFunciona() {
  const tarjeta = (emoji, titulo, texto) => (
    <div style={{ flex: "1 1 240px", minWidth: 220, background: "var(--card2)", border: "1px solid var(--bd)", borderRadius: 10, padding: "11px 13px" }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--titulo,#16294B)" }}>{emoji} {titulo}</div>
      <div className="muted" style={{ fontSize: 11.5, marginTop: 4, lineHeight: 1.45 }}>{texto}</div>
    </div>
  );
  return (
    <div style={{ marginTop: 12, padding: 14, border: "1px dashed var(--bd)", borderRadius: 12, background: "var(--card)" }}>
      <div style={{ fontWeight: 700, color: "var(--titulo,#16294B)", marginBottom: 4 }}>¿Cómo trabajo en Cuadernos?</div>
      <div className="muted" style={{ fontSize: 12, marginBottom: 12 }}>
        Son los <b>mismos cuadernos de siempre</b>, ahora dentro de la plataforma. Abre un cuaderno tocando su
        tarjeta. Todo lo que hagas queda registrado con tu nombre (evidencia) y se sincroniza con el Sheet.
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {tarjeta("🔎", "Buscar un dato", "Abre el cuaderno y usa el buscador o filtra por 📅 día / mes. Toca una fila para abrir el expediente completo (Sala).")}
        {tarjeta("➕", "Registrar / ✏ corregir", "«➕ Registrar» agrega una fila; «✏» corrige una existente. Los campos son los del cuaderno (EJECUTADO, DEVUELTO…). Queda firmado.")}
        {tarjeta("📋", "Pegar desde tu Excel", "«📋 Pegar de Excel»: elige el día, copia las filas de tu Excel y pégalas. Se suben todas juntas. Pegar el mismo día otra vez actualiza (no duplica).")}
        {tarjeta("🖨️", "Emitir un cargo", "Elige el 📅 día y pulsa «🖨 Cargo»: sale el cargo de ESE día con ENTREGADO POR / RECIBIDO POR / DNI / FECHA-HORA para firmar.")}
        {tarjeta("🧮", "Llevarlo a Excel", "«🧮 Excel» descarga lo que estás viendo (respeta el filtro) para trabajarlo en tu Excel si lo necesitas.")}
        {tarjeta("🟡", "Celda amarilla = falta", "Una celda amarilla es un dato pendiente de llenar. Complétalo con ✏ o pegando el día.")}
      </div>
      <div className="muted" style={{ fontSize: 11, marginTop: 10 }}>
        ¿Dudas? El cuaderno «19 Apelaciones» además te marca en rojo/ámbar el plazo de elevación a JARU. Si un
        dato ya lo cargó otra etapa del expediente, ese manda — aquí lo verás igual.
      </div>
    </div>
  );
}

/* ===== 📋 PEGAR DESDE EXCEL: crear un día y subir filas copiadas del Excel local =====
 * El usuario copia celdas de su Excel (separadas por TAB) y las pega. Cada columna se
 * mapea, EN ORDEN, a las columnas del cuaderno (def.cols). El «día del cargo» se aplica
 * como fecha_evento a las filas que no traigan la suya. Subida = upsert idempotente. */
function PegarExcel({ def, diaInicial, onCerrar, onSubir }) {
  const esMensual = def.fuente === "mensual";
  // columnas a pegar: sin «N°» (item) ni «Origen» (lo pone el sistema). El resto, en orden.
  const cols = (def.cols || []).filter(c => c[1] && c[1] !== "item" && c[1] !== "origen");
  const [dia, setDia] = useState(diaInicial);
  const [texto, setTexto] = useState("");
  const [subiendo, setSubiendo] = useState(false);

  const filas = useMemo(() => {
    return String(texto || "").split(/\r?\n/).filter(l => l.trim()).map(linea => {
      const celdas = linea.split("\t");
      const row = {}, extra = {};
      cols.forEach((c, i) => {
        const path = c[1], val = (celdas[i] == null ? "" : String(celdas[i])).trim();
        if (path.indexOf("extra.") === 0) { if (val) extra[path.slice(6)] = val; }
        else if (val) row[path] = val;
      });
      if (Object.keys(extra).length) row.extra = extra;
      if (!esMensual && !row.fecha_evento && dia) row.fecha_evento = dia;
      return row;
    });
  }, [texto, dia]);

  const valFila = (row, path) => path.indexOf("extra.") === 0 ? (row.extra ? row.extra[path.slice(6)] || "" : "") : (row[path] || "");
  const subir = async () => { setSubiendo(true); await onSubir(filas); setSubiendo(false); };

  return <div className="modal-bg" onClick={onCerrar} style={{ position: "fixed", inset: 0, background: "rgba(22,41,75,.45)", zIndex: 90, display: "flex", alignItems: "center", justifyContent: "center" }}>
    <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, padding: 18, width: "min(900px,96vw)", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 12px 40px rgba(0,0,0,.25)" }}>
      <h3 style={{ marginTop: 0 }}>📋 Pegar desde Excel — {def.nombre}</h3>
      <div className="muted" style={{ fontSize: 11.5, marginBottom: 8 }}>
        Copia de tu Excel <b>solo estas columnas, en este orden</b> (NO copies la columna «N°», y pega SIN encabezado).
        Pegar dos veces la misma fila la <b>actualiza</b>, no la duplica.
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 10 }}>
        {cols.map((c, i) => <span key={c[0]} style={{ fontSize: 10.5, background: "var(--card2)", border: "1px solid var(--bd)", borderRadius: 6, padding: "2px 7px" }}>{i + 1}. {c[0]}</span>)}
      </div>
      {!esMensual &&
        <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <span className="muted">📅 Día del cargo (fecha del evento):</span>
          <input type="date" value={dia} onChange={e => setDia(e.target.value)} />
          <span className="muted" style={{ fontSize: 10.5 }}>se aplica a las filas sin fecha propia</span>
        </label>}
      {esMensual &&
        <div className="muted" style={{ fontSize: 10.5, marginBottom: 8 }}>El mes del padrón se toma solo de la columna «FechaRegistroReclamo».</div>}
      <textarea value={texto} onChange={e => setTexto(e.target.value)} placeholder="Pega aquí (Ctrl+V) las filas copiadas de tu Excel…"
        style={{ width: "100%", minHeight: 120, fontFamily: "ui-monospace,monospace", fontSize: 12, boxSizing: "border-box" }} />
      {filas.length > 0 && <>
        <div className="muted" style={{ fontSize: 11.5, margin: "10px 0 4px" }}>Vista previa — {filas.length} fila(s) a subir:</div>
        <div style={{ overflowX: "auto", maxHeight: 240, border: "1px solid var(--bd)", borderRadius: 8 }}>
          <table className="tbl"><thead><tr><th>N°</th>{cols.map(c => <th key={c[0]}>{c[0]}</th>)}</tr></thead>
            <tbody>{filas.slice(0, 100).map((row, i) => <tr key={i}>
              <td>{i + 1}</td>{cols.map(c => { const v = valFila(row, c[1]); return <td key={c[0]}>{esISO(v) ? fmtF(v) : v}</td>; })}
            </tr>)}</tbody></table>
        </div>
      </>}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12, alignItems: "center" }}>
        <span className="muted" style={{ fontSize: 10.5, marginRight: "auto" }}>Pegar el mismo día otra vez actualiza, no duplica.</span>
        <button className="btn sm" onClick={onCerrar}>Cancelar</button>
        <button className="btn sm primary" disabled={!filas.length || subiendo} onClick={subir}>{subiendo ? "Subiendo…" : `Subir ${filas.length} fila(s)`}</button>
      </div>
    </div>
  </div>;
}
