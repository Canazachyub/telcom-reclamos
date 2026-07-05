import { useState, useRef, useEffect } from "react";
import { nuevoReclamo, subirArchivo, extraerCamposIA, guardarDatos } from "../lib/api.js";
import { toast } from "./ui.jsx";

// Campos que la IA extrae del Formato 1 / cargo de recepción. ESTE registro es la
// mesa de partes digital de TELCOM: aquí nace el expediente; SIELSE se llena DESPUÉS
// transcribiendo este detalle (etapa SIELSE, ≤2 días háb. — penalidades 5.1/5.2).
const EXTRAER = [
  { k: "NombreSolicitante", label: "Nombre del solicitante / reclamante" },
  { k: "DNI", label: "DNI del solicitante (8 dígitos)" },
  { k: "TELEFONO", label: "Teléfono / celular de contacto" },
  { k: "CodigoSuministro", label: "Código de suministro (11 dígitos)" },
  { k: "NumeroOsinerg", label: "N° OSINERG (REC00…) si aparece" },
  { k: "DireccionSolicitante", label: "Dirección del suministro" },
  { k: "NombreDistrito", label: "Distrito" },
  { k: "NombreClaseReclamo", label: "Materia del reclamo", opciones: ["RECLAMOS POR EXCESIVA FACTURACION", "RECLAMOS VARIOS"] },
  { k: "PERIODO_RECLAMADO", label: "Período/mes reclamado (ej. Junio 2026)" },
  { k: "monto_reclamo", label: "Monto en reclamo (solo número)" },
  { k: "FechaAdmisionReclamo", label: "Fecha de presentación del reclamo (DD/MM/AAAA)" },
  { k: "DescripcionReclamo", label: "Descripción / motivo del reclamo" },
];

