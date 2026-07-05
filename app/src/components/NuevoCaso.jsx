import { useState, useRef, useEffect } from "react";
import { nuevoReclamo, subirArchivo, extraerCamposIA, guardarDatos, loadCatalogos } from "../lib/api.js";
import { toast } from "./ui.jsx";
import { CATALOGOS_LOCAL, agruparCatalogos, mezclarCatalogos } from "../lib/catalogosSielse.js";

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

const PASOS = [
  { n: 1, titulo: "¿Qué reclama?" },
  { n: 2, titulo: "Documento" },
  { n: 3, titulo: "¿Quién reclama?" },
  { n: 4, titulo: "Suministro y pedido" },
  { n: 5, titulo: "Revisar y crear" },
];

// Modal "Iniciar expediente": wizard de 5 pasos — sube el Formato 1, la IA extrae los
// datos, se confirman por pantallas y se crea el caso. La lógica de creación (payload,
// duplicados, IA, archivo) es exactamente la misma que antes; solo cambió la presentación.
export default function NuevoCaso({ perfil, onCreado, onClose, existentes = [], inicial = null }) {
  // si el caso viene de la Bandeja (correo), preseleccionamos forma de presentación
  const [f, setF] = useState({ NombreClaseReclamo: "RECLAMOS POR EXCESIVA FACTURACION", ...(inicial ? { FORMA_PRESENTACION: "CORREO ELECTRONICO" } : {}), ...(inicial || {}) });
  const [file, setFile] = useState(null);
  const [pdfUrl, setPdfUrl] = useState("");
  const [iaBusy, setIaBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sug, setSug] = useState(new Set());
  const [cats, setCats] = useState(CATALOGOS_LOCAL);
  const [paso, setPaso] = useState(1);
  const inputRef = useRef();
  const set = (k, v) => { setF(p => ({ ...p, [k]: v })); if (sug.has(k)) setSug(s => { const n = new Set(s); n.delete(k); return n; }); };

  // Catálogos SIELSE: Sheet manda, respaldo local completa lo que falte.
  useEffect(() => {
    let vivo = true;
    loadCatalogos().then(rows => {
      if (!vivo) return;
      const deSheet = rows ? agruparCatalogos(rows) : {};
      setCats(mezclarCatalogos(deSheet));
    }).catch(() => { /* queda CATALOGOS_LOCAL */ });
    return () => { vivo = false; };
  }, []);

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
    if (!f.NombreClaseReclamo) { toast("Falta la materia del reclamo — complétalo en el paso 1"); setPaso(1); return; }
    if (!f.NombreSolicitante) { toast("Falta el reclamante — complétalo en el paso 3"); setPaso(3); return; }
    if (!f.CodigoSuministro) { toast("Falta el suministro — complétalo en el paso 4"); setPaso(4); return; }
    if (!f.DescripcionReclamo) { toast("Falta la descripción del reclamo — complétalo en el paso 4"); setPaso(4); return; }
    if (!/^\d{6,}$/.test(String(f.CodigoSuministro).trim())) { toast("⚠ El suministro debe ser numérico (mín. 6 dígitos)"); setPaso(4); return; }
    if (f.DNI && !/^\d{8}$/.test(String(f.DNI).trim())) { toast("⚠ El DNI debe tener 8 dígitos"); setPaso(3); return; }
    if (f.FechaAdmisionReclamo && !/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(String(f.FechaAdmisionReclamo).trim())) { toast("⚠ Fecha admisión en formato DD/MM/AAAA (arranca el cómputo de plazos)"); setPaso(2); return; }
    if (f.monto_reclamo && isNaN(parseFloat(f.monto_reclamo))) { toast("⚠ El monto debe ser un número (define la exposición a penalidades)"); setPaso(4); return; }
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

  const completo = {
    1: !!f.NombreClaseReclamo && !!f.FORMA_PRESENTACION,
    2: !!file,
    3: !!f.NombreSolicitante,
    4: !!f.CodigoSuministro && !!f.DescripcionReclamo,
    5: false,
  };
  const irA = n => setPaso(n);
  const siguiente = () => setPaso(p => Math.min(5, p + 1));
  const anterior = () => setPaso(p => Math.max(1, p - 1));

  return (
    <div className="overlay" style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ width: "min(1180px,97vw)", maxHeight: "94vh", display: "flex", flexDirection: "column", background: "var(--card)", border: "1px solid var(--bd)", borderRadius: 14, boxShadow: "0 20px 60px rgba(22,41,75,.15)" }}>
        {/* header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: "1px solid var(--bd)" }}>
          <div>
            <h3 style={{ margin: 0, color: "var(--titulo)" }}>➕ Registrar reclamo — mesa de partes TELCOM</h3>
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>Paso {paso} de 5 — {PASOS[paso - 1].titulo}. El detalle queda listo para <b>transcribirlo a SIELSE</b> en su etapa (≤2 días háb.).</div>
          </div>
          <button className="btn sec sm" onClick={onClose}>✕ cerrar</button>
        </div>

        {/* stepper de pills */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "12px 18px", borderBottom: "1px solid var(--bd)", flexWrap: "wrap" }}>
          {PASOS.map((p, i) => (
            <div key={p.n} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button
                onClick={() => irA(p.n)}
                title={p.titulo}
                style={{
                  display: "flex", alignItems: "center", gap: 6, border: "1px solid " + (paso === p.n ? "var(--acc)" : "var(--bd)"),
                  background: paso === p.n ? "var(--acc)" : (completo[p.n] ? "var(--selBg)" : "var(--card2)"),
                  color: paso === p.n ? "#fff" : "var(--tx)", borderRadius: 999, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer",
                }}>
                <span style={{
                  width: 18, height: 18, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center",
                  fontSize: 10, background: paso === p.n ? "rgba(255,255,255,.25)" : (completo[p.n] ? "#15803D" : "var(--bd)"),
                  color: paso === p.n ? "#fff" : (completo[p.n] ? "#fff" : "var(--mut)"),
                }}>{completo[p.n] ? "✓" : p.n}</span>
                {p.titulo}
              </button>
              {i < PASOS.length - 1 && <span style={{ color: "var(--mut)", fontSize: 11 }}>—</span>}
            </div>
          ))}
        </div>

        {/* contenido del paso */}
        <div style={{ padding: 18, overflow: "auto", flex: 1 }}>
          {paso === 1 && (
            <Paso1 f={f} set={set} cats={cats} />
          )}
          {paso === 2 && (
            <Paso2 file={file} setFile={setFile} inputRef={inputRef} pdfUrl={pdfUrl} iaBusy={iaBusy} extraer={extraer} f={f} set={set} sug={sug} />
          )}
          {paso === 3 && (
            <Paso3 f={f} set={set} sug={sug} cats={cats} />
          )}
          {paso === 4 && (
            <Paso4 f={f} set={set} sug={sug} />
          )}
          {paso === 5 && (
            <Paso5 f={f} file={file} />
          )}
        </div>

        {/* navegación */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderTop: "1px solid var(--bd)" }}>
          <button className="btn sec sm" onClick={anterior} disabled={paso === 1} style={{ opacity: paso === 1 ? .45 : 1, cursor: paso === 1 ? "not-allowed" : "pointer" }}>← Volver</button>
          {paso < 5
            ? <button onClick={siguiente} style={{ background: "var(--acc)", color: "#fff", border: 0, borderRadius: 8, padding: "9px 20px", fontSize: 14, cursor: "pointer", fontWeight: 600 }}>Continuar →</button>
            : <button onClick={crear} disabled={busy} style={{ background: "#15803D", color: "#fff", border: 0, borderRadius: 8, padding: "9px 20px", fontSize: 14, cursor: "pointer", fontWeight: 600 }}>{busy ? "Creando…" : "Crear expediente ✓"}</button>}
        </div>
      </div>
    </div>
  );
}

