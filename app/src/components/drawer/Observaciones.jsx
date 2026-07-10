import { useState } from "react";

// Observaciones del expediente — cualquier rol puede añadir (queda con su nombre y rol).
export function Observaciones({ reclamo, etapa, perfil, comentarios, onComentar }) {
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
          placeholder="Añade una observación… (escribe «MEJORA: …» para proponer una mejora del sistema)" style={{ flex: 1, background: "var(--card2)", color: "var(--tx)", border: "1px solid var(--bd)", borderRadius: 8, padding: "7px 9px", fontSize: 12.5 }} />
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
