import { useState, useRef } from "react";
import { Card, toast } from "./ui.jsx";
import { CUADERNOS } from "../lib/cuadernosDef.js";
import { registroControl, subirArchivo } from "../lib/api.js";

// ============ REGISTRAR EN UN CUADERNO — asistente móvil, simple y grande ============
// Pensado para el trabajador: NO habla de "etapas SIELSE" ni "expedientes". Habla de CUADERNOS
// (sus libros de siempre). 3 pasos: 1) ¿qué cuaderno? · 2) ¿qué suministro/reclamo? · 3) llena
// los campos (los mismos del Excel) + 📷 foto → guardar. Detrás va a registros_control (su cuaderno).

const NO_EDIT = new Set(["item", "usuario", "origen", "cod_reclamo", "numero_osinerg", "reclamo", "suministro"]);
const ES_FECHA = new Set(["fecha_evento", "f2", "f3", "f4"]);
const camposDe = def => {
  const vistos = new Set(), out = [];
  (def.cols || []).forEach(([label, path]) => {
    if (!path || NO_EDIT.has(path) || vistos.has(path)) return;
    vistos.add(path);
    out.push({ path, label, fecha: ES_FECHA.has(path), extra: path.indexOf("extra.") === 0 });
  });
  return out;
};
const hoyISO = () => new Date().toISOString().slice(0, 10);
// cuadernos donde el trabajador registra (temáticos; el padrón se sincroniza aparte)
const CUADS = CUADERNOS.filter(d => d.fuente !== "mensual");