/* ===================== PASO 1 — ¿Qué reclama el usuario? ===================== */
function Paso1({ f, set, cats }) {
  const clases = cats.CLASE_RECLAMO || [];
  const formas = cats.FORMA_RECLAMO || [];
  return (
    <div>
      <h4 style={{ margin: "0 0 4px", color: "var(--navy)" }}>¿Qué reclama el usuario?</h4>
      <div className="muted" style={{ fontSize: 12, marginBottom: 14 }}>Esto es lo primero que SIELSE pregunta al registrar la solicitud.</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 10, marginBottom: 18 }}>
        {clases.map(c => {
          const activo = f.NombreClaseReclamo === c.valor;
          return (
            <div key={c.valor} onClick={() => set("NombreClaseReclamo", c.valor)}
              style={{
                cursor: "pointer", borderRadius: 10, padding: "14px 12px", border: "2px solid " + (activo ? "var(--acc)" : "var(--bd)"),
                background: activo ? "var(--selBg)" : "var(--card2)", transition: "border .15s",
              }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>{c.icono || "📄"}</div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--tx)" }}>{c.valor}</div>
              {c.ayuda && <div className="muted" style={{ fontSize: 11.5, marginTop: 3 }}>{c.ayuda}</div>}
            </div>
          );
        })}
      </div>
      <label style={{ fontSize: 12, display: "block", maxWidth: 340 }}>
        <span style={{ color: "var(--mut)" }}>¿Cómo llegó el reclamo?</span>
        <select value={f.FORMA_PRESENTACION || ""} onChange={e => set("FORMA_PRESENTACION", e.target.value)} style={inp(false)}>
          <option value="">—</option>
          {formas.map(x => <option key={x.valor} value={x.valor}>{x.valor}</option>)}
        </select>
      </label>
    </div>
  );
}

