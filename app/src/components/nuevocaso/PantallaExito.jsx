import { GuiaSielseBox } from "../../lib/guiaSielse.jsx";

/* ===================== Paso 6 interno — Pantalla de éxito ===================== */
export function PantallaExito({ codigo, onIrAlExpediente, onRegistrarOtro }) {
  return (
    <div style={{ flex: 1, overflow: "auto", padding: "28px 24px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
      <div style={{
        width: 68, height: 68, borderRadius: "50%", background: "var(--tint-green-bg)", color: "var(--tint-green-tx)", display: "flex",
        alignItems: "center", justifyContent: "center", fontSize: 36, fontWeight: 700, marginBottom: 14,
      }}>✓</div>
      <h3 style={{ margin: 0, color: "var(--titulo)", fontSize: 19 }}>Expediente {codigo} creado</h3>
      <div className="muted" style={{ fontSize: 13, marginTop: 6, maxWidth: 480 }}>
        Nació en <b>Recepción</b> con responsable y plazo automáticos.
      </div>

      <div style={{ width: "min(560px,100%)", marginTop: 22, textAlign: "left" }}>
        <GuiaSielseBox etapa="Recepción" compacta={false} />
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
        <button onClick={onRegistrarOtro} style={{ background: "transparent", color: "var(--tx)", border: "1px solid var(--bd)", borderRadius: 8, padding: "9px 20px", fontSize: 13.5, cursor: "pointer", fontWeight: 600 }}>Registrar otro reclamo</button>
        <button onClick={onIrAlExpediente} style={{ background: "var(--acc)", color: "#fff", border: 0, borderRadius: 8, padding: "9px 22px", fontSize: 14, cursor: "pointer", fontWeight: 700, boxShadow: "var(--shadow-pop)" }}>Ir al expediente →</button>
      </div>
    </div>
  );
}
