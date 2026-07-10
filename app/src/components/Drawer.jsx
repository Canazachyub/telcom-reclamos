import { useState, useEffect, lazy, Suspense } from "react";
import { FLUJO, stageIdx, parseFecha, wColor, wName, ETAPA_NN } from "../lib/model.js";
import { Tag } from "./ui.jsx";
import Timeline from "./Timeline.jsx";
import FichaSielse from "./FichaSielse.jsx";
// Formularios (modal "Generar documento") solo se monta con docGen=true: en diferido (F4-B).
const Formularios = lazy(() => import("./Formularios.jsx"));
import { CAMPOS_ETAPA, CAMPOS_POR_FALLO } from "../lib/camposEtapa.js";
import { ICONO_ETAPA, wrap, cols, col } from "./drawer/utils.js";
import { ColumnaVisor } from "./drawer/ColumnaVisor.jsx";
import { PanelEtapa } from "./drawer/PanelEtapa.jsx";
import { DatosReclamo } from "./drawer/DatosReclamo.jsx";

// Workspace del expediente a pantalla completa: timeline arriba · VISOR · datos del formulario · datos del reclamo + etapas.
// AQUÍ se hace TODO el trabajo de una etapa: subir evidencia + datos, generar documento y marcar la etapa hecha.
export default function Drawer({ exp, etapaInicial, evidencias, datos, tickets, perfil, comentarios = [], registros = [], onComentar, onClose, onSaveDatos, onSubido, onEstadoTicket, onEditar, onAbrirCuaderno }) {
  const ci = stageIdx(exp.etapa);
  const ii = etapaInicial ? stageIdx(etapaInicial) : -1;
  // EL TICKET ACTIVO ES LA FUENTE DE VERDAD: si no viene una etapa explícita (etapaInicial),
  // la etapa inicial del Drawer es la del ticket activo del caso — el primer no-hecho en el
  // orden del FLUJO. Solo si el caso no tiene tickets en absoluto se usa el respaldo viejo
  // (exp.etapa derivada de SIELSE / estado Cerrado).
  const ticketsCaso = (tickets || []).filter(t => t.reclamo === exp.codigo);
  const ticketActivo = ticketsCaso.length
    ? [...ticketsCaso].sort((a, b) => String(a.etapaNN).localeCompare(String(b.etapaNN))).find(t => !t.hecho)
    : null;
  const ai = ticketsCaso.length ? (ticketActivo ? stageIdx(ticketActivo.etapa) : FLUJO.length - 1) : -1;
  // etapa actual del caso (para el nodo "Ahora" de la fuente de cuadernos)
  const cerradoDrawer = ticketsCaso.length > 0 && ticketsCaso.every(t => t.hecho);
  const etapaActualDrawer = ticketActivo ? ticketActivo.etapa : (cerradoDrawer ? "Cierre" : exp.etapa);
  const [sel, setSel] = useState(ii >= 0 ? ii : ai >= 0 ? ai : exp.estado === "Cerrado" ? FLUJO.length - 1 : ci < 0 ? 0 : ci);
  const [datosAbierto, setDatosAbierto] = useState(true);   // «Datos de la etapa» colapsable
  const [docSel, setDocSel] = useState(0);
  const [subir, setSubir] = useState(false);
  const [docGen, setDocGen] = useState(false);
  const [fichaSielse, setFichaSielse] = useState(false);
  // Plan de trabajo sugerido al iniciar una etapa: descartable por sesión, por etapa (no persiste).
  const [planDescartado, setPlanDescartado] = useState({});
  const [w, setW] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
  useEffect(() => { const f = () => setW(window.innerWidth); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); }, []);
  const mobile = w < 880;

  const evisDe = et => (evidencias || []).filter(e => e.exp === exp.codigo && (e.etapa === et || e.etapa === ETAPA_NN[et]));
  const datosDe = et => (datos && datos[exp.codigo + "|" + et]) || {};
  const ticketDe = et => (tickets || []).find(t => t.reclamo === exp.codigo && t.etapa === et);
  // ESPEJO: lo que YA está digitado en SIELSE (columnas del reclamo) pre-carga el formulario
  // de la etapa — el equipo corrige, no vuelve a digitar. datos_etapa (lo registrado aquí) manda.
  const fmtDia = v => { const d = parseFecha(v); return d ? `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}` : (v || ""); };
  const espejoExp = {
    N_SOLICITUD_SIELSE: exp.docRef, N_OSINERG_SIELSE: exp.osinerg,
    FECHA_ADMISION_SIELSE: fmtDia(exp.fechaAdm), SENTIDO_RESOLUCION: exp.tipoRes, SENTIDO_FALLO: exp.tipoRes,
    MOTIVO_CIERRE: exp.motivoCierre, FECHA_CIERRE: fmtDia(exp.fechaSol), DESCRIPCION_SOLUCION: exp.solucion,
  };
  const previosDe = et => {
    const base = {};
    Object.entries(espejoExp).forEach(([k, v]) => { if (v != null && String(v).trim() !== "") base[k] = String(v); });
    return { ...base, ...datosDe(et) };
  };

  const s = FLUJO[sel];
  const docs = evisDe(s.etapa);
  const dat = datosDe(s.etapa); const datK = Object.keys(dat);
  const tk = ticketDe(s.etapa);

  // Faltantes para poder cerrar la etapa: evidencia requerida sin match (misma lógica del
  // checklist "Evidencia requerida") + campos de CAMPOS_ETAPA[etapa] (incl. los del sentido
  // de fallo, en "Resolución") sin valor registrado en `datos`.
  const evisFaltantes = s.evi.filter(ev => !docs.some(d => String(d.nombre).toLowerCase().includes(ev.split(" ")[0].toLowerCase())));
  const especEtapa = CAMPOS_ETAPA[s.etapa];
  const camposEtapaTodos = especEtapa
    ? [...especEtapa.campos, ...(s.etapa === "Resolución" ? (CAMPOS_POR_FALLO[dat.SENTIDO_FALLO] || []) : [])]
    : [];
  // un campo NO falta si ya se registró aquí O si ya está digitado en SIELSE (espejo)
  const datEf = previosDe(s.etapa);
  const camposFaltantes = camposEtapaTodos.filter(c => datEf[c.k] == null || datEf[c.k] === "").map(c => c.label);
  const faltantes = [...evisFaltantes, ...camposFaltantes];
  const estPlazo = tk && tk.abierto ? (tk.vencido ? { t: "VENCIDO", c: "var(--tint-red-bg)", tx: "var(--tint-red-tx)" } : (tk.diasRestantes != null && tk.diasRestantes <= 2 ? { t: "POR VENCER", c: "var(--tint-amber-bg)", tx: "var(--tint-amber-tx)" } : { t: "VIGENTE", c: "var(--tint-green-bg)", tx: "var(--tint-green-tx)" })) : null;
  // Pill de estado de la etapa SELECCIONADA (para la cabecera hero) — según su ticket si existe:
  // hecha ✓ verde / vencida roja / en curso ámbar. Sin ticket: "sin ticket" gris neutro.
  const pillEtapaSel = !tk
    ? { t: "SIN TICKET", bg: "var(--card2)", c: "var(--mut)" }
    : tk.hecho ? { t: "HECHA ✓", bg: "var(--tint-green-bg)", c: "var(--tint-green-tx)" }
      : tk.abierto && tk.vencido ? { t: "VENCIDA", bg: "var(--tint-red-bg)", c: "var(--tint-red-tx)" }
        : { t: "EN CURSO", bg: "var(--tint-amber-bg)", c: "var(--tint-amber-tx)" };
  const selEst = i => { setSel(i); setDocSel(0); setSubir(false); };
  const esMiEtapa = tk && perfil && tk.respId === perfil.resp_id && tk.abierto;
  const puedeAccion = tk && perfil && (esMiEtapa || perfil.rol === "GERENTE" || perfil.rol === "COORDINADOR");
  const wrapS = { ...wrap, ...(mobile ? { width: "100vw", height: "100vh", maxWidth: "none", borderRadius: 0 } : {}) };
  const colsS = mobile ? { flex: 1, display: "flex", flexDirection: "column", overflowY: "auto" } : cols;
  const colS = mobile ? { padding: 14, borderBottom: "1px solid var(--bd)" } : col;
  const bordR = mobile ? {} : { borderRight: "1px solid var(--bd)" };

  return (
    <div className="overlay" style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: mobile ? 0 : 16 }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={wrapS}>
        {/* ===== Header estilo courier (hero compacto) + línea de tiempo (full width) ===== */}
        <div style={{ background: "linear-gradient(120deg,var(--tint-acc-bg),var(--card))", borderBottom: "1px solid var(--bd)" }}>
          <div style={{ padding: "12px 18px 6px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ width: 40, height: 40, borderRadius: 11, background: "linear-gradient(135deg,var(--acc),var(--accLight))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19, flexShrink: 0 }}>
                {ICONO_ETAPA[s.etapa] || "📄"}
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span className="mono" style={{ fontSize: 16, fontWeight: 700, color: "var(--titulo)" }}>{exp.osinerg || exp.codigo}</span>
                  <span className="muted">{exp.solicitante}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 999, background: pillEtapaSel.bg, color: pillEtapaSel.c }}>{pillEtapaSel.t}</span>
                  <Tag bg={wColor(exp.resp)} color="#fff">👤 {wName(exp.resp)}</Tag>
                  {exp.tipoRes && <Tag bg="var(--card2)" color="var(--tx)">{exp.tipoRes}</Tag>}
                  {exp.apelacion && <Tag bg="var(--purple)" color="#fff">APELACIÓN JARU</Tag>}
                </div>
              </div>
            </div>
            <button className="btn sec sm" onClick={onClose} title="Cerrar expediente">✕ cerrar</button>
          </div>
          <div style={{ padding: "10px 18px 14px" }}>
            <div style={{ fontSize: 11, color: "var(--mut)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 4 }}>Línea de tiempo del expediente</div>
            <Timeline ticketDe={ticketDe}
              estadoPos={i => {
                // Preferir el ticket activo del caso (fuente de verdad); si el caso no tiene
                // tickets, caer al respaldo viejo (exp.etapa/exp.estado derivados de SIELSE).
                if (ticketsCaso.length) return i < ai ? "hecho" : i === ai ? "proceso" : "pend";
                return exp.estado === "Cerrado" ? "hecho" : i < ci ? "hecho" : i === ci ? "proceso" : "pend";
              }}
              onSel={selEst} seleccionado={sel} />
          </div>
        </div>

        {/* ===== 3 columnas (se apilan en móvil) ===== */}
        <div style={colsS}>
          <ColumnaVisor style={{ ...colS, ...bordR }} s={s} etapaNN={ETAPA_NN[s.etapa]} docs={docs} docSel={docSel} setDocSel={setDocSel}
            subir={subir} setSubir={setSubir} setDocGen={setDocGen} setFichaSielse={setFichaSielse}
            exp={exp} perfil={perfil} previosDe={previosDe} onSaveDatos={onSaveDatos} onSubido={onSubido} />

          <PanelEtapa style={{ ...colS, ...bordR }} esMiEtapa={esMiEtapa} exp={exp} onAbrirCuaderno={onAbrirCuaderno}
            perfil={perfil} etapaActualDrawer={etapaActualDrawer} cerradoDrawer={cerradoDrawer}
            datosAbierto={datosAbierto} setDatosAbierto={setDatosAbierto} s={s} estPlazo={estPlazo} tk={tk}
            faltantes={faltantes} puedeAccion={puedeAccion} onEstadoTicket={onEstadoTicket}
            sel={sel} setSel={setSel} FLUJO={FLUJO} setDocSel={setDocSel} setSubir={setSubir}
            camposEtapaTodos={camposEtapaTodos} planDescartado={planDescartado} setPlanDescartado={setPlanDescartado}
            datK={datK} dat={dat} onComentar={onComentar} docs={docs} ci={ci} />

          <DatosReclamo style={colS} exp={exp} onEditar={onEditar} ci={ci} ticketDe={ticketDe} sel={sel} selEst={selEst}
            FLUJO={FLUJO} comentarios={comentarios} perfil={perfil} onComentar={onComentar} registros={registros} etapaActual={s.etapa} />
        </div>

        {/* ===== Modal: generar documento de este expediente ===== */}
        {docGen && (
          <div className="overlay" style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 60 }} onClick={e => { if (e.target === e.currentTarget) setDocGen(false); }}>
            <div style={{ width: "min(880px,94vw)", maxHeight: "90vh", overflowY: "auto", background: "var(--card)", border: "1px solid var(--bd)", borderRadius: 14, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <b style={{ color: "var(--titulo)" }}>📄 Generar documento — <span className="mono">{exp.osinerg || exp.codigo}</span></b>
                <button className="btn sec sm" onClick={() => setDocGen(false)}>✕ cerrar</button>
              </div>
              <Suspense fallback={null}>
              <Formularios data={[exp]} perfil={perfil} fijo={exp}
                datosEtapa={FLUJO.reduce((acc, f) => ({ ...acc, ...datosDe(f.etapa) }), {})}
                etapaActual={s.etapa}
                onSaveDatos={onSaveDatos ? (campos) => onSaveDatos({ exp: exp.codigo, etapa: s.etapa, rol: perfil?.rol, campos }) : null} />
              </Suspense>
            </div>
          </div>
        )}

        {/* ===== Modal: Ficha SIELSE (registro del caso + trabajado por fase + documentos) ===== */}
        {fichaSielse && (
          <FichaSielse exp={exp} datos={datos} evidencias={evidencias} onClose={() => setFichaSielse(false)} onEditar={onEditar} />
        )}
      </div>
    </div>
  );
}
