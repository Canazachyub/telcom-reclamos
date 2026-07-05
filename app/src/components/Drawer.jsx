import { useState, useEffect } from "react";
import { FLUJO, stageIdx, fmtFecha, daysLeft, wName, wColor, DRIVE_URL, ETAPA_NN } from "../lib/model.js";
import { estadoColor, urgColor, Tag, toast } from "./ui.jsx";
import Timeline from "./Timeline.jsx";
import SubirEvidencia from "./SubirEvidencia.jsx";
import Formularios from "./Formularios.jsx";
import FichaSielse from "./FichaSielse.jsx";
import { INFO_ETAPA, CAMPOS_ETAPA, CAMPOS_POR_FALLO } from "../lib/camposEtapa.js";
import { resumirIA } from "../lib/api.js";
import { GuiaSielseBox } from "../lib/guiaSielse.jsx";

const humaniza = k => String(k).replace(/_/g, " ").toLowerCase().replace(/^\w/, c => c.toUpperCase());
// URL de previsualización embebible de un archivo de Drive.
function previewUrl(url) {
  const m = String(url || "").match(/\/d\/([^/]+)/) || String(url || "").match(/[?&]id=([^&]+)/);
  return m ? `https://drive.google.com/file/d/${m[1]}/preview` : url;
}
const esImg = n => /\.(jpg|jpeg|png|gif|webp)$/i.test(String(n || ""));

