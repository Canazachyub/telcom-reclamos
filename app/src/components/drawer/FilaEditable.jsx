import { useState } from "react";
import { toast } from "../ui.jsx";

// Fila de "Datos del reclamo" editable inline: valor + lapicito ✏️ (visible siempre, chico) que
// se convierte en input + ✓/✕. Al guardar llama onEditar(campo, valor) con la COLUMNA REAL de
// SIELSE. `formato` (opcional) formatea el valor mostrado (p.ej. fecha ISO -> dd/mm/aaaa) sin
// tocar lo que se edita/envía (el input trabaja con el string crudo). `area` usa un <textarea>
// para textos largos (descripción).
export function FilaEditable({ label, value, campo, onEditar, formato, title, area }) {
  const [editando, setEditando] = useState(false);
  const [val, setVal] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [valorMostrado, setValorMostrado] = useState(null); // override optimista tras guardar

  const valorActual = valorMostrado != null ? valorMostrado : value;
  const vacio = valorActual == null || valorActual === "";
  const mostrar = formato ? formato(valorActual) : valorActual;

  const empezar = () => { setVal(valorActual == null ? "" : String(valorActual)); setEditando(true); };
  const cancelar = () => setEditando(false);
  const guardar = async () => {
    if (!onEditar || !campo) return;
    setGuardando(true);
    try {
      await onEditar(campo, val);
      setValorMostrado(val);
      setEditando(false);
      toast("✓ " + label + " actualizado");
    } catch (e) {
      toast("No se pudo guardar " + label);
    } finally {
      setGuardando(false);
    }
  };

  if (editando) {
    return (
      <div className="kv" style={{ alignItems: "flex-start" }} title={title}>
        <b>{label}</b>
        <div style={{ display: "flex", gap: 6, alignItems: area ? "flex-start" : "center" }}>
          {area
            ? <textarea autoFocus value={val} onChange={e => setVal(e.target.value)} rows={3}
                style={{ flex: 1, fontSize: 12.5, color: "var(--tx)", border: "1px solid var(--acc)", borderRadius: 6, padding: "4px 6px", fontFamily: "inherit", resize: "vertical" }} />
            : <input autoFocus value={val} onChange={e => setVal(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") guardar(); if (e.key === "Escape") cancelar(); }}
                style={{ flex: 1, fontSize: 12.5, color: "var(--tx)", border: "1px solid var(--acc)", borderRadius: 6, padding: "2px 6px", fontFamily: "inherit" }} />}
          <button onClick={guardar} disabled={guardando} title="Guardar" style={{ flexShrink: 0, background: "transparent", border: "1px solid var(--bd)", color: "var(--tint-green-tx)", borderRadius: 6, padding: "1px 6px", fontSize: 11, cursor: guardando ? "wait" : "pointer" }}>✓</button>
          <button onClick={cancelar} disabled={guardando} title="Cancelar" style={{ flexShrink: 0, background: "transparent", border: "1px solid var(--bd)", color: "var(--tint-red-tx)", borderRadius: 6, padding: "1px 6px", fontSize: 11, cursor: "pointer" }}>✕</button>
        </div>
      </div>
    );
  }

  return (
    <div className="kv fila-editable" style={{ alignItems: "flex-start" }} title={title}>
      <b>{label}</b>
      <span style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
        <span style={{ flex: 1, color: vacio ? "var(--mut)" : undefined }}>{vacio ? "—" : mostrar}</span>
        {onEditar && campo && (
          <button onClick={empezar} title={"Editar " + label} className="lapiz-editable"
            style={{ flexShrink: 0, background: "transparent", border: "none", color: "var(--mut)", borderRadius: 6, padding: "0 2px", fontSize: 11, cursor: "pointer" }}>✏️</button>
        )}
      </span>
    </div>
  );
}
