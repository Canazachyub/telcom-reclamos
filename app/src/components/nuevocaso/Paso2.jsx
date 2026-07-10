import { useState } from "react";
import { sustentosDe } from "./constantes.js";
import { lblSpan, inp, badgeDudoso } from "./estilos.js";

/* ===================== PASO 2 — Sube lo que llegó a mesa de partes ===================== */
export function Paso2({ file, setFile, inputRef, pdfUrl, iaBusy, extraer, f, set, sug, mostrarVisorInline }) {
  const sugerenciaClase = sug.has("NombreClaseReclamo") && f.NombreClaseReclamo;
  const sustentos = sustentosDe(f.NombreClaseReclamo);
  const [marcados, setMarcados] = useState(new Set()); // checklist puramente visual, no viaja al payload
  const toggleSustento = (i) => setMarcados(s => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; });

  return (
    <div>
      <h4 style={{ margin: "0 0 4px", color: "var(--navy)" }}>Sube lo que llegó a mesa de partes</h4>
      <div className="muted" style={{ fontSize: 12, marginBottom: 14 }}>Adjunta el Formato 1 / cargo de recepción y deja que la IA lea los datos.</div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {/* izquierda: dropzone (+ visor solo si todavía no hay columna fija de documento) */}
        <div style={{ flex: "1 1 440px", minWidth: 300, display: "flex", flexDirection: "column" }}>
          <div onClick={() => inputRef.current?.click()} style={{ border: "1px dashed var(--bd)", borderRadius: 8, padding: "12px 10px", textAlign: "center", cursor: "pointer", marginBottom: 10 }}>
            <div style={{ fontSize: 13, color: "var(--tx)" }}>{file ? `📄 ${file.name} · cambiar` : "Adjunta el Formato 1 / cargo de recepción (PDF)"}</div>
            <input ref={inputRef} type="file" hidden accept="application/pdf,image/*" onChange={e => setFile(e.target.files[0])} />
          </div>
          {mostrarVisorInline && (
            <div style={{ flex: 1, minHeight: "50vh", border: "1px solid var(--bd)", borderRadius: 10, overflow: "hidden", background: "var(--card2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {pdfUrl
                ? <iframe title="pdf" src={pdfUrl} style={{ width: "100%", height: "100%", border: 0 }} />
                : <div className="muted" style={{ fontSize: 13, textAlign: "center", padding: 24 }}>Sube el Formato 1 (PDF) para previsualizarlo aquí.</div>}
            </div>
          )}

          {/* checklist de sustentos recomendados para la materia elegida (Formato 1 / Directiva 269-2014) */}
          <div style={{ marginTop: mostrarVisorInline ? 14 : 4, border: "1px solid var(--bd)", borderRadius: 10, padding: "10px 12px", background: "var(--card2)" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--titulo)", marginBottom: 6 }}>Sustentos recomendados para esta materia</div>
            <div style={{ display: "grid", gap: 6 }}>
              {sustentos.map((s, i) => (
                <label key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--tx)", cursor: "pointer" }}>
                  <input type="checkbox" checked={marcados.has(i)} onChange={() => toggleSustento(i)} />
                  <span style={{ textDecoration: marcados.has(i) ? "line-through" : "none", color: marcados.has(i) ? "var(--mut)" : "var(--tx)" }}>{s}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* derecha: panel IA */}
        <div style={{ flex: "1 1 380px", minWidth: 300 }}>
          <button onClick={extraer} disabled={iaBusy || !file} style={{ width: "100%", background: "var(--tint-acc-bg)", color: "var(--tint-acc-tx)", border: "1px solid var(--tint-acc-bd)", borderRadius: 8, padding: "8px 12px", fontSize: 12.5, cursor: file ? "pointer" : "not-allowed", fontWeight: 600, marginBottom: 12 }}>
            {iaBusy ? "🤖 La IA está leyendo el documento…" : "🤖 Extraer datos del Formato 1"}
          </button>

          {sugerenciaClase && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--selBg)", border: "1px solid var(--acc)", borderRadius: 8, padding: "6px 10px", marginBottom: 12, fontSize: 12 }}>
              <span style={{ color: "var(--tx)" }}>IA sugiere: <b>{f.NombreClaseReclamo}</b></span>
              <button onClick={() => set("NombreClaseReclamo", f.NombreClaseReclamo)} style={{ marginLeft: "auto", background: "var(--acc)", color: "#fff", border: 0, borderRadius: 6, padding: "3px 10px", fontSize: 11.5, cursor: "pointer", fontWeight: 600 }}>aplicar</button>
            </div>
          )}

          <div className="muted" style={{ fontSize: 11, marginBottom: 8, textTransform: "uppercase", letterSpacing: .4 }}>Campos extraídos</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[
              ["NombreSolicitante", "Solicitante *", "text"], ["DNI", "DNI", "text"],
              ["TELEFONO", "Teléfono / celular", "text"], ["CodigoSuministro", "Suministro *", "text"],
              ["NumeroOsinerg", "N° OSINERG", "text"], ["DireccionSolicitante", "Dirección", "text"],
              ["NombreDistrito", "Distrito", "text"], ["FechaAdmisionReclamo", "Fecha admisión (DD/MM/AAAA)", "text"],
              ["PERIODO_RECLAMADO", "Período reclamado", "text"], ["monto_reclamo", "Monto en reclamo (S/)", "num"],
            ].map(([k, lab, tipo]) => (
              <label key={k} style={{ fontSize: 12 }}>
                <span style={lblSpan}>{lab}{sug.has(k) && <span style={badgeDudoso}>revisar</span>}</span>
                <input type={tipo === "num" ? "number" : "text"} value={f[k] || ""} onChange={e => set(k, e.target.value)} style={inp(sug.has(k))} />
              </label>
            ))}
            <label style={{ fontSize: 12, gridColumn: "1 / -1" }}>
              <span style={lblSpan}>Descripción{sug.has("DescripcionReclamo") && <span style={badgeDudoso}>revisar</span>}</span>
              <textarea rows={3} value={f.DescripcionReclamo || ""} onChange={e => set("DescripcionReclamo", e.target.value)} style={inp(sug.has("DescripcionReclamo"))} />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