export default function RegistrarEvento({ perfil, data = [], sumInicial = "", onClose, onGuardado }) {
  const [paso, setPaso] = useState(1);
  const [def, setDef] = useState(null);           // cuaderno elegido
  const [suministro, setSuministro] = useState(sumInicial);
  const [reclamo, setReclamo] = useState("");
  const [fecha, setFecha] = useState(hoyISO());
  const [form, setForm] = useState({});
  const [foto, setFoto] = useState(null);
  const [busy, setBusy] = useState(false);
  const camRef = useRef();

  // caso de la cartera que cruza con el suministro escrito (para autocompletar el reclamo)
  const casoDe = s => (data || []).find(x => String(x.suministro || "").trim() === String(s || "").trim());
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const elegirCuaderno = d => {
    setDef(d);
    const c = casoDe(suministro);
    if (c && !reclamo) setReclamo(c.osinerg || c.codigo || "");
    setPaso(suministro ? 3 : 2);
  };
  const irAPaso3 = () => {
    const c = casoDe(suministro);
    if (c && !reclamo) setReclamo(c.osinerg || c.codigo || "");
    setPaso(3);
  };

  const guardar = async () => {
    if (!def) return;
    setBusy(true);
    try {
      const payload = { tipo: def.fuente, fecha_evento: fecha, reclamo: reclamo.trim(), suministro: suministro.trim() };
      const extra = {};
      camposDe(def).forEach(c => {
        const v = (form[c.path] || "").trim ? (form[c.path] || "").trim() : form[c.path];
        if (!v) return;
        if (c.extra) extra[c.path.slice(6)] = v; else payload[c.path] = v;
      });
      if (Object.keys(extra).length) payload.extra = extra;
      const r = await registroControl(payload);
      if (!r || r.ok === false) { toast("No se guardó: " + ((r && r.error) || "error")); setBusy(false); return; }
      // foto opcional → al Drive del caso (si el reclamo existe); si falla, el registro igual quedó
      if (foto && reclamo.trim()) {
        try { await subirArchivo(reclamo.trim(), "99_Evidencia", foto); } catch (e) { /* registro ya guardado */ }
      }
      toast("✓ Registrado en «" + def.nombre + "»");
      onGuardado && onGuardado();
      onClose();
    } catch (e) { toast("Error: " + e); setBusy(false); }
  };

  const cerrar = { position: "absolute", top: 10, right: 12, background: "transparent", border: 0, fontSize: 20, color: "var(--mut)", cursor: "pointer" };
  return (
    <div style={{ position: "fixed", inset: 0, background: "var(--scrim)", zIndex: 98, display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto", padding: "16px 10px" }}>
      <div onClick={e => e.stopPropagation()} style={{ position: "relative", background: "var(--card)", borderRadius: 16, padding: 18, width: "min(560px,100%)", boxShadow: "var(--shadow-modal)" }}>
        <button onClick={onClose} style={cerrar}>✕</button>
        <h2 style={{ margin: "0 0 2px", fontSize: 19 }}>➕ Registrar en un cuaderno</h2>
        <div className="muted" style={{ fontSize: 12, marginBottom: 14 }}>Paso {paso} de 3 · como en tus hojas de siempre</div>

        {paso === 1 && <>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>¿En qué cuaderno vas a registrar?</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {CUADS.map(d => <button key={d.key} onClick={() => elegirCuaderno(d)}
              style={{ textAlign: "left", padding: "13px 12px", borderRadius: 12, border: "1px solid var(--bd)", background: "var(--card2)", cursor: "pointer", fontSize: 13.5, fontWeight: 600, color: "var(--tx)", minHeight: 52 }}>
              {d.emoji} {d.nombre}</button>)}
          </div>
        </>}

        {paso === 2 && <>
          <button className="btn sm" onClick={() => setPaso(1)} style={{ marginBottom: 12 }}>← Cuaderno</button>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>¿De qué suministro?</div>
          <input autoFocus value={suministro} onChange={e => setSuministro(e.target.value)} placeholder="N° de suministro (ej. 10010733988)"
            style={{ width: "100%", padding: 13, fontSize: 16, borderRadius: 10, border: "1px solid var(--bd)", boxSizing: "border-box" }} />
          {suministro && casoDe(suministro) && <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>✓ {casoDe(suministro).solicitante} · {casoDe(suministro).osinerg}</div>}
          <div style={{ marginTop: 8 }}>
            <div className="muted" style={{ fontSize: 11.5, marginBottom: 4 }}>Reclamo (opcional si no lo sabes):</div>
            <input value={reclamo} onChange={e => setReclamo(e.target.value)} placeholder="Código / N° OSINERG"
              style={{ width: "100%", padding: 12, fontSize: 16, borderRadius: 10, border: "1px solid var(--bd)", boxSizing: "border-box" }} />
          </div>
          <button className="btn" onClick={irAPaso3} disabled={!suministro.trim()}
            style={{ width: "100%", marginTop: 14, padding: 13, fontSize: 15, fontWeight: 700 }}>Continuar →</button>
        </>}

        {paso === 3 && def && <>
          <button className="btn sm" onClick={() => setPaso(2)} style={{ marginBottom: 12 }}>← Suministro</button>
          <div style={{ fontWeight: 700 }}>{def.emoji} {def.nombre}</div>
          <div className="muted" style={{ fontSize: 12, marginBottom: 12 }}>Suministro {suministro}{reclamo ? " · " + reclamo : ""}</div>
          <label style={{ display: "block", fontSize: 12, marginBottom: 10 }}>
            <span className="muted">Fecha del evento</span>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={{ display: "block", width: "100%", padding: 12, fontSize: 16, borderRadius: 10, border: "1px solid var(--bd)", boxSizing: "border-box", marginTop: 3 }} />
          </label>
          {camposDe(def).map(c => <label key={c.path} style={{ display: "block", fontSize: 12, marginBottom: 10 }}>
            <span className="muted">{c.label}</span>
            <input type={c.fecha ? "date" : "text"} value={form[c.path] || ""} onChange={e => set(c.path, e.target.value)}
              style={{ display: "block", width: "100%", padding: 12, fontSize: 16, borderRadius: 10, border: "1px solid var(--bd)", boxSizing: "border-box", marginTop: 3 }} />
          </label>)}
          <button onClick={() => camRef.current?.click()}
            style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid var(--linkTx)", background: "transparent", color: "var(--linkTx)", fontWeight: 700, fontSize: 14, cursor: "pointer", marginBottom: 12 }}>
            📷 {foto ? "Foto lista: " + foto.name.slice(0, 20) : "Tomar foto (opcional)"}
          </button>
          <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={e => setFoto(e.target.files && e.target.files[0] || null)} />
          <button className="btn primary" onClick={guardar} disabled={busy}
            style={{ width: "100%", padding: 14, fontSize: 16, fontWeight: 700 }}>{busy ? "Guardando…" : "✓ Guardar en el cuaderno"}</button>
        </>}
      </div>
    </div>
  );
}