// Modal "Iniciar expediente": sube el Formato 1, la IA extrae los datos, y se crea el caso.
// Layout en 2 paneles: formulario (izq) + previsualización del PDF (der) para validar dato por dato.
export default function NuevoCaso({ perfil, onCreado, onClose, existentes = [], inicial = null }) {
  const [f, setF] = useState({ NombreClaseReclamo: "RECLAMOS POR EXCESIVA FACTURACION", ...(inicial || {}) });
  const [file, setFile] = useState(null);
  const [pdfUrl, setPdfUrl] = useState("");
  const [iaBusy, setIaBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sug, setSug] = useState(new Set());
  const inputRef = useRef();
  const set = (k, v) => { setF(p => ({ ...p, [k]: v })); if (sug.has(k)) setSug(s => { const n = new Set(s); n.delete(k); return n; }); };

  // URL local para previsualizar el PDF subido (se libera al cambiar/cerrar).
  useEffect(() => {
    if (!file) { setPdfUrl(""); return; }
    const u = URL.createObjectURL(file);
    setPdfUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  async function extraer() {
    if (!file) { toast("Adjunta primero el Formato 1 (PDF)"); return; }
    setIaBusy(true);
    const r = await extraerCamposIA({ file, etapa: "Recepción", campos: EXTRAER, guardar: false });
    setIaBusy(false);
    if (!r?.ok) { toast("IA: " + (r?.error || "no se pudo leer")); return; }
    const ll = {}, keys = new Set();
    Object.entries(r.campos || {}).forEach(([k, v]) => { if (v != null && String(v).toLowerCase() !== "null" && v !== "") { ll[k] = String(v); keys.add(k); } });
    setF(p => ({ ...p, ...ll })); setSug(keys);
    toast(`IA leyó ${Object.keys(ll).length} dato(s) — revísalos contra el PDF y corrige`);
  }

  async function crear() {
    // Blindaje del registro: estos datos alimentan plazos, penalidades y SIELSE — mejor parar aquí que corregir después.
    if (!f.NombreSolicitante || !f.CodigoSuministro) { toast("Faltan datos: solicitante y suministro"); return; }
    if (!/^\d{6,}$/.test(String(f.CodigoSuministro).trim())) { toast("⚠ El suministro debe ser numérico (mín. 6 dígitos)"); return; }
    if (f.DNI && !/^\d{8}$/.test(String(f.DNI).trim())) { toast("⚠ El DNI debe tener 8 dígitos"); return; }
    if (f.FechaAdmisionReclamo && !/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(String(f.FechaAdmisionReclamo).trim())) { toast("⚠ Fecha admisión en formato DD/MM/AAAA (arranca el cómputo de plazos)"); return; }
    if (f.monto_reclamo && isNaN(parseFloat(f.monto_reclamo))) { toast("⚠ El monto debe ser un número (define la exposición a penalidades)"); return; }
    const dup = existentes.find(x => String(x.suministro) === String(f.CodigoSuministro).trim() && x.estado !== "Cerrado");
    if (dup && !confirm(`⚠ Ya existe un reclamo ABIERTO para el suministro ${dup.suministro} (${dup.osinerg} · ${dup.solicitante}).\n¿Registrar otro de todas formas?`)) return;
    setBusy(true);
    const datos = { ...f, Responsable: perfil?.nombre || "", resp_id: perfil?.resp_id ?? "" };
    const r = await nuevoReclamo(datos);
    if (r?.ok) {
      if (file) { try { await subirArchivo(r.codigo, "01_Recepcion", file); } catch (e) {} }
      // el detalle que NO cabe en la fila del caso (DNI, teléfono, período, forma) se guarda
      // como datos de Recepción: prellena los documentos y es la lista a transcribir a SIELSE
      const extras = Object.fromEntries(Object.entries({
        DNI: f.DNI, TELEFONO: f.TELEFONO, PERIODO_RECLAMADO: f.PERIODO_RECLAMADO,
        MONTO_RECLAMADO: f.monto_reclamo, FORMA_PRESENTACION: f.FORMA_PRESENTACION, TARIFA: f.TARIFA,
      }).filter(([, v]) => v != null && v !== ""));
      if (Object.keys(extras).length) { try { await guardarDatos({ exp: r.codigo, etapa: "Recepción", rol: perfil?.rol, campos: extras }); } catch (e) {} }
    }
    setBusy(false);
    if (r?.ok) { toast("Expediente creado: " + r.codigo + " · queda pendiente transcribirlo a SIELSE en su etapa"); onCreado?.(r.codigo); }
    else toast("No se pudo crear: " + (r?.error || ""));
  }

  return (
    <div className="overlay" style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ width: "min(1180px,97vw)", maxHeight: "94vh", display: "flex", flexDirection: "column", background: "var(--card)", border: "1px solid var(--bd)", borderRadius: 14, boxShadow: "0 20px 60px rgba(22,41,75,.15)" }}>
        {/* header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: "1px solid var(--bd)" }}>
          <div>
            <h3 style={{ margin: 0, color: "var(--titulo)" }}>➕ Registrar reclamo — mesa de partes TELCOM</h3>
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>1) Escanea/adjunta el Formato 1 · 2) la IA extrae los datos · 3) valídalos contra el PDF · 4) se crea el expediente con su flujo. El detalle queda listo para <b>transcribirlo a SIELSE</b> en su etapa (≤2 días háb.).</div>
          </div>
          <button className="btn sec sm" onClick={onClose}>✕ cerrar</button>
        </div>

        {/* 2 paneles: formulario (izq) + visor PDF (der) */}
        <div style={{ display: "flex", gap: 16, padding: 16, overflow: "auto", flexWrap: "wrap" }}>
          {/* ---- FORMULARIO ---- */}
          <div style={{ flex: "1 1 440px", minWidth: 320 }}>
            <div onClick={() => inputRef.current?.click()} style={{ border: "1px dashed var(--bd)", borderRadius: 8, padding: "12px 10px", textAlign: "center", cursor: "pointer", marginBottom: 10 }}>
              <div style={{ fontSize: 13, color: "var(--tx)" }}>{file ? `📄 ${file.name} · cambiar` : "Adjunta el Formato 1 / cargo de recepción (PDF)"}</div>
              <input ref={inputRef} type="file" hidden accept="application/pdf,image/*" onChange={e => setFile(e.target.files[0])} />
            </div>
            <button onClick={extraer} disabled={iaBusy || !file} style={{ width: "100%", background: "rgba(109,40,217,.10)", color: "#6D28D9", border: "1px solid #6d28d9", borderRadius: 8, padding: "8px 12px", fontSize: 12.5, cursor: file ? "pointer" : "not-allowed", fontWeight: 600, marginBottom: 12 }}>
              {iaBusy ? "Leyendo documento…" : "🤖 Extraer datos del Formato 1"}
            </button>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[
                ["NombreSolicitante", "Solicitante *", "text"], ["DNI", "DNI", "text"],
                ["TELEFONO", "Teléfono / celular", "text"], ["CodigoSuministro", "Suministro *", "text"],
                ["NumeroOsinerg", "N° OSINERG", "text"], ["DireccionSolicitante", "Dirección", "text"],
                ["NombreDistrito", "Distrito", "text"], ["FechaAdmisionReclamo", "Fecha admisión (DD/MM/AAAA)", "text"],
                ["PERIODO_RECLAMADO", "Período reclamado", "text"], ["monto_reclamo", "Monto en reclamo (S/)", "num"],
              ].map(([k, lab, tipo]) => (
                <label key={k} style={{ fontSize: 12 }}>
                  <span style={{ color: "var(--mut)" }}>{lab}{sug.has(k) && <span style={badge}>IA</span>}</span>
                  <input type={tipo === "num" ? "number" : "text"} value={f[k] || ""} onChange={e => set(k, e.target.value)} style={inp(sug.has(k))} />
                </label>
              ))}
              <label style={{ fontSize: 12 }}>
                <span style={{ color: "var(--mut)" }}>Materia{sug.has("NombreClaseReclamo") && <span style={badge}>IA</span>}</span>
                <select value={f.NombreClaseReclamo || ""} onChange={e => set("NombreClaseReclamo", e.target.value)} style={inp(sug.has("NombreClaseReclamo"))}>
                  <option value="RECLAMOS POR EXCESIVA FACTURACION">Excesiva facturación</option>
                  <option value="RECLAMOS VARIOS">Varios</option>
                </select>
              </label>
              <label style={{ fontSize: 12 }}>
                <span style={{ color: "var(--mut)" }}>Forma de presentación</span>
                <select value={f.FORMA_PRESENTACION || ""} onChange={e => set("FORMA_PRESENTACION", e.target.value)} style={inp(false)}>
                  <option value="">—</option><option>Presencial (ventanilla)</option><option>Web</option><option>Teléfono</option><option>Correo</option>
                </select>
              </label>
              <label style={{ fontSize: 12, gridColumn: "1 / -1" }}>
                <span style={{ color: "var(--mut)" }}>Descripción{sug.has("DescripcionReclamo") && <span style={badge}>IA</span>}</span>
                <textarea rows={3} value={f.DescripcionReclamo || ""} onChange={e => set("DescripcionReclamo", e.target.value)} style={inp(sug.has("DescripcionReclamo"))} />
              </label>
            </div>

            <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <button onClick={crear} disabled={busy} style={{ background: "var(--navy)", color: "#fff", border: 0, borderRadius: 8, padding: "9px 18px", fontSize: 14, cursor: "pointer", fontWeight: 600 }}>
                {busy ? "Creando…" : "Crear expediente"}
              </button>
              <span className="muted" style={{ fontSize: 11 }}>Se genera su flujo de etapas y se archiva el Formato 1 en Recepción.</span>
            </div>
          </div>

          {/* ---- VISOR PDF ---- */}
          <div style={{ flex: "1 1 460px", minWidth: 320, display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 11, color: "var(--mut)", marginBottom: 6, textTransform: "uppercase", letterSpacing: .4 }}>📄 Documento subido — valida los datos aquí</div>
            <div style={{ flex: 1, minHeight: "62vh", border: "1px solid var(--bd)", borderRadius: 10, overflow: "hidden", background: "var(--card2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {pdfUrl
                ? <iframe title="pdf" src={pdfUrl} style={{ width: "100%", height: "100%", border: 0 }} />
                : <div className="muted" style={{ fontSize: 13, textAlign: "center", padding: 24 }}>Sube el Formato 1 (PDF) para previsualizarlo aquí y validar la extracción.</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
const badge = { marginLeft: 5, fontSize: 9, background: "#6d28d9", color: "#fff", borderRadius: 4, padding: "1px 4px" };
const inp = sug => ({ width: "100%", marginTop: 3, padding: "7px 9px", borderRadius: 8, fontSize: 13, fontFamily: "inherit", background: "#fff", color: "var(--tx)", border: `1px solid ${sug ? "#7c3aed" : "var(--bd)"}`, boxSizing: "border-box" });
