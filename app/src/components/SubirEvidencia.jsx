import { useState, useRef, useMemo } from "react";
import { CAMPOS_ETAPA, CAMPOS_POR_FALLO, AYUDA_CAMPO } from "../lib/camposEtapa.js";
import { subirArchivo, extraerCamposIA } from "../lib/api.js";
import { toast } from "./ui.jsx";

// Formulario para subir la evidencia (PDF/imagen) de una etapa + los datos que la fase requiere.
// `previos` = lo YA registrado en la etapa + lo ya digitado en SIELSE (espejo): el formulario
// nace pre-llenado para CORREGIR, no para volver a digitar; solo se guarda lo que cambió.
export default function SubirEvidencia({ reclamo, etapa, etapaNN, perfil, previos, onSaveDatos, onSubido, onClose }) {
  const specBase = CAMPOS_ETAPA[etapa];
  const [files, setFiles] = useState([]);
  const [datos, setDatos] = useState(() => ({ ...(previos || {}) }));
  const [precargados, setPrecargados] = useState(() => new Set(Object.keys(previos || {})));
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

  // solo lo NUEVO o CORREGIDO viaja al backend — lo pre-cargado sin tocar no se re-guarda
  const cambiados = () => Object.fromEntries(Object.entries(datos)
    .filter(([k, v]) => v !== "" && v != null && String(v) !== String((previos || {})[k] ?? "")));

  async function guardar() {
    const cc = cambiados();
    if (!files.length && !Object.keys(cc).length) { toast("Sin cambios: estos datos ya estaban registrados. Corrige alguno o adjunta un archivo."); return; }
    setBusy(true);
    const subidos = [];
    for (const f of files) {
      const r = await subirArchivo(reclamo, etapaNN, f);
      subidos.push({ nombre: f.name, url: r?.url, ok: !!r?.ok });
      if (r?.ok && onSubido) onSubido({ exp: reclamo, etapa, nombre: f.name, tipo: (f.name.split(".").pop() || "PDF").toUpperCase(), url: r.url, fecha: new Date().toISOString().slice(0, 10), resp: perfil.resp_id, usuario: perfil.usuario });
    }
    const llenos = cc;
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
    <div style={{ background: "rgba(30,58,95,.06)", border: "1px solid var(--navy)", borderRadius: 10, padding: 12, marginTop: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <b style={{ fontSize: 12.5, color: "var(--tx)" }}>Subir evidencia de «{etapa}»</b>
        <button onClick={onClose} style={xbtn}>✕</button>
      </div>

      {/* dropzone */}
      <div onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={e => { e.preventDefault(); setOver(false); addFiles(e.dataTransfer.files); }}
        style={{ border: `1px dashed ${over ? "var(--linkTx)" : "var(--bd)"}`, borderRadius: 8, padding: "14px 10px", textAlign: "center", cursor: "pointer", background: over ? "var(--hoverBg)" : "transparent" }}>
        <div style={{ fontSize: 12.5, color: "var(--tx)" }}>Arrastra el PDF (o imágenes) aquí, o haz clic</div>
        <div style={{ fontSize: 11, color: "var(--mut)", marginTop: 2 }}>Ej.: un solo PDF con las firmas / el cargo / las fotos de la etapa</div>
        <input ref={inputRef} type="file" multiple hidden onChange={e => addFiles(e.target.files)} />
      </div>
      {files.length > 0 && (
        <div style={{ marginTop: 8, display: "grid", gap: 4 }}>
          {files.map((f, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--tx)", background: "var(--card2)", border: "1px solid var(--bd)", borderRadius: 6, padding: "5px 9px" }}>
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
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--mut)", fontWeight: 700 }}>Datos de la fase</div>
            <button onClick={extraer} disabled={iaBusy || !files.length} title={files.length ? "La IA lee el documento y sugiere los datos" : "Adjunta primero el documento"}
              style={{ background: "rgba(109,40,217,.10)", color: "#6D28D9", border: "1px solid #6d28d9", borderRadius: 8, padding: "5px 10px", fontSize: 11.5, cursor: files.length ? "pointer" : "not-allowed", fontWeight: 600 }}>
              {iaBusy ? "Leyendo documento…" : "🤖 Extraer del documento (sugerencia)"}
            </button>
          </div>
          {sugeridos.size > 0 && <div style={{ fontSize: 11, color: "#6D28D9", marginBottom: 6 }}>✨ La IA sugirió {sugeridos.size} dato(s) — <b>revísalos y corrige</b> antes de guardar.</div>}
          {precargados.size > 0 && <div style={{ fontSize: 11, color: "#15803D", marginBottom: 6 }}>✓ {precargados.size} dato(s) ya registrados (aquí o en SIELSE) vienen pre-llenados — <b>corrige solo si hace falta</b>; lo que no toques no se vuelve a guardar.</div>}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {spec.campos.map(c => {
              const sg = sugeridos.has(c.k);
              const pc = !sg && precargados.has(c.k) && String(datos[c.k] ?? "") !== "";
              const st = sg ? { ...inp, borderColor: "#7c3aed", background: "rgba(109,40,217,.06)" }
                : pc ? { ...inp, borderColor: "#BFE5CB", background: "#F4FBF6" } : inp;
              const set = v => { setDatos(d => ({ ...d, [c.k]: v })); if (sg) setSugeridos(s => { const n = new Set(s); n.delete(c.k); return n; }); if (precargados.has(c.k)) setPrecargados(s => { const n = new Set(s); n.delete(c.k); return n; }); };
              return (
                <label key={c.k} title={AYUDA_CAMPO[c.k] || ""} style={{ fontSize: 12, gridColumn: c.tipo === "textarea" ? "1 / -1" : undefined }}>
                  <span style={{ color: "var(--mut)" }}>{c.label}{AYUDA_CAMPO[c.k] && <span style={{ color: "var(--linkTx)" }}> ⓘ</span>}{sg && <span style={{ marginLeft: 5, fontSize: 9, background: "#6d28d9", color: "#fff", borderRadius: 4, padding: "1px 4px" }}>IA</span>}{pc && <span title="Ya registrado aquí o digitado en SIELSE — solo se re-guarda si lo corriges" style={{ marginLeft: 5, fontSize: 9, background: "#E8F6EC", color: "#15803D", border: "1px solid #BFE5CB", borderRadius: 4, padding: "1px 4px" }}>✓ ya registrado</span>}</span>
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
        {(() => {
          const sinNada = !files.length && !Object.keys(cambiados()).length;
          const disabled = busy || sinNada;
          return (
            <button onClick={guardar} disabled={disabled}
              title={sinNada ? "Todo ya está registrado — corrige algún dato o adjunta un archivo para guardar" : undefined}
              style={{ background: "var(--navy)", color: "#fff", border: 0, borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, opacity: disabled ? .5 : 1, cursor: disabled ? "default" : "pointer" }}>
              {busy ? "Subiendo…" : "Subir evidencia y guardar"}
            </button>
          );
        })()}
        {hechos.length > 0 && <span style={{ fontSize: 12, color: "#15803D" }}>✓ {hechos.filter(h => h.ok).length} subido(s)</span>}
      </div>
      {hechos.some(h => h.ok && h.url) && (
        <div style={{ marginTop: 8, display: "grid", gap: 3 }}>
          {hechos.filter(h => h.url).map((h, i) => <a key={i} href={h.url} target="_blank" rel="noreferrer" style={{ color: "var(--linkTx)", fontSize: 12 }}>🔗 {h.nombre}</a>)}
        </div>
      )}
    </div>
  );
}

const inp = { width: "100%", marginTop: 3, padding: "6px 8px", borderRadius: 7, fontSize: 12.5, fontFamily: "inherit", background: "#fff", color: "var(--tx)", border: "1px solid var(--bd)" };
const xbtn = { border: "1px solid var(--bd)", borderRadius: 6, background: "transparent", color: "var(--mut)", cursor: "pointer", fontSize: 11, padding: "2px 7px" };