/* ===================== PASO 2 — Sube lo que llegó a mesa de partes ===================== */
function Paso2({ file, setFile, inputRef, pdfUrl, iaBusy, extraer, f, set, sug }) {
  const sugerenciaClase = sug.has("NombreClaseReclamo") && f.NombreClaseReclamo;
  return (
    <div>
      <h4 style={{ margin: "0 0 4px", color: "var(--navy)" }}>Sube lo que llegó a mesa de partes</h4>
      <div className="muted" style={{ fontSize: 12, marginBottom: 14 }}>Adjunta el Formato 1 / cargo de recepción y deja que la IA lea los datos.</div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {/* izquierda: dropzone + visor */}
        <div style={{ flex: "1 1 440px", minWidth: 300, display: "flex", flexDirection: "column" }}>
          <div onClick={() => inputRef.current?.click()} style={{ border: "1px dashed var(--bd)", borderRadius: 8, padding: "12px 10px", textAlign: "center", cursor: "pointer", marginBottom: 10 }}>
            <div style={{ fontSize: 13, color: "var(--tx)" }}>{file ? `📄 ${file.name} · cambiar` : "Adjunta el Formato 1 / cargo de recepción (PDF)"}</div>
            <input ref={inputRef} type="file" hidden accept="application/pdf,image/*" onChange={e => setFile(e.target.files[0])} />
          </div>
          <div style={{ flex: 1, minHeight: "50vh", border: "1px solid var(--bd)", borderRadius: 10, overflow: "hidden", background: "var(--card2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {pdfUrl
              ? <iframe title="pdf" src={pdfUrl} style={{ width: "100%", height: "100%", border: 0 }} />
              : <div className="muted" style={{ fontSize: 13, textAlign: "center", padding: 24 }}>Sube el Formato 1 (PDF) para previsualizarlo aquí.</div>}
          </div>
        </div>

        {/* derecha: panel IA */}
        <div style={{ flex: "1 1 380px", minWidth: 300 }}>
          <button onClick={extraer} disabled={iaBusy || !file} style={{ width: "100%", background: "rgba(109,40,217,.10)", color: "#6D28D9", border: "1px solid #6d28d9", borderRadius: 8, padding: "8px 12px", fontSize: 12.5, cursor: file ? "pointer" : "not-allowed", fontWeight: 600, marginBottom: 12 }}>
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
                <span style={{ color: "var(--mut)" }}>{lab}{sug.has(k) && <span style={badgeDudoso}>revisar</span>}</span>
                <input type={tipo === "num" ? "number" : "text"} value={f[k] || ""} onChange={e => set(k, e.target.value)} style={inp(sug.has(k))} />
              </label>
            ))}
            <label style={{ fontSize: 12, gridColumn: "1 / -1" }}>
              <span style={{ color: "var(--mut)" }}>Descripción{sug.has("DescripcionReclamo") && <span style={badgeDudoso}>revisar</span>}</span>
              <textarea rows={3} value={f.DescripcionReclamo || ""} onChange={e => set("DescripcionReclamo", e.target.value)} style={inp(sug.has("DescripcionReclamo"))} />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===================== PASO 3 — ¿Quién reclama? ===================== */
