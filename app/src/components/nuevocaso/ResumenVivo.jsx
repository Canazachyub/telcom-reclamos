import { plazoEstimado, fechaLimiteAprox } from "./constantes.js";

/* ===================== Resumen en vivo (franja sticky, tipo tarifa Shalom) ===================== */
export function ResumenVivo({ f }) {
  const clase = f.NombreClaseReclamo || "—";
  const dias = plazoEstimado(f);
  const limite = fechaLimiteAprox(dias);
  return (
    <div style={{
      position: "sticky", top: 0, zIndex: 5, display: "flex", flexWrap: "wrap", gap: "6px 18px",
      alignItems: "center", padding: "8px 18px", background: "var(--card2)", borderBottom: "1px solid var(--bd)", fontSize: 11.5,
    }}>
      <span style={{ color: "var(--mut)", textTransform: "uppercase", letterSpacing: ".04em", fontWeight: 700, fontSize: 10 }}>Resumen en vivo</span>
      <Dato label="Clase" valor={clase} />
      <Dato label="Plazo estimado" valor={`${dias} días hábiles`} nota="estimado; SIELSE fija el oficial" />
      <Dato label="Fecha límite" valor={limite} nota="aprox." />
      <Dato label="Se asignará a" valor="reparto automático de Recepción" />
    </div>
  );
}
function Dato({ label, valor, nota }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 4 }}>
      <span style={{ color: "var(--mut)" }}>{label}:</span>
      <b style={{ color: "var(--titulo)" }}>{valor}</b>
      {nota && <span style={{ color: "var(--mut)", fontStyle: "italic" }}>({nota})</span>}
    </span>
  );
}
