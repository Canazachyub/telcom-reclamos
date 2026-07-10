import { useEffect, useMemo, useState } from "react";
import { Card, toast, SkeletonCard } from "./ui.jsx";
import { loadCuadernosResumen, loadCuadernoDatos, registroControl, regenerarCuadernos, cuadernosBulk } from "../lib/api.js";
import { CUADERNOS, MESES_NOMBRE, valCuaderno } from "../lib/cuadernosDef.js";
import { imprimirQRs } from "../lib/qr.js";
import { fmtF, hoyISO, fmtCel, nombreCuaderno, TIPOS_TEMATICOS, DEF_TODOS } from "./cuadernos/defs.js";
import { HubCuadernos } from "./cuadernos/HubCuadernos.jsx";
import { VistaUnificada } from "./cuadernos/VistaUnificada.jsx";
import { VistaCuaderno } from "./cuadernos/VistaCuaderno.jsx";
import { EditorRegistro } from "./cuadernos/EditorRegistro.jsx";
import { PegarExcel } from "./cuadernos/PegarExcel.jsx";

// ===================== 📒 CUADERNOS DE CONTROL 2026 =====================
// Los 22 Excel del sistema anterior, vivos DENTRO de la plataforma (V2_06):
// - hub de tarjetas con contadores y huecos (celda vacía = pendiente real §9.4)
// - vista de cada cuaderno con SUS títulos/columnas de siempre; la periodicidad
//   (encabezados-fecha del Excel) volvió como filtro/agrupación por fecha_evento
// - fila clickeable → Sala del expediente · ✏ editar / ➕ registrar (bitácora firmada)
// - 🖨 cargo imprimible con ENTREGADO/RECIBIDO en blanco (el papel de siempre)

