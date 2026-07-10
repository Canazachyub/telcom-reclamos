import { useState } from "react";
import { fmtCuando, humanizarRegistro } from "../sala/utils.js";

// Bitácora del caso: memoria completa (registros globales) filtrada por expediente, plegada por
// defecto. Excluye 'comentario' (esos ya se ven en Observaciones, evita duplicar). Más nuevo arriba.
export function BitacoraCaso({ reclamo, registros }) {
  const [abierta, setAbierta] = useState(false);
  const propios = (registros || []).filter(r => String(r.reclamo) === String(reclamo) && String(r.tipo) !== "comentario");
  const ordenados = [...propios].reverse().slice(0, 12);
  return (
    <div style={{ marginTop: 14 }}>
      <button onClick={() => setAbierta(v => !v)} style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 11, color: "var(--mut)" }}>{abierta ? "▾" : "▸"}</span>
        <b style={{ color: "var(--titulo)", fontSize: 13 }}>Bitácora del caso ({propios.length})</b>
      </button>
      {abierta && (
        <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
          {ordenados.map((r, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, background: "var(--card2)", border: "1px solid var(--bd)", borderRadius: 8, padding: "6px 9px" }}>
              <span style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--acc)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9.5, fontWeight: 700, flexShrink: 0 }}>
                {(r.usuario || "—").split(" ").map(s => s[0]).slice(0, 2).join("").toUpperCase()}
              </span>
              <div style={{ flex: 1, fontSize: 12, color: "var(--tx)" }}>
                <b style={{ color: "var(--titulo)" }}>{r.usuario || "—"}</b> {humanizarRegistro(r)}
              </div>
              <span style={{ fontSize: 10.5, color: "var(--mut2)", whiteSpace: "nowrap", flexShrink: 0 }}>{fmtCuando(r.fecha)}</span>
            </div>
          ))}
          {!ordenados.length && <div className="muted" style={{ fontSize: 12 }}>Sin registros de bitácora para este caso todavía.</div>}
        </div>
      )}
    </div>
  );
}
