import { useState, useRef, useMemo } from "react";
import { CAMPOS_ETAPA, CAMPOS_POR_FALLO, AYUDA_CAMPO } from "../lib/camposEtapa.js";
import { subirArchivo, extraerCamposIA } from "../lib/api.js";
import { toast } from "./ui.jsx";

// Formulario para subir la evidencia (PDF/imagen) de una etapa + los datos que la fase requiere.
export default function SubirEvidencia({ reclamo, etapa, etapaNN, perfil, onSaveDatos, onSubido, onClose }) {
  const specBase = CAMPOS_ETAPA[etapa];
  const [files, setFiles] = useState([]);
  const [datos, setDatos] = useState({});
  // En "Resolución" los campos dependen del sentido del fallo elegido (reactivo a SENTIDO_FALLO).
  const extra = etapa === "Resolución" ? (CAMPOS_POR_FALLO[datos.SENTIDO_FALLO] || []) : [];
  const spec = useMemo(() => {
    if (!specBase) return specBase;
    if (!extra.length) return specBase;
    return { ...specBase, campos: [...specBase.campos, ...extra] };
  }, [specBase, extra]);
  const [busy, setBusy] = useState(false);
  const [hechos, setHechos] = useState([]);
  const [over, setOver] = useState(false);
  const [iaBusy, setIaBusy] = useState(false);
  const [sugeridos, setSugeridos] = useState(new Set());
  const inputRef = useRef();

  const addFiles = fl => setFiles(prev => [...prev, ...[...fl]]);

  // La IA lee el documento y SUGIERE valores en el formulario (editables, no se guardan hasta que el trabajador confirma).
  async function extraer() {
    if (!files.length) { toast("Adjunta primero el documento a leer"); return; }
    if (!spec) { toast("Esta etapa no tiene campos a extraer"); return; }
    setIaBusy(true);
    const r = await extraerCamposIA({ file: files[0], etapa, reclamo, guardar: false,
      campos: spec.campos.map(c => ({ k: c.k, label: c.label, opciones: c.opciones })) });
    setIaBusy(false);
    if (!r?.ok) { toast("IA: " + (r?.error || "no se pudo extraer")); return; }
    const ll = {}; const keys = new Set();
    Object.entries(r.campos || {}).forEach(([k, v]) => { if (v != null && v !== "" && String(v).toLowerCase() !== "null") { ll[k] = String(v); keys.add(k); } });
    setDatos(d => ({ ...d, ...ll })); setSugeridos(keys);
    toast(`IA sugirió ${Object.keys(ll).length} dato(s) — revísalos y corrige antes de guardar`);
  }

  async function guardar() {
    if (!files.length && !Object.keys(datos).length) { toast("Adjunta un archivo o completa algún dato"); return; }
    setBusy(true);
    const subidos = [];
    for (const f of files) {
      const r = await subirArchivo(reclamo, etapaNN, f);
      subidos.push({ nombre: f.name, url: r?.url, ok: !!r?.ok });
      if (r?.ok && onSubido) onSubido({ exp: reclamo, etapa, nombre: f.name, tipo: (f.name.split(".").pop() || "PDF").toUpperCase(), url: r.url, fecha: new Date().toISOString().slice(0, 10), resp: perfil.resp_id, usuario: perfil.usuario });
    }
    const llenos = Object.fromEntries(Object.entries(datos).filter(([, v]) => v !== "" && v != null));
    let datosOk = true;
    if (Object.keys(llenos).length && onSaveDatos) {
      const rd = await onSaveDatos({ exp: reclamo, etapa, rol: perfil.rol, campos: llenos });
      if (rd && rd.ok === false) { datosOk = false; toast("⚠ Los datos NO se guardaron: " + (rd.error || "error")); }
    }
    setHechos(subidos); setBusy(false);
    const fallidos = subidos.filter(s => !s.ok).length;
    if (fallidos) toast(`⚠ ${fallidos} archivo(s) NO se subieron — reintenta`);
    else if (datosOk) toast((subidos.filter(s => s.ok).length || "0") + " archivo(s) subido(s) · datos guardados");
    if (subidos.length && subidos.every(s => s.ok)) setFiles([]);
  }

  return (
    <div style={{ background: "rgba(31,78,140,.12)", border: "1px solid #1e3a5f", borderRadius: 10, padding: 12, marginTop: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <b style={{ fontSize: 12.5, color: "#cbd5e1" }}>Subir evidencia de «{etapa}»</b>
        <button onClick={onClose} style={xbtn}>✕</button>
      </div>

      {/* dropzone */}
      <div onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={e => { e.preventDefault(); setOver(false); addFiles(e.dataTransfer.files); }}
        style={{ border: `1px dashed ${over ? "#60a5fa" : "#334155"}`, borderRadius: 8, padding: "14px 10px", textAlign: "center", cursor: "pointer", background: over ? "rgba(96,165,250,.08)" : "transparent" }}>
        <div style={{ fontSize: 12.5, color: "#cbd5e1" }}>Arrastra el PDF (o imágenes) aquí, o haz clic</div>
        <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>Ej.: un solo PDF con las firmas / el cargo / las fotos de la etapa</div>
        <input ref={inputRef} type="file" multiple hidden onChange={e => addFiles(e.target.files)} />
      </div>
      {files.length > 0 && (
        <div style={{ marginTop: 8, display: "grid", gap: 4 }}>
          {files.map((f, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#e2e8f0", background: "#0f1828", border: "1px solid #1e2a3e", borderRadius: 6, padding: "5px 9px" }}>
              <span>📄 {f.name} <span className="muted" style={{ fontSize: 10 }}>{Math.round(f.size / 1024)} KB</span></span>
              <button onClick={() => setFiles(fs => fs.filter((_, k) => k !== i))} style={xbtn}>quitar</button>
            </div>
          ))}
        </div>
      )}

      {/* datos de la fase */}
      {spec && (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, gap: 8, flexWrap: "wrap" }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em", color: "#5b6b80", fontWeight: 700 }}>Datos de la fase</div>
            <button onClick={extraer} disabled={iaBusy || !files.length} title={files.length ? "La IA lee el documento y sugiere los datos" : "Adjunta primero el documento"}
              style={{ background: "rgba(124,58,237,.18)", color: "#c4b5fd", border: "1px solid #6d28d9", borderRadius: 8, padding: "5px 10px", fontSize: 11.5, cursor: files.length ? "pointer" : "not-allowed", fontWeight: 600 }}>
              {iaBusy ? "Leyendo documento…" : "🤖 Extraer del documento (sugerencia)"}
            </button>
          </div>
          {sugeridos.size > 0 && <div style={{ fontSize: 11, color: "#c4b5fd", marginBottom: 6 }}>✨ La IA sugirió {sugeridos.size} dato(s) — <b>revísalos y corrige</b> antes de guardar.</div>}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {spec.campos.map(c => {
              const sg = sugeridos.has(c.k);
              const st = sg ? { ...inp, borderColor: "#7c3aed", background: "rgba(124,58,237,.08)" } : inp;
              const set = v => { setDatos(d => ({ ...d, [c.k]: v })); if (sg) setSugeridos(s => { const n = new Set(s); n.delete(c.k); return n; }); };
              return (
                <label key={c.k} title={AYUDA_CAMPO[c.k] || ""} style={{ fontSize: 12, gridColumn: c.tipo === "textarea" ? "1 / -1" : undefined }}>
                  <span style={{ color: "#94a3b8" }}>{c.label}{AYUDA_CAMPO[c.k] && <span style={{ color: "#60a5fa" }}> ⓘ</span>}{sg && <span style={{ marginLeft: 5, fontSize: 9, background: "#6d28d9", color: "#fff", borderRadius: 4, padding: "1px 4px" }}>IA</span>}</span>
                  {c.tipo === "select"
                    ? <select value={datos[c.k] || ""} onChange={e => set(e.target.value)} style={st}><option value="">—</option>{c.opciones.map(o => <option key={o} value={o}>{o}</option>)}</select>
                    : c.tipo === "textarea"
                      ? <textarea rows={2} value={datos[c.k] || ""} onChange={e => set(e.target.value)} style={st} />
                      : <input type={c.tipo === "num" ? "number" : "text"} placeholder={c.ph || ""} value={datos[c.k] || ""} onChange={e => set(e.target.value)} style={st} />}
                </label>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={guardar} disabled={busy} style={{ background: "#1F4E8C", color: "#fff", border: 0, borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
          {busy ? "Subiendo…" : "Subir evidencia y guardar"}
        </button>
        {hechos.length > 0 && <span style={{ fontSize: 12, color: "#22c55e" }}>✓ {hechos.filter(h => h.ok).length} subido(s)</span>}
      </div>
      {hechos.some(h => h.ok && h.url) && (
        <div style={{ marginTop: 8, display: "grid", gap: 3 }}>
          {hechos.filter(h => h.url).map((h, i) => <a key={i} href={h.url} target="_blank" rel="noreferrer" style={{ color: "#60a5fa", fontSize: 12 }}>🔗 {h.nombre}</a>)}
        </div>
      )}
    </div>
  );
}

const inp = { width: "100%", marginTop: 3, padding: "6px 8px", borderRadius: 7, fontSize: 12.5, fontFamily: "inherit", background: "#0e1726", color: "#e2e8f0", border: "1px solid #334155" };
const xbtn = { border: "1px solid #334155", borderRadius: 6, background: "transparent", color: "#94a3b8", cursor: "pointer", fontSize: 11, padding: "2px 7px" };
