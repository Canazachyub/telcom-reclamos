import { FLUJO } from "../lib/model.js";

// Línea de tiempo horizontal de las 10 etapas de un expediente (estilo courier, espejo
// visual de la Sala del expediente — ver SalaExpediente.jsx). Cada nodo: estado
// (hecho/actual/pendiente/vencida), responsable y qué falta. Clic → abre esa etapa.
export default function Timeline({ ticketDe, estadoPos, onSel, seleccionado }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", overflowX: "auto", padding: "10px 4px 6px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", minWidth: FLUJO.length * 78 }}>
        {FLUJO.map((s, i) => {
          const tk = ticketDe(s.etapa);
          const est = tk ? (tk.hecho ? "hecho" : tk.estado === "en_proceso" ? "proceso" : tk.estado === "observado" ? "observado" : "pend") : estadoPos(i);
          const venc = tk && tk.abierto && tk.vencido;
          const sel = seleccionado === i;

          // Color/relleno del nodo según estado (paleta courier: rojo=hecho, navy=actual/proceso).
          const bg = est === "hecho" ? "#E3001B" : (est === "proceso" || est === "observado") ? "#1E3A5F" : "#E9EEF5";
          const borde = est === "hecho" ? "#E3001B" : (est === "proceso" || est === "observado") ? "#1E3A5F" : "#D3DCE8";
          const icColor = est === "hecho" || est === "proceso" || est === "observado" ? "#fff" : "var(--mut2)";
          const ic = est === "hecho" ? "✓" : est === "observado" ? "!" : String(i + 1);
          const esActual = est === "proceso" || est === "observado";

          // Etiqueta de la etapa: bold+titulo si es la actual, mut si pendiente, rojo oscuro si hecha.
          const lbColor = esActual ? "var(--titulo)" : est === "hecho" ? "#C50018" : "var(--mut)";

          // Barra de progreso: mitad izquierda pinta el tramo ANTERIOR (recorrido si i>0 y ya
          // pasamos ese nodo), mitad derecha pinta el tramo hacia el SIGUIENTE nodo.
          const prevRecorrido = est === "hecho" || esActual; // el tramo que llega a este nodo ya se recorrió si el nodo está hecho o es el actual
          const nextRecorrido = est === "hecho"; // el tramo que sale de este nodo solo se pintó si este nodo YA está hecho

          return (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", position: "relative" }}>
              <div title={`${s.etapa}${tk ? " · " + tk.responsable : ""}`}
                onClick={() => onSel(i)}
                style={{ minWidth: 78, maxWidth: 78, textAlign: "center", cursor: "pointer", position: "relative" }}>
                {/* barra de progreso continua de 4px, centrada en el nodo */}
                <div style={{ position: "absolute", top: 13, left: 0, right: 0, height: 4, zIndex: 0 }}>
                  <div style={{ position: "absolute", top: 0, left: 0, width: "50%", height: 4, background: i === 0 ? "transparent" : (prevRecorrido ? "#E3001B" : "#E9EEF5") }} />
                  <div style={{ position: "absolute", top: 0, right: 0, width: "50%", height: 4, background: i === FLUJO.length - 1 ? "transparent" : (nextRecorrido ? "#E3001B" : "#E9EEF5") }} />
                </div>
                <div style={{
                  width: 27, height: 27, borderRadius: "50%", background: bg, color: icColor,
                  margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 800, fontSize: 12.5, position: "relative", zIndex: 1,
                  border: `2px solid ${borde}`,
                  boxShadow: [
                    esActual ? "0 0 0 5px rgba(227,0,27,.18)" : "",
                    venc ? "0 0 0 2px #DC2626" : "",
                    sel ? "0 0 0 3px #1E3A5F" : "",
                  ].filter(Boolean).join(", ") || "none",
                }} className={esActual ? "tl-pulso" : ""}>{ic}</div>
                <div style={{ fontSize: 11, fontWeight: esActual ? 700 : 400, color: lbColor, marginTop: 5, lineHeight: 1.2 }}>
                  {s.etapa.replace(" (JARU)", "")}
                </div>
                {tk && <div style={{ fontSize: 9.5, color: "var(--mut2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tk.responsable.split(" ")[0]}</div>}
                {venc && <div style={{ fontSize: 9.5, color: "#DC2626", fontWeight: 700 }}>vencido</div>}
              </div>
            </div>
          );
        })}
      </div>
      <style>{"@media (prefers-reduced-motion: no-preference){ .tl-pulso{ animation: tl-pulso-kf 1.6s ease-in-out infinite; } } @keyframes tl-pulso-kf{ 0%,100%{ box-shadow: 0 0 0 5px rgba(227,0,27,.18); } 50%{ box-shadow: 0 0 0 8px rgba(227,0,27,.10); } }"}</style>
    </div>
  );
}