function Paso3({ f, set, sug, cats }) {
  const tiposDoc = cats.TIPO_DOC || [];
  const grados = cats.GRADO_PARENTESCO || [];
  const tipoActivo = f.TIPO_DOC || tiposDoc[0]?.valor || "";
  return (
    <div>
      <h4 style={{ margin: "0 0 4px", color: "var(--navy)" }}>¿Quién reclama?</h4>
      <div className="muted" style={{ fontSize: 12, marginBottom: 14 }}>Prellenado por la IA — confirma o corrige.</div>

      <div className="muted" style={{ fontSize: 11, marginBottom: 6, textTransform: "uppercase", letterSpacing: .4 }}>Tipo de documento</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        {tiposDoc.map(t => {
          const activo = tipoActivo === t.valor;
          return (
            <button key={t.valor} onClick={() => set("TIPO_DOC", t.valor)}
              style={{
                background: activo ? "var(--navy)" : "var(--card2)", color: activo ? "#fff" : "var(--tx)",
                border: "1px solid " + (activo ? "var(--navy)" : "var(--bd)"), borderRadius: 8, padding: "7px 14px", fontSize: 12.5, cursor: "pointer", fontWeight: 600,
              }}>{t.valor}</button>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, maxWidth: 640 }}>
        <label style={{ fontSize: 12 }}>
          <span style={{ color: "var(--mut)" }}>N° de documento{sug.has("DNI") && <span style={badgeDudoso}>revisar</span>}</span>
          <input type="text" value={f.DNI || ""} onChange={e => set("DNI", e.target.value)} style={inp(sug.has("DNI"))} />
        </label>
        <label style={{ fontSize: 12 }}>
          <span style={{ color: "var(--mut)" }}>Solicitante / reclamante *{sug.has("NombreSolicitante") && <span style={badgeDudoso}>revisar</span>}</span>
          <input type="text" value={f.NombreSolicitante || ""} onChange={e => set("NombreSolicitante", e.target.value)} style={inp(sug.has("NombreSolicitante"))} />
        </label>
        <label style={{ fontSize: 12 }}>
          <span style={{ color: "var(--mut)" }}>Celular / teléfono{sug.has("TELEFONO") && <span style={badgeDudoso}>revisar</span>}</span>
          <input type="text" value={f.TELEFONO || ""} onChange={e => set("TELEFONO", e.target.value)} style={inp(sug.has("TELEFONO"))} />
        </label>
        <label style={{ fontSize: 12 }}>
          <span style={{ color: "var(--mut)" }}>Correo electrónico</span>
          <input type="text" value={f.CORREO || ""} onChange={e => set("CORREO", e.target.value)} style={inp(false)} />
        </label>
        <label style={{ fontSize: 12 }}>
          <span style={{ color: "var(--mut)" }}>Grado de parentesco</span>
          <select value={f.GRADO_PARENTESCO || "Propietario"} onChange={e => set("GRADO_PARENTESCO", e.target.value)} style={inp(false)}>
            {grados.map(g => <option key={g.valor} value={g.valor}>{g.valor}</option>)}
          </select>
        </label>
      </div>
    </div>
  );
}

/* ===================== PASO 4 — ¿Sobre qué suministro y qué pide? ===================== */
function Paso4({ f, set, sug }) {
  return (
    <div>
      <h4 style={{ margin: "0 0 4px", color: "var(--navy)" }}>¿Sobre qué suministro y qué pide?</h4>
      <div className="muted" style={{ fontSize: 12, marginBottom: 14 }}>Confirma el suministro y el detalle del reclamo.</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, maxWidth: 640 }}>
        <label style={{ fontSize: 12 }}>
          <span style={{ color: "var(--mut)" }}>Suministro *{sug.has("CodigoSuministro") && <span style={badgeDudoso}>revisar</span>}</span>
          <input type="text" value={f.CodigoSuministro || ""} onChange={e => set("CodigoSuministro", e.target.value)} style={inp(sug.has("CodigoSuministro"))} />
        </label>
        <label style={{ fontSize: 12 }}>
          <span style={{ color: "var(--mut)" }}>N° OSINERG{sug.has("NumeroOsinerg") && <span style={badgeDudoso}>revisar</span>}</span>
          <input type="text" value={f.NumeroOsinerg || ""} onChange={e => set("NumeroOsinerg", e.target.value)} style={inp(sug.has("NumeroOsinerg"))} />
        </label>
        <label style={{ fontSize: 12, gridColumn: "1 / -1" }}>
          <span style={{ color: "var(--mut)" }}>Dirección{sug.has("DireccionSolicitante") && <span style={badgeDudoso}>revisar</span>}</span>
          <input type="text" value={f.DireccionSolicitante || ""} onChange={e => set("DireccionSolicitante", e.target.value)} style={inp(sug.has("DireccionSolicitante"))} />
        </label>
        <label style={{ fontSize: 12 }}>
          <span style={{ color: "var(--mut)" }}>Distrito{sug.has("NombreDistrito") && <span style={badgeDudoso}>revisar</span>}</span>
          <input type="text" value={f.NombreDistrito || ""} onChange={e => set("NombreDistrito", e.target.value)} style={inp(sug.has("NombreDistrito"))} />
        </label>
        <label style={{ fontSize: 12 }}>
          <span style={{ color: "var(--mut)" }}>Monto en reclamo (S/){sug.has("monto_reclamo") && <span style={badgeDudoso}>revisar</span>}</span>
          <input type="number" value={f.monto_reclamo || ""} onChange={e => set("monto_reclamo", e.target.value)} style={inp(sug.has("monto_reclamo"))} />
        </label>
        <label style={{ fontSize: 12, gridColumn: "1 / -1" }}>
          <span style={{ color: "var(--mut)" }}>Pedido / descripción del reclamo *{sug.has("DescripcionReclamo") && <span style={badgeDudoso}>revisar</span>}</span>
          <textarea rows={3} value={f.DescripcionReclamo || ""} onChange={e => set("DescripcionReclamo", e.target.value)} style={inp(sug.has("DescripcionReclamo"))} />
        </label>
      </div>
    </div>
  );
}

