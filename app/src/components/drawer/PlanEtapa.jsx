// Plan de trabajo sugerido al iniciar una etapa (aparece cuando el ticket está EN PROCESO y
// todavía no hay ningún dato registrado): 4 pasos generados de datos REALES ya disponibles en
// el Drawer (campos de la etapa, evidencia requerida, guía SIELSE) — nada inventado ni nuevo
// estado global, solo reutiliza lo que el Drawer ya calcula. Descartable (✕) para esa sesión.
export function PlanEtapa({ etapa, campos, evidencias, guia, onAbrirEvidencia, onCerrar }) {
  const nCampos = campos.length;
  const primerosLabels = campos.slice(0, 3).map(c => c.label).join(", ");
  return (
    <div style={{ border: "2px solid var(--navy)", background: "var(--tint-acc-bg)", borderRadius: 12, padding: "10px 12px", margin: "10px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <b style={{ fontSize: 13.5, fontWeight: 700, color: "var(--navy)" }}>🎯 Plan de trabajo — {etapa}</b>
        <button onClick={onCerrar} title="No volver a mostrar este plan en esta sesión"
          style={{ background: "transparent", border: "none", color: "var(--mut)", fontSize: 12, cursor: "pointer", flexShrink: 0, padding: "0 2px" }}>✕</button>
      </div>
      <ol style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 12.5, color: "var(--tx)", display: "grid", gap: 7 }}>
        {nCampos > 0 && (
          <li>
            Llena los datos de la fase ({nCampos} campos): {primerosLabels}{nCampos > 3 ? "…" : ""}
            {" "}
            <button className="btn sm" style={{ padding: "2px 8px", fontSize: 11 }} onClick={onAbrirEvidencia}>📎 Abrir Evidencia + datos</button>
          </li>
        )}
        {evidencias.length > 0 && <li>Sube la evidencia requerida: {evidencias.join(", ")}</li>}
        {guia && <li>Transcribe en SIELSE: {guia.resumen} <span style={{ color: "var(--mut2)" }}>(la guía completa está abajo)</span></li>}
        <li>Cuando todo esté ✓, pulsa «✔ Terminé esta etapa».</li>
      </ol>
    </div>
  );
}
