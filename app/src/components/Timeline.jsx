import { FLUJO } from "../lib/model.js";

// Línea de tiempo horizontal de las 10 etapas de un expediente.
// Cada nodo: estado (hecho/proceso/pendiente), responsable y qué falta. Clic → abre esa etapa.
export default function Timeline({ ticketDe, estadoPos, onSel }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", overflowX: "auto", padding: "6px 2px 4px" }}>
      {FLUJO.map((s, i) => {
        const tk = ticketDe(s.etapa);
        const est = tk ? (tk.hecho ? "hecho" : tk.estado === "en_proceso" ? "proceso" : tk.estado === "observado" ? "observado" : "pend") : estadoPos(i);
        const col = est === "hecho" ? "#1E8E5A" : est === "proceso" ? "#2C6FC0" : est === "observado" ? "#C9821B" : "#37475e";
        const ic = est === "hecho" ? "✓" : est === "proceso" ? "◐" : est === "observado" ? "!" : "○";
        const venc = tk && tk.abierto && tk.vencido;
        return (
          <div key={i} style={{ display: "flex", alignItems: "flex-start" }}>
            {i > 0 && <div style={{ width: 16, height: 2, background: col, marginTop: 13 }} />}
            <div onClick={() => onSel(i)} title={`${s.etapa}${tk ? " · " + tk.responsable : ""}`} style={{ minWidth: 64, maxWidth: 64, textAlign: "center", cursor: "pointer" }}>
              <div style={{
                width: 26, height: 26, borderRadius: "50%", background: col, color: "#08111e",
                margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 800, fontSize: 14, boxShadow: venc ? "0 0 0 2px #C0392B" : "none",
              }}>{ic}</div>
              <div style={{ fontSize: 9.5, color: "#cbd5e1", marginTop: 4, lineHeight: 1.15 }}>{s.etapa.replace(" (JARU)", "")}</div>
              {tk && <div style={{ fontSize: 9, color: "#8a97a8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tk.responsable.split(" ")[0]}</div>}
              {venc && <div style={{ fontSize: 8.5, color: "#fca5a5" }}>vencido</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