/* ===================== PASO 5 — Revisa y crea el expediente ===================== */
function Paso5({ f, file }) {
  const filas = [
    ["Tipo", f.NombreClaseReclamo || "—"],
    ["Forma", f.FORMA_PRESENTACION || "—"],
    ["Reclamante", [f.NombreSolicitante, f.DNI].filter(Boolean).join(" · ") || "—"],
    ["Suministro", [f.CodigoSuministro, f.DireccionSolicitante].filter(Boolean).join(" · ") || "—"],
    ["Documentos adjuntos", file ? `📄 ${file.name}` : "Ninguno"],
  ];
  return (
    <div>
      <h4 style={{ margin: "0 0 4px", color: "var(--navy)" }}>Revisa y crea el expediente</h4>
      <div className="muted" style={{ fontSize: 12, marginBottom: 14 }}>Verifica los datos antes de crear — quedan asociados al expediente.</div>
      <div style={{ background: "var(--card2)", border: "1px solid var(--bd)", borderRadius: 10, padding: 4, maxWidth: 640 }}>
        {filas.map(([k, v]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "9px 12px", borderBottom: "1px solid var(--bd)" }}>
            <span style={{ color: "var(--mut)", fontSize: 12.5 }}>{k}</span>
            <span style={{ color: "var(--tx)", fontSize: 12.5, fontWeight: 600, textAlign: "right" }}>{v}</span>
          </div>
        ))}
        <div style={{ padding: "9px 12px", fontSize: 12, color: "var(--mut)" }}>Se asignará automáticamente al responsable de Recepción.</div>
      </div>
    </div>
  );
}

const badgeDudoso = { marginLeft: 5, fontSize: 9, background: "#B45309", color: "#fff", borderRadius: 4, padding: "1px 4px" };
const inp = sug => ({ width: "100%", marginTop: 3, padding: "7px 9px", borderRadius: 8, fontSize: 13, fontFamily: "inherit", background: "#fff", color: "var(--tx)", border: `1px solid ${sug ? "#B45309" : "var(--bd)"}`, boxSizing: "border-box" });
