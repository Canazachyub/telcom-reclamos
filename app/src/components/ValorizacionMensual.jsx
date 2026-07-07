import { useMemo, useState } from "react";
import { Card, Tag, toast } from "./ui.jsx";
import { parseFecha, fmtFecha, esDiaHabil } from "../lib/model.js";
import { postAction } from "../lib/api.js";

// ===================== Valorización mensual OFICIAL (Ola 7) =====================
// Genera las relaciones exigidas por las bases del CP-026-2026-ELSE para sustentar
// la valorización del mes: cuadro de avance (a) + 6 relaciones (b..g) + checklist +
// ciclo de presentación (presentada/observada/conforme). Fuente de verdad: `datos`
// (registros tipo=datos por exp+etapa) y `registros` (tipo=ticket/evidencia/reporte).

const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
const pad2 = n => String(n).padStart(2, "0");
const ymKey = (y, m) => `${y}-${pad2(m + 1)}`; // m = 0..11
const hoyISO = () => new Date().toISOString().slice(0, 10);

// detalle de un registro -> objeto (mismo patrón que el resto del código)
function det(r) {
  try { return typeof r.detalle === "string" ? JSON.parse(r.detalle) : (r.detalle || {}); }
  catch (e) { return {}; }
}
function fechaISO(v) {
  // acepta ISO ("2026-06-20T...") o dd/mm/aaaa (formato SIELSE) -> "YYYY-MM-DD" o null
  if (!v) return null;
  const s = String(v);
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0].slice(0, 10);
  const d = parseFecha(s);
  if (d) return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  return null;
}
function enMes(iso, ymk) { return !!iso && iso.slice(0, 7) === ymk; }

// Días hábiles sumados a una fecha — para el 3er día hábil del mes siguiente.
// USA el motor central (lun-vie SIN feriados Perú): un feriado a inicio de mes
// corre la fecha real de presentación de la valorización.
function sumarHabiles(date, n) {
  const d = new Date(date);
  let restante = n;
  while (restante > 0) {
    d.setDate(d.getDate() + 1);
    if (esDiaHabil(d)) restante--;
  }
  return d;
}
function tercerHabilSiguiente(anio, mes /*0..11*/) {
  // día 0 del mes siguiente = último día del mes actual; sumamos 3 hábiles desde ahí
  const finMes = new Date(anio, mes + 1, 0);
  return sumarHabiles(finMes, 3);
}

