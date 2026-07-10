import { useState } from "react";
import { resumirIA } from "../../lib/api.js";
import SubirEvidencia from "../SubirEvidencia.jsx";
import { previewUrl, esImg, chip, chipOn } from "./utils.js";

// --- VISOR --- (columna izquierda del Drawer): documento de la etapa + subir evidencia + IA.
export function ColumnaVisor({ style, s, etapaNN, docs, docSel, setDocSel, subir, setSubir, setDocGen, setFichaSielse,
  exp, perfil, previosDe, onSaveDatos, onSubido }) {
  const [iaResumen, setIaResumen] = useState(""); const [iaBusy, setIaBusy] = useState(false);
  const doc = docs[Math.min(docSel, Math.max(docs.length - 1, 0))];
  return (
    <div style={{ ...style, display: "flex", flexDirection: "column", minHeight: "auto" }}>
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
      {subir && <SubirEvidencia key={s.etapa} reclamo={exp.codigo} etapa={s.etapa} etapaNN={etapaNN} perfil={perfil} previos={previosDe(s.etapa)} onSaveDatos={onSaveDatos} onSubido={onSubido} onClose={() => setSubir(false)} />}
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
      {iaResumen && <div style={{ marginTop: 8, background: "var(--tint-purple-bg)", border: "1px solid var(--tint-purple-bd)", borderRadius: 8, padding: "10px 12px", fontSize: 12.5, color: "var(--tx)", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
        <b style={{ color: "var(--purple)" }}>🤖 Resumen IA del documento:</b><br />{iaResumen}</div>}
    </div>
  );
}
