import { useState, useEffect, useRef } from "react";

// 🔎 Buscador global (command palette) — encuentra un caso por N° OSINERG · suministro · nombre · código,
// desde cualquier pantalla y rol. Se abre con Ctrl/Cmd+K o el botón de la cabecera. Enter/clic abre la Sala.
export default function BuscadorGlobal({ data, onAbrir, onClose }) {
  const [q, setQ] = useState("");
  const ref = useRef();
  useEffect(() => { ref.current && ref.current.focus(); }, []);

  const t = q.trim().toUpperCase();
  const res = t.length < 2 ? [] : (data || []).filter(x =>
    (String(x.osinerg || "") + " " + String(x.codigo || "") + " " + String(x.suministro || "") + " " + String(x.solicitante || ""))
      .toUpperCase().includes(t)
  ).slice(0, 30);

  const abrir = x => { onAbrir(x.id); onClose(); };
  const onKey = e => {
    if (e.key === "Escape") onClose();
    if (e.key === "Enter" && res.length) abrir(res[0]);
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "var(--scrim)", zIndex: 99, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "10vh 12px 12px" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "var(--card)", borderRadius: 14, width: "min(620px,100%)", boxShadow: "var(--shadow-modal)", overflow: "hidden" }}>
        <input ref={ref} value={q} onChange={e => setQ(e.target.value)} onKeyDown={onKey}
          placeholder="Buscar caso — N° OSINERG · suministro · nombre · código…"
          style={{ width: "100%", border: 0, borderBottom: "1px solid var(--bd)", padding: "16px 18px", fontSize: 17, background: "transparent", color: "var(--tx)", boxSizing: "border-box", outline: "none" }} />
        <div style={{ maxHeight: "55vh", overflowY: "auto" }}>
          {t.length >= 2 && !res.length && <div className="muted" style={{ padding: 18, fontSize: 13 }}>Sin resultados para «{q}».</div>}
          {t.length < 2 && <div className="muted" style={{ padding: 18, fontSize: 12.5 }}>Escribe al menos 2 letras/números. Busca por N° OSINERG, suministro, nombre del cliente o código de reclamo.</div>}
          {res.map(x => (
            <button key={x.id} onClick={() => abrir(x)}
              style={{ width: "100%", textAlign: "left", border: 0, borderBottom: "1px solid var(--lineaBd,var(--bd))", background: "transparent", cursor: "pointer", padding: "11px 18px", display: "flex", flexDirection: "column", gap: 2 }}>
              <span><b className="mono" style={{ color: "var(--titulo)" }}>{x.osinerg || x.codigo}</b> <span style={{ color: "var(--tx)" }}>· {x.solicitante || "—"}</span></span>
              <span className="muted" style={{ fontSize: 11.5 }}>⚡ {x.suministro || "—"} · {(x.clase || "").replace("RECLAMOS ", "")} · {x.etapa || x.estado || ""}</span>
            </button>
          ))}
        </div>
        <div className="muted" style={{ fontSize: 11, padding: "8px 18px", borderTop: "1px solid var(--bd)", display: "flex", justifyContent: "space-between" }}>
          <span>Enter / clic abre el caso</span><span>Esc cierra</span>
        </div>
      </div>
    </div>
  );
}