// Workspace del expediente a pantalla completa: timeline arriba · VISOR · datos del formulario · datos del reclamo + etapas.
// AQUÍ se hace TODO el trabajo de una etapa: subir evidencia + datos, generar documento y marcar la etapa hecha.
export default function Drawer({ exp, etapaInicial, evidencias, datos, tickets, perfil, comentarios = [], onComentar, onClose, onSaveDatos, onSubido, onEstadoTicket, onEditar }) {
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
  const [sel, setSel] = useState(ii >= 0 ? ii : ai >= 0 ? ai : exp.estado === "Cerrado" ? FLUJO.length - 1 : ci < 0 ? 0 : ci);
  const [docSel, setDocSel] = useState(0);
  const [subir, setSubir] = useState(false);
  const [docGen, setDocGen] = useState(false);
  const [fichaSielse, setFichaSielse] = useState(false);
  const [w, setW] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
  useEffect(() => { const f = () => setW(window.innerWidth); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); }, []);
  const mobile = w < 880;
  const [iaResumen, setIaResumen] = useState(""); const [iaBusy, setIaBusy] = useState(false);

  const evisDe = et => (evidencias || []).filter(e => e.exp === exp.codigo && (e.etapa === et || e.etapa === ETAPA_NN[et]));
  const datosDe = et => (datos && datos[exp.codigo + "|" + et]) || {};
  const ticketDe = et => (tickets || []).find(t => t.reclamo === exp.codigo && t.etapa === et);

  const s = FLUJO[sel];
  const docs = evisDe(s.etapa);
  const dat = datosDe(s.etapa); const datK = Object.keys(dat);
  const tk = ticketDe(s.etapa);
  const doc = docs[Math.min(docSel, Math.max(docs.length - 1, 0))];

  // Faltantes para poder cerrar la etapa: evidencia requerida sin match (misma lógica del
  // checklist "Evidencia requerida") + campos de CAMPOS_ETAPA[etapa] (incl. los del sentido
  // de fallo, en "Resolución") sin valor registrado en `datos`.
  const evisFaltantes = s.evi.filter(ev => !docs.some(d => String(d.nombre).toLowerCase().includes(ev.split(" ")[0].toLowerCase())));
  const especEtapa = CAMPOS_ETAPA[s.etapa];
  const camposEtapaTodos = especEtapa
    ? [...especEtapa.campos, ...(s.etapa === "Resolución" ? (CAMPOS_POR_FALLO[dat.SENTIDO_FALLO] || []) : [])]
    : [];
  const camposFaltantes = camposEtapaTodos.filter(c => dat[c.k] == null || dat[c.k] === "").map(c => c.label);
  const faltantes = [...evisFaltantes, ...camposFaltantes];
  const estPlazo = tk && tk.abierto ? (tk.vencido ? { t: "VENCIDO", c: "#7f1d1d" } : (tk.diasRestantes != null && tk.diasRestantes <= 2 ? { t: "POR VENCER", c: "#78350f" } : { t: "VIGENTE", c: "#14532d" })) : null;
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
        {/* ===== Header + línea de tiempo (full width) ===== */}
        <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--bd)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span className="mono" style={{ fontSize: 16, fontWeight: 700, color: "var(--titulo)" }}>{exp.osinerg || exp.codigo}</span>
              <span className="muted">{exp.solicitante}</span>
              <Tag bg={wColor(exp.resp)} color="#fff">👤 {wName(exp.resp)}</Tag>
              {exp.tipoRes && <Tag bg="#E9EEF5" color="var(--tx)">{exp.tipoRes}</Tag>}
              {exp.apelacion && <Tag bg="#7c3aed" color="#fff">APELACIÓN JARU</Tag>}
            </div>
            <button className="btn sec sm" onClick={onClose} title="Cerrar expediente">✕ cerrar</button>
          </div>
          <div style={{ fontSize: 11, color: "var(--mut)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 2 }}>Línea de tiempo del expediente</div>
          <Timeline ticketDe={ticketDe}
            estadoPos={i => {
              // Preferir el ticket activo del caso (fuente de verdad); si el caso no tiene
              // tickets, caer al respaldo viejo (exp.etapa/exp.estado derivados de SIELSE).
              if (ticketsCaso.length) return i < ai ? "hecho" : i === ai ? "proceso" : "pend";
              return exp.estado === "Cerrado" ? "hecho" : i < ci ? "hecho" : i === ci ? "proceso" : "pend";
            }}
            onSel={selEst} />
        </div>

        {/* ===== 3 columnas (se apilan en móvil) ===== */}
        <div style={colsS}>
          {/* --- VISOR --- */}
          <div style={{ ...colS, ...bordR, display: "flex", flexDirection: "column", minHeight: mobile ? 380 : "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
              <b style={{ color: "var(--titulo)", fontSize: 13 }}>Visor — {s.etapa}</b>
              <div style={{ display: "flex", gap: 6 }}>
                <button className="btn sm" onClick={() => setSubir(v => !v)} title="Subir evidencia y registrar datos de esta etapa">📎 {subir ? "Cerrar" : "Evidencia + datos"}</button>
                <button className="btn sm" onClick={() => setDocGen(true)} title="Generar el documento de este expediente">📄 Generar documento</button>
                <button className="btn sm" onClick={() => setFichaSielse(true)} title="Ver el registro SIELSE completo del caso, lo trabajado por fase y sus documentos">📋 Ficha SIELSE</button>
              </div>
            </div>
            {docs.length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                {docs.map((d, i) => (
                  <button key={i} onClick={() => setDocSel(i)} style={{ ...chip, ...(i === docSel ? chipOn : {}) }}>{d.tipo || "PDF"} · {String(d.nombre).slice(0, 22)}</button>
                ))}
              </div>
            )}
            {subir && <SubirEvidencia reclamo={exp.codigo} etapa={s.etapa} etapaNN={ETAPA_NN[s.etapa]} perfil={perfil} onSaveDatos={onSaveDatos} onSubido={onSubido} onClose={() => setSubir(false)} />}
            <div style={{ flex: 1, marginTop: 8, minHeight: 320, borderRadius: 10, border: "1px solid var(--bd)", overflow: "hidden", background: "var(--card2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {doc && doc.url
                ? (esImg(doc.nombre)
                  ? <img src={doc.url} alt={doc.nombre} style={{ maxWidth: "100%", maxHeight: "100%" }} />
                  : <iframe title="visor" src={previewUrl(doc.url)} style={{ width: "100%", height: "100%", border: 0 }} />)
                : <div style={{ textAlign: "center", color: "var(--mut)", padding: 30 }}>
                  <div style={{ fontSize: 40 }}>📄</div>
                  <div style={{ fontSize: 13, marginTop: 8 }}>Sin documento en esta etapa</div>
                  <div style={{ fontSize: 11 }}>Sube el PDF/imagen con «📎 Subir evidencia»</div>
                </div>}
            </div>
            {doc && doc.url && <div style={{ marginTop: 6, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <a className="link" style={{ fontSize: 11 }} href={doc.url} target="_blank" rel="noreferrer">🔗 abrir {doc.nombre} en Drive ↗</a>
              <button className="btn sm" disabled={iaBusy} onClick={async () => { setIaBusy(true); setIaResumen(""); const r = await resumirIA({ url: doc.url, reclamo: exp.codigo, etapa: s.etapa }); setIaBusy(false); setIaResumen(r?.ok ? r.resumen : "⚠ " + (r?.error || "no se pudo resumir (¿configuraste la API key de Gemini?)")); }}>{iaBusy ? "Resumiendo…" : "🤖 Resumir con IA"}</button>
            </div>}
            {iaResumen && <div style={{ marginTop: 8, background: "rgba(124,58,237,.10)", border: "1px solid #6d28d9", borderRadius: 8, padding: "10px 12px", fontSize: 12.5, color: "var(--tx)", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
              <b style={{ color: "#6D28D9" }}>🤖 Resumen IA del documento:</b><br />{iaResumen}</div>}
          </div>

          {/* --- Datos del formulario (lo que llenó el trabajador) --- */}
          <div style={{ ...colS, ...bordR }}>
            {esMiEtapa && <div style={{ background: "rgba(201,130,27,.12)", border: "1px solid #C9821B", borderRadius: 8, padding: "8px 10px", marginBottom: 10, fontSize: 12.5, color: "#7A4A0A" }}>
              ✋ <b>Esta etapa es tuya.</b> 1) 📎 sube la evidencia y llena los datos · 2) 📄 genera el documento si aplica · 3) pulsa «✔ Terminé esta etapa».
            </div>}
            <b style={{ color: "var(--titulo)", fontSize: 13 }}>Datos de la etapa</b>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "8px 0" }}>
              <Tag bg="#E9EEF5" color="var(--tx)">👤 {s.rol}</Tag><Tag bg="#E9EEF5" color="var(--tx)">{s.act}</Tag><Tag bg="#E9EEF5" color="var(--tx)">⏱ {s.plazo}</Tag>
              {estPlazo && <Tag bg={estPlazo.c} color="#fff">{estPlazo.t} · {tk.fechaLimite} ({tk.diasRestantes}d háb.)</Tag>}
              {tk && tk.hecho && <Tag bg="#064e3b" color="#fff">✓ hecho</Tag>}
            </div>
            {puedeAccion && tk.abierto && (
              <div style={{ display: "flex", gap: 8, margin: "4px 0 10px", flexWrap: "wrap" }}>
                {tk.estado === "pendiente" && <button className="btn sm" onClick={() => { onEstadoTicket?.(tk, "en_proceso"); toast("«" + s.etapa + "» en proceso"); }}>▶ Iniciar etapa</button>}
                <button className="btn sm" style={{ background: "#1E8E5A", color: "#fff", border: 0 }} onClick={() => {
                  if (faltantes.length) {
                    const msg = "Faltan " + faltantes.length + " ítem(s) de «" + s.etapa + "»:\n· " + faltantes.slice(0, 10).join("\n· ") + (faltantes.length > 10 ? "\n…" : "") + "\n\nPuede generar penalidad. ¿Marcar la etapa como hecha igual?";
                    if (!confirm(msg)) return;
                  }
                  onEstadoTicket?.(tk, "hecho");
                  const sig = sel < FLUJO.length - 1 ? FLUJO[sel + 1].etapa : null;
                  toast("✓ «" + s.etapa + "» hecha" + (sig ? " · sigue: " + sig : " · expediente cerrado"));
                  if (sig) { setSel(sel + 1); setDocSel(0); setSubir(false); }
                }}>✔ Terminé esta etapa</button>
              </div>
            )}

            <div style={{ marginTop: 10 }}><GuiaSielseBox etapa={s.etapa} compacta /></div>

            <Sec t="📝 Lo que registró el trabajador (formulario)">
              {datK.length ? <div style={{ display: "grid", gap: 4 }}>
                {datK.map(k => <div key={k} style={{ fontSize: 12.5 }}><b style={{ color: "var(--mut)" }}>{humaniza(k)}:</b> <span style={{ color: "var(--tx)" }}>{String(dat[k])}</span></div>)}
              </div> : <div className="muted" style={{ fontSize: 12 }}>Aún no se registraron datos en esta etapa.</div>}
            </Sec>

            <Sec t="¿Qué hizo / qué falta?">
              {s.pasos.map((p, k) => { const done = tk ? tk.hecho : (sel < ci || exp.estado === "Cerrado"); return <div className="chk" key={k}><span style={{ color: done ? "#15803D" : tk && tk.estado === "en_proceso" ? "#B45309" : "var(--mut)" }}>{done ? "✓" : "○"}</span> {p}</div>; })}
            </Sec>
            <Sec t="Evidencia requerida">
              {s.evi.map((ev, k) => { const has = docs.some(d => String(d.nombre).toLowerCase().includes(ev.split(" ")[0].toLowerCase())); return <div className="chk" key={k}><span style={{ color: has ? "#15803D" : "#DC2626" }}>{has ? "✓" : "✗ falta"}</span> {ev}</div>; })}
            </Sec>
            {INFO_ETAPA[s.etapa] && <div className="note" style={{ background: "rgba(31,78,140,.08)", border: "1px solid var(--bd)", color: "var(--tx)", fontSize: 11.5, marginTop: 8 }}>
              <b style={{ color: "var(--linkTx)" }}>Según las bases:</b> {INFO_ETAPA[s.etapa].importa}
            </div>}
          </div>

          {/* --- Datos del reclamo + navegador de etapas + observaciones --- */}
          <div style={colS}>
            <b style={{ color: "var(--titulo)", fontSize: 13 }}>Datos del reclamo</b>
            <div style={{ margin: "8px 0" }}>
              {[["Clase", exp.clase], ["Suministro", exp.suministro], ["Dirección", exp.direccion], ["Distrito", `${exp.distrito} · ${exp.provincia}`], ["F. admisión", fmtFecha(exp.fechaAdm)], ["F. límite SIELSE", fmtFecha(exp.fechaLim)], ["Doc. ref.", exp.docRef || "—"]].map(([a, b]) => (
                <div className="kv" key={a}><b>{a}</b><span>{b}</span></div>
              ))}
            </div>
            {exp.descripcion && <div style={{ fontSize: 12, color: "var(--tx)", background: "var(--card2)", border: "1px solid var(--bd)", borderRadius: 8, padding: 8, marginBottom: 10 }}>{exp.descripcion}</div>}
            <b style={{ color: "var(--titulo)", fontSize: 13 }}>Etapas</b>
            <div style={{ display: "grid", gap: 5, marginTop: 8 }}>
              {FLUJO.map((f, i) => {
                const t = ticketDe(f.etapa);
                const est = t ? (t.hecho ? "hecho" : t.estado === "en_proceso" ? "proceso" : "pend") : (exp.estado === "Cerrado" ? "hecho" : i < ci ? "hecho" : i === ci ? "proceso" : "pend");
                const col2 = est === "hecho" ? "#1E8E5A" : est === "proceso" ? "#2C6FC0" : "var(--mut)";
                return (
                  <div key={i} onClick={() => selEst(i)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 9px", borderRadius: 8, cursor: "pointer", background: i === sel ? "var(--selBg)" : "var(--card2)", border: `1px solid ${i === sel ? "#2C6FC0" : "var(--bd)"}` }}>
                    <span style={{ width: 18, height: 18, borderRadius: "50%", background: col2, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800 }}>{est === "hecho" ? "✓" : est === "proceso" ? "◐" : "○"}</span>
                    <span style={{ flex: 1, fontSize: 12, color: "var(--tx)" }}>{f.etapa}</span>
                    {t && t.abierto && t.vencido && <span style={{ fontSize: 10, color: "#DC2626" }}>vencido</span>}
                    {t && <span className="muted" style={{ fontSize: 10 }}>{t.responsable.split(" ")[0]}</span>}
                  </div>
                );
              })}
            </div>
            <Observaciones reclamo={exp.codigo} etapa={s.etapa} perfil={perfil} comentarios={comentarios} onComentar={onComentar} />
          </div>
        </div>

        {/* ===== Modal: generar documento de este expediente ===== */}
        {docGen && (
          <div className="overlay" style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 60 }} onClick={e => { if (e.target === e.currentTarget) setDocGen(false); }}>
            <div style={{ width: "min(880px,94vw)", maxHeight: "90vh", overflowY: "auto", background: "#fff", border: "1px solid var(--bd)", borderRadius: 14, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <b style={{ color: "var(--titulo)" }}>📄 Generar documento — <span className="mono">{exp.osinerg || exp.codigo}</span></b>
                <button className="btn sec sm" onClick={() => setDocGen(false)}>✕ cerrar</button>
              </div>
              <Formularios data={[exp]} perfil={perfil} fijo={exp}
                datosEtapa={FLUJO.reduce((acc, f) => ({ ...acc, ...datosDe(f.etapa) }), {})}
                etapaActual={s.etapa}
                onSaveDatos={onSaveDatos ? (campos) => onSaveDatos({ exp: exp.codigo, etapa: s.etapa, rol: perfil?.rol, campos }) : null} />
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

// Observaciones del expediente — cualquier rol puede añadir (queda con su nombre y rol).
function Observaciones({ reclamo, etapa, perfil, comentarios, onComentar }) {
  const [txt, setTxt] = useState("");
  const mis = (comentarios || []).filter(c => c.reclamo === reclamo).sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  const enviar = () => {
    const t = txt.trim(); if (!t) return;
    onComentar?.({ reclamo, etapa, texto: t, nombre: perfil?.nombre, rol: perfil?.rol, usuario: perfil?.usuario, fecha: new Date().toISOString().slice(0, 16).replace("T", " ") });
    setTxt("");
  };
  return (
    <div style={{ marginTop: 14 }}>
      <b style={{ color: "var(--titulo)", fontSize: 13 }}>Observaciones ({mis.length})</b>
      <div style={{ display: "flex", gap: 6, margin: "8px 0" }}>
        <input value={txt} onChange={e => setTxt(e.target.value)} onKeyDown={e => e.key === "Enter" && enviar()}
          placeholder="Añade una observación… (escribe «MEJORA: …» para proponer una mejora del sistema)" style={{ flex: 1, background: "#fff", color: "var(--tx)", border: "1px solid var(--bd)", borderRadius: 8, padding: "7px 9px", fontSize: 12.5 }} />
        <button className="btn sm" onClick={enviar}>Enviar</button>
      </div>
      <div style={{ display: "grid", gap: 6 }}>
        {mis.map((c, i) => (
          <div key={i} style={{ background: "var(--card2)", border: "1px solid var(--bd)", borderRadius: 8, padding: "7px 10px" }}>
            <div style={{ fontSize: 12.5, color: "var(--tx)" }}>{c.texto}</div>
            <div className="muted" style={{ fontSize: 10.5, marginTop: 3 }}>{c.nombre || c.usuario} · {c.rol} · {c.fecha}{c.etapa ? " · " + c.etapa : ""}</div>
          </div>
        ))}
        {!mis.length && <div className="muted" style={{ fontSize: 12 }}>Sin observaciones aún.</div>}
      </div>
    </div>
  );
}

const Sec = ({ t, children }) => (
  <div style={{ marginTop: 10 }}>
    <div style={{ fontWeight: 600, fontSize: 12, color: "var(--tx)", marginBottom: 4 }}>{t}</div>
    {children}
  </div>
);

const wrap = { width: "96vw", maxWidth: 1500, height: "92vh", background: "#fff", border: "1px solid var(--bd)", borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(22,41,75,.15)" };
const cols = { flex: 1, display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr", overflow: "hidden" };
const col = { padding: 14, overflowY: "auto" };
const chip = { background: "var(--card2)", color: "var(--tx)", border: "1px solid var(--bd)", borderRadius: 7, padding: "4px 8px", fontSize: 11, cursor: "pointer" };
const chipOn = { background: "#1F4E8C", color: "#fff", borderColor: "#2C6FC0" };