// ---- CSV export (BOM para Excel) ----
function exportarCSV(nombre, columnas, filas) {
  const esc = v => {
    const s = v == null ? "" : String(v);
    return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const lineas = [columnas.map(esc).join(";"), ...filas.map(f => f.map(esc).join(";"))];
  const bom = "﻿";
  const blob = new Blob([bom + lineas.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nombre; document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

function TablaRelacion({ id, titulo, nota, columnas, filas, nombreArchivo }) {
  return (
    <Card className="valm-bloque" style={{ marginTop: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <h3 style={{ margin: 0 }}>{titulo} ({filas.length})</h3>
        <button className="btn sm" onClick={() => exportarCSV(nombreArchivo, columnas, filas)}>⬇ CSV</button>
      </div>
      {nota && <div className="muted" style={{ fontSize: 11.5, margin: "6px 0" }}>{nota}</div>}
      <div style={{ overflowX: "auto" }}>
        <table className="tbl">
          <thead><tr>{columnas.map(c => <th key={c}>{c}</th>)}</tr></thead>
          <tbody>
            {filas.map((f, i) => <tr key={i}>{f.map((v, j) => <td key={j}>{v == null || v === "" ? "—" : v}</td>)}</tr>)}
            {!filas.length && <tr><td colSpan={columnas.length} className="muted" style={{ textAlign: "center", padding: 12 }}>Sin registros en el mes elegido.</td></tr>}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export default function ValorizacionMensual({ data, tickets, evidencias, registros, datos, config, perfil }) {
  const HOY = new Date();
  // Default: mes anterior si estamos en los primeros 5 días naturales del mes; si no, el actual.
  const defAnio = HOY.getDate() <= 5 ? (HOY.getMonth() === 0 ? HOY.getFullYear() - 1 : HOY.getFullYear()) : HOY.getFullYear();
  const defMes = HOY.getDate() <= 5 ? (HOY.getMonth() === 0 ? 11 : HOY.getMonth() - 1) : HOY.getMonth();
  const [anio, setAnio] = useState(defAnio);
  const [mes, setMes] = useState(defMes); // 0..11
  const ymk = ymKey(anio, mes);
  const mesLabel = `${MESES[mes]} ${anio}`;
  const mesSigLabel = MESES[(mes + 1) % 12];

  const puedeCiclo = perfil && (perfil.rol === "GERENTE" || perfil.rol === "COORDINADOR");

  // ---- Plazo de presentación: 3er día hábil del mes siguiente al elegido ----
  const limitePresentacion = useMemo(() => tercerHabilSiguiente(anio, mes), [anio, mes]);
  const limiteISO = limitePresentacion.toISOString().slice(0, 10);
  const yaPaso = hoyISO() > limiteISO;
  const diasRetraso = yaPaso ? Math.max(0, Math.round((new Date(hoyISO()) - new Date(limiteISO)) / 86400000)) : 0;

  const dat = datos || {};
  const regs = registros || [];

  // ---- (b) ACT-01: Resolución/Firmas terminados en el mes ----
  // Criterio EN PANTALLA (nota visible): un ticket de etapa "Resolución" o "Firmas" con
  // estado=hecho; se cruza su fecha de cierre en `registros` tipo=ticket (detalle.estado=hecho,
  // fecha del registro) contra reclamo+etapa. Si el caso no tiene ese registro (datos históricos
  // sin bitácora v2), se usa datos[exp+"|Resolución"].FECHA_RESOLUCION o FECHA_EMISION_RES como
  // respaldo — así no se pierde el caso solo por falta de bitácora.
  const cierresTicket = {}; // "reclamo|etapa" -> fecha ISO más reciente en que quedó "hecho"
  regs.filter(r => r.tipo === "ticket").forEach(r => {
    const d = det(r);
    if (d.estado !== "hecho") return;
    const etapaEv = d.etapa || "";
    const k = String(r.reclamo) + "|" + etapaEv;
    const f = fechaISO(r.fecha);
    if (f && (!cierresTicket[k] || f > cierresTicket[k])) cierresTicket[k] = f;
  });

  const act01 = [];
  (data || []).forEach(x => {
    const kRes = x.codigo + "|Resolución", kFir = x.codigo + "|Firmas";
    let f = cierresTicket[kRes] || cierresTicket[kFir];
    if (!f) {
      const dRes = dat[kRes] || {};
      f = fechaISO(dRes.FECHA_RESOLUCION) || fechaISO(dRes.FECHA_EMISION_RES);
    }
    if (f && enMes(f, ymk)) {
      const dRes = dat[kRes] || {};
      act01.push({
        codigo: x.codigo, osinerg: x.osinerg, solicitante: x.solicitante,
        sentido: dRes.SENTIDO_RESOLUCION || dRes.SENTIDO_FALLO || x.tipoRes || "—",
        fecha: f,
      });
    }
  });

  // ---- (c) ACT-02: apelaciones elevadas en el mes (FECHA_ELEVACION en datos etapa Apelación) ----
  const act02 = [];
  (data || []).forEach(x => {
    const dApe = dat[x.codigo + "|Apelación (JARU)"];
    if (!dApe) return;
    const f = fechaISO(dApe.FECHA_ELEVACION);
    if (f && enMes(f, ymk)) act02.push({ codigo: x.codigo, osinerg: x.osinerg, suministro: x.suministro, fecha: f, expJaru: dApe.N_EXPEDIENTE_JARU || "—" });
  });

  // ---- (d) ACT-03: expedientes cerrados en 1ª instancia en el mes (solo SIELSE, salvo apelación) ----
  const act03 = [];
  (data || []).forEach(x => {
    const kCierre = x.codigo + "|Cierre";
    let f = cierresTicket[kCierre];
    if (!f) {
      const dCie = dat[kCierre] || {};
      f = fechaISO(dCie.FECHA_CIERRE);
    }
    if (!f && x.estado === "Cerrado") f = fechaISO(x.fechaSol);
    if (f && enMes(f, ymk)) act03.push({ codigo: x.codigo, osinerg: x.osinerg, suministro: x.suministro, fecha: f });
  });

  // ---- (e) ACT-04: entregas de muestra del mes. MuestraTrimestral las registra como
  // tipo='reporte' con detalle.tipo_muestra='entrega' (se acepta también tipo='muestra' por si acaso).
  const act04 = regs.filter(r => {
    if (!enMes(fechaISO(r.fecha), ymk)) return false;
    if (r.tipo === "muestra") return true;
    if (r.tipo !== "reporte") return false;
    const d = det(r); return !!d.tipo_muestra;
  }).map(r => {
    const d = det(r);
    const nExp = d.items || d.expedientes || d.cantidad || (Array.isArray(d.expedientes) ? d.expedientes.length : null) || (Array.isArray(d.codigos) ? d.codigos.length : "—");
    return { item: d.item || d.nombre || "entrega", expedientes: Array.isArray(nExp) ? nExp.length : nExp, fecha: fechaISO(r.fecha) };
  });

  // ---- (f) ACT-05: notificaciones notariales en el mes ----
  const act05 = [];
  (data || []).forEach(x => {
    const dNot = dat[x.codigo + "|Notificación"];
    if (!dNot) return;
    const f = fechaISO(dNot.FECHA_NOTIFICACION_NOTARIAL);
    if (f && enMes(f, ymk)) act05.push({ codigo: x.codigo, osinerg: x.osinerg, fecha: f });
  });

  // ---- (g) Acta de capacitación mensual (evidencia con nombre que contenga "capacit") ----
  const actaCapacitacion = (regs.filter(r => r.tipo === "evidencia").some(r => {
    const d = det(r);
    return /capacit/i.test(d.nombre || "") && enMes(fechaISO(r.fecha), ymk);
  })) || (evidencias || []).some(e => /capacit/i.test(e.nombre || "") && enMes(fechaISO(e.fecha), ymk));

  // ---- (a) Cuadro de avance ACT x cantidad x P.U. x subtotal ----
  const puNum = (k, fb) => { const v = config && config[k]; const n = typeof v === "string" ? parseFloat(v) : v; return (typeof n === "number" && !isNaN(n)) ? n : fb; };
  const PU = { ACT01: puNum("PU_ACT01", 45), ACT02: puNum("PU_ACT02", 60), ACT03: puNum("PU_ACT03", 25), ACT04: puNum("PU_ACT04", 0), ACT05: puNum("PU_ACT05", 18) };
  const cuadro = [
    { act: "ACT-01", nombre: "Resoluciones / trato directo", cant: act01.length, pu: PU.ACT01 },
    { act: "ACT-02", nombre: "Elevación de apelaciones", cant: act02.length, pu: PU.ACT02 },
    { act: "ACT-03", nombre: "Tramitación (cerrados SIELSE)", cant: act03.length, pu: PU.ACT03 },
    { act: "ACT-04", nombre: "Muestra trimestral OSINERGMIN", cant: act04.length, pu: PU.ACT04 },
    { act: "ACT-05", nombre: "Notificación notarial", cant: act05.length, pu: PU.ACT05 },
  ];
  const totalMes = cuadro.reduce((s, r) => s + r.cant * r.pu, 0);

  // ---- Estado del ciclo (presentada / observada / conforme) leído de registros tipo=reporte ----
  const eventosCiclo = regs.filter(r => r.tipo === "reporte").map(r => ({ ...det(r), fecha: r.fecha, usuario: r.usuario }))
    .filter(d => d.tipo_valorizacion && d.mes === ymk)
    .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
  const ultimoEstado = eventosCiclo.length ? eventosCiclo[eventosCiclo.length - 1] : null;

  function marcarCiclo(estado) {
    postAction("reporte", { tipo_valorizacion: estado, mes: ymk }).then(r => {
      if (r && r.ok !== false) toast("Registrado: " + estado + " (" + mesLabel + ")");
      else toast("⚠ No se guardó: " + ((r && r.error) || "error"));
    });
  }

  // ---- checklist de presentación ----
  const checklist = [
    { k: "factura", label: "Factura del mes", ok: null },
    { k: "resumen", label: "Resumen de trabajos realizados", ok: null },
    { k: "act01", label: "Relación ACT-01 (resoluciones / trato directo)", ok: act01.length > 0 },
    { k: "act02", label: "Relación ACT-02 (apelaciones elevadas)", ok: act02.length > 0 },
    { k: "act03", label: "Relación ACT-03 (expedientes tramitados/cerrados)", ok: act03.length > 0 },
    { k: "act04", label: "Relación ACT-04 (muestra trimestral, si corresponde este mes)", ok: act04.length > 0 },
    { k: "act05", label: "Relación ACT-05 (notificaciones notariales)", ok: act05.length > 0 },
    { k: "acta", label: "Acta de capacitación mensual con fotos fechadas", ok: actaCapacitacion },
  ];

  const anios = Array.from({ length: 3 }, (_, i) => HOY.getFullYear() - 1 + i);

  return (
    <div className="valm-print">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .valm-print, .valm-print * { visibility: visible; }
          .valm-print { position: absolute; left: 0; top: 0; width: 100%; }
          .valm-noprint { display: none !important; }
        }
      `}</style>

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <h3 style={{ margin: 0 }}>Valorización mensual oficial — CP-026-2026-ELSE</h3>
          <div className="valm-noprint" style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <select className="flt" value={mes} onChange={e => setMes(+e.target.value)}>
              {MESES.map((m, i) => <option key={m} value={i}>{m}</option>)}
            </select>
            <select className="flt" value={anio} onChange={e => setAnio(+e.target.value)}>
              {anios.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <button className="btn sm valm-noprint" onClick={() => window.print()}>🖨 Imprimir</button>
          </div>
        </div>
        <div className="note" style={{
          marginTop: 10,
          background: yaPaso ? "#FDE7E7" : "#FEF3DF",
          border: `1px solid ${yaPaso ? "#F3B4B4" : "#F0C36D"}`,
          color: yaPaso ? "#DC2626" : "#B45309",
        }}>
          {yaPaso
            ? `⛔ Plazo vencido: debía presentarse hasta el 3er día hábil de ${mesSigLabel} (${fmtFecha(limiteISO.split("-").reverse().join("/"))}) — penalidad 3.1: S/100/día de retraso. Retraso estimado: ${diasRetraso} día(s).`
            : `⚠ Presentar hasta el 3er día hábil de ${mesSigLabel} (${fmtFecha(limiteISO.split("-").reverse().join("/"))}) — penalidad 3.1: S/100/día de retraso.`}
        </div>
        {ultimoEstado && (
          <div className="row" style={{ marginTop: 10 }}>
            <span>Estado actual del ciclo — <b>{mesLabel}</b></span>
            <Tag bg={ultimoEstado.tipo_valorizacion === "conforme" ? "#1E8E5A" : ultimoEstado.tipo_valorizacion === "observada" ? "#C9821B" : "#1E3A5F"} color="#fff">
              {ultimoEstado.tipo_valorizacion}
            </Tag>
          </div>
        )}
        {puedeCiclo && (
          <div className="valm-noprint" style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <button className="btn sm" onClick={() => marcarCiclo("presentada")}>Marcar presentada</button>
            <button className="btn sm" style={{ background: "#C9821B" }} onClick={() => marcarCiclo("observada")}>Marcar observada</button>
            <button className="btn sm" style={{ background: "#1E8E5A" }} onClick={() => marcarCiclo("conforme")}>Marcar conforme</button>
            <span className="muted" style={{ fontSize: 11.5, alignSelf: "center" }}>ELSE revisa en 5 d.h.; si observa, subsanar y conformidad en 2 d.h. adicionales.</span>
          </div>
        )}
      </Card>

      <Card style={{ marginTop: 14 }}>
        <h3>(a) Cuadro de control de avance — {mesLabel}</h3>
        <div style={{ overflowX: "auto" }}>
          <table className="tbl">
            <thead><tr><th>ACT</th><th>Actividad</th><th>Cantidad del mes</th><th>P.U. (S/)</th><th>Subtotal</th></tr></thead>
            <tbody>
              {cuadro.map(r => (
                <tr key={r.act}>
                  <td><b>{r.act}</b></td><td>{r.nombre}</td><td>{r.cant}</td><td>{r.pu}</td>
                  <td>S/ {(r.cant * r.pu).toLocaleString("es-PE")}</td>
                </tr>
              ))}
              <tr><td colSpan={4} style={{ textAlign: "right" }}><b>Total del mes</b></td><td><b style={{ color: "#1E8E5A" }}>S/ {totalMes.toLocaleString("es-PE")}</b></td></tr>
            </tbody>
          </table>
        </div>
      </Card>

      <TablaRelacion id="act01" titulo="(b) ACT-01 · Resoluciones / trato directo"
        nota="Criterio: ticket de etapa Resolución o Firmas marcado hecho en el mes (bitácora registros tipo=ticket); si el caso no tiene bitácora v2, se usa la fecha de resolución registrada en datos de etapa."
        columnas={["N° reclamo", "N° OSINERG", "Solicitante", "Sentido", "Fecha"]}
        filas={act01.map(r => [r.codigo, r.osinerg, r.solicitante, r.sentido, r.fecha])}
        nombreArchivo={`ACT01_${ymk}.csv`} />

      <TablaRelacion id="act02" titulo="(c) ACT-02 · Apelaciones elevadas a JARU"
        nota="Criterio: FECHA_ELEVACION registrada en datos de la etapa Apelación (JARU), dentro del mes."
        columnas={["N° reclamo", "Suministro", "Fecha de elevación", "N° expediente JARU"]}
        filas={act02.map(r => [r.codigo, r.suministro, r.fecha, r.expJaru])}
        nombreArchivo={`ACT02_${ymk}.csv`} />

      <TablaRelacion id="act03" titulo="(d) ACT-03 · Expedientes tramitados en 1ª instancia (cerrados)"
        nota="Solo cerrados en SIELSE (base contractual), salvo que estén en apelación. Criterio: ticket de etapa Cierre hecho en el mes, o estado Cerrado con fecha de solución del mes."
        columnas={["N° reclamo", "N° OSINERG", "Suministro", "Fecha de cierre"]}
        filas={act03.map(r => [r.codigo, r.osinerg, r.suministro, r.fecha])}
        nombreArchivo={`ACT03_${ymk}.csv`} />

      <TablaRelacion id="act04" titulo="(e) ACT-04 · Expedientes remitidos a muestra trimestral"
        nota="Criterio: registros tipo=muestra del mes, generados desde el módulo Muestra ACT-04."
        columnas={["Ítem", "Expedientes", "Fecha de entrega"]}
        filas={act04.map(r => [r.item, r.expedientes, r.fecha])}
        nombreArchivo={`ACT04_${ymk}.csv`} />

      <TablaRelacion id="act05" titulo="(f) ACT-05 · Resoluciones notificadas por notario"
        nota="Criterio: FECHA_NOTIFICACION_NOTARIAL registrada en datos de la etapa Notificación, dentro del mes."
        columnas={["N° reclamo", "N° OSINERG", "Fecha notarial"]}
        filas={act05.map(r => [r.codigo, r.osinerg, r.fecha])}
        nombreArchivo={`ACT05_${ymk}.csv`} />

      <Card style={{ marginTop: 14 }}>
        <h3>(g) Acta de capacitación mensual</h3>
        <div className="muted" style={{ fontSize: 11.5, marginBottom: 8 }}>Criterio: evidencia del mes cuyo nombre contiene "capacit" (acta + fotos fechadas, firmada por Coordinador y supervisor ELSE).</div>
        {actaCapacitacion
          ? <Tag bg="#1E8E5A" color="#fff">✓ Acta de capacitación registrada en {mesLabel}</Tag>
          : <Tag bg="#DC2626" color="#fff">✗ FALTA — es requisito de la valorización</Tag>}
      </Card>

      <Card style={{ marginTop: 14 }}>
        <h3>Checklist de presentación — {mesLabel}</h3>
        <div style={{ display: "grid", gap: 6 }}>
          {checklist.map(c => (
            <div key={c.k} className="chk" style={{ fontSize: 13 }}>
              <span style={{ color: c.ok === false ? "#DC2626" : c.ok === true ? "#1E8E5A" : "var(--mut)" }}>
                {c.ok === false ? "☐" : c.ok === true ? "☑" : "☐"}
              </span> {c.label}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
