import { fmtFecha } from "../../lib/model.js";
import { fmtValor } from "./utils.js";
import { FilaEditable } from "./FilaEditable.jsx";
import { Observaciones } from "./Observaciones.jsx";
import { BitacoraCaso } from "./BitacoraCaso.jsx";

// --- Datos del reclamo (editable) + navegador de etapas + observaciones + bitácora ---
// (columna derecha del Drawer)
export function DatosReclamo({ style, exp, onEditar, ci, ticketDe, sel, selEst, FLUJO, comentarios, perfil, onComentar, registros, etapaActual }) {
  return (
    <div style={style}>
      <b style={{ color: "var(--titulo)", fontSize: 13 }}>Datos del reclamo</b>
      <div style={{ margin: "8px 0" }}>
        <FilaEditable label="Clase" value={exp.raw?.NombreClaseReclamo ?? exp.clase} campo="NombreClaseReclamo" onEditar={onEditar} />
        <FilaEditable label="Suministro" value={exp.raw?.CodigoSuministro ?? exp.suministro} campo="CodigoSuministro" onEditar={onEditar} />
        <FilaEditable label="Dirección" value={exp.raw?.DireccionSolicitante ?? exp.direccion} campo="DireccionSolicitante" onEditar={onEditar} />
        <FilaEditable label="Distrito" value={exp.raw?.NombreDistrito ?? exp.distrito} campo="NombreDistrito" onEditar={onEditar} />
        <FilaEditable label="F. admisión" value={exp.raw?.FechaAdmisionReclamo ?? exp.fechaAdm} campo="FechaAdmisionReclamo" onEditar={onEditar} formato={fmtValor} title="OJO: mueve el reloj de plazos" />
        <div className="kv"><b>F. límite SIELSE</b><span>{fmtFecha(exp.fechaLim)}</span></div>
        <FilaEditable label="Doc. ref." value={exp.raw?.DocumentoReferencia ?? exp.docRef} campo="DocumentoReferencia" onEditar={onEditar} />
        <FilaEditable label="Descripción" value={exp.raw?.DescripcionReclamo ?? exp.descripcion} campo="DescripcionReclamo" onEditar={onEditar} area />
      </div>
      <b style={{ color: "var(--titulo)", fontSize: 13 }}>Etapas</b>
      <div style={{ display: "grid", gap: 5, marginTop: 8 }}>
        {FLUJO.map((f, i) => {
          const t = ticketDe(f.etapa);
          const est = t ? (t.hecho ? "hecho" : t.estado === "en_proceso" ? "proceso" : "pend") : (exp.estado === "Cerrado" ? "hecho" : i < ci ? "hecho" : i === ci ? "proceso" : "pend");
          const col2 = est === "hecho" ? "var(--green)" : est === "proceso" ? "var(--acc)" : "var(--mut)";
          return (
            <div key={i} onClick={() => selEst(i)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 9px", borderRadius: 8, cursor: "pointer", background: i === sel ? "var(--selBg)" : "var(--card2)", border: `1px solid ${i === sel ? "var(--acc)" : "var(--bd)"}` }}>
              <span style={{ width: 18, height: 18, borderRadius: "50%", background: col2, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800 }}>{est === "hecho" ? "✓" : est === "proceso" ? "◐" : "○"}</span>
              <span style={{ flex: 1, fontSize: 12, color: "var(--tx)" }}>{f.etapa}</span>
              {t && t.abierto && t.vencido && <span style={{ fontSize: 10, color: "var(--red)" }}>vencido</span>}
              {t && <span className="muted" style={{ fontSize: 10 }}>{t.responsable.split(" ")[0]}</span>}
            </div>
          );
        })}
      </div>
      <Observaciones reclamo={exp.codigo} etapa={etapaActual} perfil={perfil} comentarios={comentarios} onComentar={onComentar} />
      <BitacoraCaso reclamo={exp.codigo} registros={registros} />
    </div>
  );
}