export default function Cuadernos({ data, setSelExp, perfil, abrir, onAbierto, onVolver }) {
  const [resumen, setResumen] = useState(null);
  const [sel, setSel] = useState(null);            // def del cuaderno abierto
  const [filas, setFilas] = useState(null);
  const [filtro, setFiltro] = useState("");        // mes (mensual) o mes de fecha_evento
  const [dia, setDia] = useState("");              // FECHA exacta (YYYY-MM-DD) — filtro fino por día
  const [tipoTodos, setTipoTodos] = useState("");  // filtro por cuaderno en la vista unificada ('todos')
  const [expUnif, setExpUnif] = useState("");      // reclamo expandido en la vista unificada (detalle por hoja)
  const [usr, setUsr] = useState("");              // filtro por TRABAJADOR (quién registró) — para jefes
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
    setSel(def); setFilas(null); setFiltro(""); setDia(""); setTipoTodos(""); setExpUnif(""); setUsr(""); setQ(q || ""); setTope(300);
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
  // valor de celda; la vista unificada tiene una columna virtual "__cuaderno" = nombre del cuaderno
  const celdaValor = (f, path) => path === "__cuaderno" ? nombreCuaderno(f.tipo) : valCuaderno(f, path);
  const filtradas = useMemo(() => {
    if (!filas) return [];
    let out = filas;
    if (sel && sel.fuente === "todos" && tipoTodos) out = out.filter(f => String(f.tipo) === tipoTodos);  // filtro por cuaderno
    if (sel && dia) {                                   // FECHA exacta manda sobre el mes
      out = out.filter(f => String(f[fechaCampo] || "").slice(0, 10) === dia);
    } else if (sel && filtro) {
      out = sel.fuente === "mensual"
        ? out.filter(f => String(f.mes) === filtro)
        : out.filter(f => String(f.fecha_evento || "").slice(0, 7) === filtro);
    }
    if (usr) out = out.filter(f => String(f.usuario || "") === usr);   // por trabajador (quién registró)
    if (q.trim()) {
      const t = q.trim().toUpperCase();
      out = out.filter(f => JSON.stringify(f).toUpperCase().includes(t));
    }
    return out;
  }, [filas, filtro, dia, q, sel, tipoTodos, usr]);

  // trabajadores presentes en este cuaderno (para el selector de jefes)
  const usuarios = useMemo(() => {
    if (!filas) return [];
    const m = {};
    filas.forEach(f => { const u = String(f.usuario || "").trim(); if (u) m[u] = (m[u] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [filas]);

  // VISTA UNIFICADA agrupada: UNA fila por EXPEDIENTE (reclamo), con los cuadernos por los que pasó.
  // (Antes eran 9,974 filas planas repitiendo suministros — inútil. Ahora se consolida por caso.)
  const porExpediente = useMemo(() => {
    if (!sel || sel.fuente !== "todos" || !filas) return { filas: [], sinReclamo: 0 };
    const m = {}; let sinReclamo = 0;
    filtradas.forEach(r => {
      const k = String(r.reclamo || "").trim();
      if (!k) { sinReclamo++; return; }
      const g = m[k] || (m[k] = { reclamo: k, suministro: "", cuadernos: {}, ultima: "", n: 0 });
      g.n++;
      if (!g.suministro && r.suministro) g.suministro = String(r.suministro);
      g.cuadernos[r.tipo] = (g.cuadernos[r.tipo] || 0) + 1;
      const f = String(r.fecha_evento || "").slice(0, 10);
      if (f > g.ultima) g.ultima = f;
    });
    const arr = Object.values(m).sort((a, b) => (b.ultima || "").localeCompare(a.ultima || ""));
    return { filas: arr, sinReclamo };
  }, [filtradas, filas, sel]);

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

  // ===== impresión FORMAL y compacta (cargos + padrón): membrete, tabla densa, encabezado
  //       repetido por página, listo para imprimir y entregar. Estilo compartido. =====
  const IMP_STYLE = `
    @page{size:landscape;margin:10mm 8mm}
    *{box-sizing:border-box}
    body{font-family:Arial,Helvetica,sans-serif;font-size:8px;color:#000;margin:0}
    .head{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:1.5px solid #000;padding-bottom:3px;margin-bottom:6px}
    .head .emp{font-weight:bold;font-size:11px;line-height:1.05}
    .head .con{font-size:6.8px;color:#222;margin-top:1px}
    .head .fol{font-size:6.8px;color:#444;text-align:right;white-space:nowrap}
    .tit{font-size:8.5px;font-weight:bold;text-transform:uppercase;margin:5px 0 1px}
    .met{font-size:6.8px;color:#333;margin-bottom:3px}
    table{border-collapse:collapse;width:100%;table-layout:fixed;margin-bottom:3px}
    th,td{border:.5px solid #666;padding:1px 3px;text-align:left;vertical-align:top;font-size:7px;line-height:1.12;word-wrap:break-word;overflow-wrap:anywhere}
    th{background:#e8e8e8;font-weight:bold;font-size:6.4px;text-transform:uppercase}
    thead{display:table-header-group}
    tr{page-break-inside:avoid}
    td.n,th.n{width:18px;text-align:center}
    .firmas{display:flex;gap:24px;flex-wrap:wrap;margin:7px 0 13px;page-break-inside:avoid}
    .firmas .c{flex:1 1 40%;min-width:220px}
    .firmas .lab{font-size:6.8px;font-weight:bold}
    .firmas .ln{border-bottom:.7px solid #000;height:15px;margin-top:8px}
    .firmas .sub{font-size:6px;color:#555;margin-top:1px}
  `;
  const impHead = fol => `<div class="head">
    <div><div class="emp">INGENIERIA TELCOM E.I.R.L.</div>
      <div class="con">RUC 20602277900 · CP-026-2026-ELSE · Atención de Reclamos — Electro Sur Este S.A.A.</div></div>
    <div class="fol">${fol || ""}</div></div>`;
  const _thead = `<thead><tr><th class="n">N°</th>${colsVista.map(c => `<th>${c[0]}</th>`).join("")}</tr></thead>`;
  const _trs = arr => arr.map((f, i) => `<tr><td class="n">${i + 1}</td>${colsVista.map(c => `<td>${fmtCel(celdaValor(f, c[1]))}</td>`).join("")}</tr>`).join("");
  const _abrirImprimir = html => { const w = window.open("", "_blank"); w.document.write(html); w.document.close(); w.focus(); w.print(); };

  // 🖨 cargo imprimible: bloques por fecha con ENTREGADO/RECIBIDO/FIRMA para firmar y entregar.
  const imprimirCargo = () => {
    const porFecha = {};
    filtradas.forEach(f => { const k = String(f.fecha_evento || "s/f").slice(0, 10); (porFecha[k] = porFecha[k] || []).push(f); });
    const firmas = `<div class="firmas">
        <div class="c"><div class="lab">ENTREGADO POR</div><div class="ln"></div><div class="sub">Nombre · DNI · firma</div></div>
        <div class="c"><div class="lab">RECIBIDO POR</div><div class="ln"></div><div class="sub">Nombre · DNI · firma y sello</div></div>
        <div class="c"><div class="lab">FECHA / HORA</div><div class="ln"></div></div>
      </div>`;
    const bloques = Object.keys(porFecha).sort().map(fecha =>
      `<div class="tit">${sel.titulo}${fecha !== "s/f" ? " — " + fmtF(fecha) : ""}</div>
       <div class="met">${porFecha[fecha].length} registro(s)</div>
       <table>${_thead}<tbody>${_trs(porFecha[fecha])}</tbody></table>${firmas}`).join("");
    _abrirImprimir(`<html><head><title>Cargo — ${sel.nombre} — ${periodoLabel()}</title><style>${IMP_STYLE}</style></head><body>
      ${impHead("Período: " + periodoLabel() + " · " + new Date().toLocaleString("es-PE"))}
      ${bloques}</body></html>`);
  };

  // filas para export/impresión: agrupadas por EXPEDIENTE en «todos», planas en el resto.
  const filasVistaExport = () => {
    if (sel.fuente === "todos") {
      const head = ["N°", "Reclamo", "Suministro", "Reclamante", "Cuadernos", "Últ. fecha"];
      const rows = porExpediente.filas.map((g, i) => {
        const rec = recDe({ reclamo: g.reclamo });
        return [i + 1, rec ? rec.osinerg : g.reclamo, g.suministro || (rec ? rec.suministro : ""), rec ? rec.solicitante : "",
          Object.keys(g.cuadernos).map(nombreCuaderno).join(" · "), g.ultima ? fmtF(g.ultima) : ""];
      });
      return { head, rows };
    }
    const head = ["N°", ...colsVista.map(c => c[0])];
    const rows = filtradas.map((f, i) => [i + 1, ...colsVista.map(c => fmtCel(celdaValor(f, c[1])))]);
    return { head, rows };
  };

  // 🖨 imprimir / PDF: la vista actual (respeta el filtro) como tabla formal densa.
  const imprimirTabla = () => {
    const { head, rows } = filasVistaExport();
    const thead = `<thead><tr>${head.map(h => `<th>${h}</th>`).join("")}</tr></thead>`;
    const trs = rows.map(r => `<tr>${r.map(c => `<td>${c == null ? "" : c}</td>`).join("")}</tr>`).join("");
    _abrirImprimir(`<html><head><title>${sel.nombre} — ${periodoLabel()}</title><style>${IMP_STYLE}</style></head><body>
      ${impHead(new Date().toLocaleString("es-PE"))}
      <div class="tit">${sel.titulo || sel.nombre}</div>
      <div class="met">Período: <b>${periodoLabel()}</b> · ${rows.length} ${sel.fuente === "todos" ? "expediente(s)" : "registro(s)"}</div>
      <table>${thead}<tbody>${trs}</tbody></table>
      </body></html>`);
  };

  // 🏷 items para imprimir QRs (por suministro): de la vista actual (agrupada o plana)
  const qrItems = () => {
    if (sel.fuente === "todos") return porExpediente.filas.map(g => { const rec = recDe({ reclamo: g.reclamo }); return { suministro: g.suministro || (rec ? rec.suministro : ""), reclamante: rec ? rec.solicitante : "", osinerg: rec ? rec.osinerg : g.reclamo }; });
    return filtradas.map(f => { const rec = recDe(f); return { suministro: f.suministro || (rec ? rec.suministro : ""), reclamante: f.reclamante || (rec ? rec.solicitante : ""), osinerg: f.numero_osinerg || (rec ? rec.osinerg : "") || f.reclamo }; });
  };

  // 🧮 exportar a Excel/CSV la vista actual (para trabajarla también en Excel). Sin fugas: solo lo filtrado.
  const exportarCSV = () => {
    const esc = v => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
    const { head, rows } = filasVistaExport();
    const lineas = [head.map(esc).join(";"), ...rows.map(r => r.map(esc).join(";"))];
    const blob = new Blob(["﻿" + lineas.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${sel.key}_${(filtro || tipoTodos || "todo").replace(/\W+/g, "-")}.csv`;
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

  if (!sel) {
    return <HubCuadernos resumen={resumen} esJefe={esJefe} regen={regen} regenerar={regenerar}
      verFlujo={verFlujo} setVerFlujo={setVerFlujo}
      onAbrirCuaderno={def => { setDeepLinked(false); abrirCuaderno(def); }}
      onAbrirTodos={() => abrirCuaderno(DEF_TODOS)} />;
  }

  /* ========================= VISTA DE UN CUADERNO ======================= */
  return <>
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {onVolver && deepLinked && <button className="btn sm" style={{ fontWeight: 700 }} onClick={onVolver}>← Volver al expediente</button>}
          <button className="btn sm" onClick={() => { setSel(null); setFilas(null); setDeepLinked(false); setUsr(""); }}>← Cuadernos</button>
          <b>{sel.emoji} {sel.nombre}</b>
          <span className="muted" style={{ fontSize: 11.5 }}>{filas ? filtradas.length + " filas" : "cargando…"}</span>
          {deepLinked && q && <span className="muted" style={{ fontSize: 11 }}>· filtrado a {q}</span>}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {sel.fuente === "todos" &&
            <select value={tipoTodos} onChange={e => setTipoTodos(e.target.value)} title="Filtrar por cuaderno">
              <option value="">— todos los cuadernos —</option>
              {TIPOS_TEMATICOS.map(d => <option key={d.fuente} value={d.fuente}>{d.nombre}</option>)}
            </select>}
          {opcionesFiltro.length > 0 &&
            <select value={filtro} onChange={e => { setFiltro(e.target.value); setDia(""); }} title="Filtrar por mes">
              <option value="">— mes —</option>
              {opcionesFiltro.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>}
          <label title={sel.fuente==="mensual" ? "Filtrar por fecha de registro del reclamo" : "Filtrar por FECHA exacta"} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11.5 }}>
            <span className="muted">📅 día</span>
            <input type="date" value={dia} onChange={e => { setDia(e.target.value); setFiltro(""); }} />
            {dia && <button className="btn sm" title="Quitar filtro de día" onClick={() => setDia("")}>✕</button>}
          </label>
          {usuarios.length > 1 &&
            <select value={usr} onChange={e => setUsr(e.target.value)} title="Filtrar por quién registró (trabajador)">
              <option value="">👤 trabajador</option>
              {usuarios.map(([u, n]) => <option key={u} value={u}>{u} ({n})</option>)}
            </select>}
          <input placeholder="🔎 buscar…" value={q} onChange={e => setQ(e.target.value)} style={{ minWidth: 130 }} />
          {sel.fuente !== "mensual" && sel.fuente !== "todos" &&
            <button className="btn sm" onClick={() => setEdit({ tipo: sel.fuente, fecha_evento: dia || hoyISO() })}>➕ Registrar</button>}
          {sel.fuente !== "todos" &&
            <button className="btn sm" title="Copia filas de tu Excel y pégalas aquí — se suben al sistema (no duplica)" onClick={() => setPegar(true)}>📋 Pegar de Excel</button>}
          {(sel.fuente !== "mensual" && sel.fuente !== "todos")
            ? <button className="btn sm" title="Imprimir el cargo del período/día filtrado (ENTREGADO/RECIBIDO)" onClick={imprimirCargo}>🖨 Cargo</button>
            : <button className="btn sm" title="Imprimir / guardar como PDF la vista actual" onClick={imprimirTabla}>🖨 Imprimir (PDF)</button>}
          <button className="btn sm" title="Descargar la vista actual (respeta el filtro) para abrirla en Excel" onClick={exportarCSV}>🧮 Excel</button>
          <button className="btn sm" title="Imprimir etiquetas QR (por suministro) de lo filtrado — se pegan en el libro físico" onClick={() => imprimirQRs(qrItems(), sel.nombre + " — " + periodoLabel())}>🏷 QRs</button>
        </div>
      </div>
      <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>
        {sel.titulo} — clic en una fila abre la Sala del expediente.
        {sel.fuente === "todos"
          ? " Filtra por Cuaderno, mes/día o busca (código, suministro, nombre…). Para editar, entra al cuaderno específico."
          : sel.fuente === "mensual" ? "" : " ✏ edita el registro (queda en bitácora). Para un cargo de un día: elige 📅 día y pulsa 🖨 Cargo."}
      </div>
    </Card>
    {filas === null ? (
      <SkeletonCard rows={6} />
    ) : sel.fuente === "todos" ? (
      <VistaUnificada porExpediente={porExpediente} tipoTodos={tipoTodos} filtradas={filtradas} recDe={recDe}
        setSelExp={setSelExp} tope={tope} setTope={setTope} expUnif={expUnif} setExpUnif={setExpUnif} />
    ) : (
      <VistaCuaderno sel={sel} filas={filas} filtradas={filtradas} colsVista={colsVista} celdaValor={celdaValor}
        recDe={recDe} setSelExp={setSelExp} setEdit={setEdit} filtro={filtro} tope={tope} setTope={setTope} />
    )}
    {edit && <EditorRegistro fila={edit} def={sel} onCerrar={() => setEdit(null)} onGuardar={guardarEdicion} />}
    {pegar && <PegarExcel def={sel} diaInicial={dia || hoyISO()} onCerrar={() => setPegar(false)} onSubir={subirPegado} />}
  </>;
}
