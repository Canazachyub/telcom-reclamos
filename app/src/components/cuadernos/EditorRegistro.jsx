import { useState, useMemo } from "react";
import { camposEditables, extraDe, esISO, valCuaderno } from "./defs.js";

/* ===== modal de alta/edición — CUADERNO-AWARE =====
 * Los campos y ETIQUETAS salen de las columnas reales del cuaderno (def.cols): el
 * formulario de «1ra Inspección» dice EJECUTADO/DEVUELTO en vez de «Fecha 2/3». Las
 * fechas llevan date-picker. Los campos `extra.*` se editan y se MERGEAN sin pisar los demás. */
export function EditorRegistro({ fila, def, onCerrar, onGuardar }) {
  // cada campo sabe si es fecha (por su path base O porque su valor viene en ISO) → date-picker
  const campos = useMemo(() => camposEditables(def).map(c => {
    const raw = c.extra ? valCuaderno(fila, c.path) : (fila[c.path] != null ? String(fila[c.path]) : "");
    return { ...c, fecha: c.fecha || esISO(raw) };
  }), [def, fila]);
  const [form, setForm] = useState(() => {
    const o = { id: fila.id, tipo: fila.tipo || def.fuente };
    campos.forEach(c => {
      const v = c.extra ? valCuaderno(fila, c.path) : (fila[c.path] != null ? String(fila[c.path]) : "");
      o[c.path] = c.fecha && v ? String(v).slice(0, 10) : v;   // date-picker necesita YYYY-MM-DD
    });
    return o;
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const guardar = () => {
    const payload = { id: form.id, tipo: form.tipo, reclamo: form.reclamo };
    const extra = { ...extraDe(fila) };
    let hayExtra = false;
    campos.forEach(c => {
      if (c.extra) { extra[c.path.slice(6)] = form[c.path]; hayExtra = true; }
      else payload[c.path] = form[c.path];
    });
    if (hayExtra) payload.extra = extra;   // solo si el cuaderno tiene campos extra (los base quedan intactos)
    onGuardar(payload);
  };
  return <div className="modal-bg" onClick={onCerrar} style={{ position: "fixed", inset: 0, background: "rgba(22,41,75,.45)", zIndex: 90, display: "flex", alignItems: "center", justifyContent: "center" }}>
    <div onClick={e => e.stopPropagation()} style={{ background: "var(--card)", borderRadius: 12, padding: 18, width: "min(620px,94vw)", maxHeight: "88vh", overflowY: "auto", boxShadow: "var(--shadow-modal)" }}>
      <h3 style={{ marginTop: 0 }}>{form.id ? "✏ Editar" : "➕ Registrar"} — {def.nombre}</h3>
      <div className="muted" style={{ fontSize: 11, marginBottom: 10 }}>
        Campos y nombres de <b>{def.nombre}</b> (los mismos del cuaderno). Las fechas se eligen del calendario;
        se muestran como dd/mm/aaaa. Todo cambio queda firmado en la bitácora.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {campos.map(c =>
          <label key={c.path} style={{ fontSize: 11.5, display: "flex", flexDirection: "column", gap: 3, gridColumn: c.ancho ? "1/-1" : undefined }}>
            <span className="muted">{c.label}</span>
            <input type={c.fecha ? "date" : "text"} value={form[c.path] || ""} onChange={e => set(c.path, e.target.value)} />
          </label>)}
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
        <button className="btn sm" onClick={onCerrar}>Cancelar</button>
        <button className="btn sm primary" onClick={guardar}>Guardar</button>
      </div>
    </div>
  </div>;
}
