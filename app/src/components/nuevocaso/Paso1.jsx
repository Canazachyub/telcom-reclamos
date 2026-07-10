import { CLASES_ART13 } from "./constantes.js";
import { lbl, lblSpan, inp } from "./estilos.js";

/* ===================== PASO 1 — ¿Qué reclama el usuario? ===================== */
export function Paso1({ f, set, cats }) {
  const clases = cats.CLASE_RECLAMO || [];
  const formas = cats.FORMA_RECLAMO || [];
  const tiposReclamo = (cats.TIPO_RECLAMO || []).filter(t => t.extra === f.NombreClaseReclamo);

  function elegirClase(valor) {
    set("NombreClaseReclamo", valor);
    // valor por defecto del checkbox OSINERG según la clase (el usuario puede corregirlo)
    set("RECLAMO_OSINERG", CLASES_ART13.has(valor));
  }

  return (
    <div>
      <h4 style={{ margin: "0 0 4px", color: "var(--navy)" }}>¿Qué reclama el usuario?</h4>
      <div className="muted" style={{ fontSize: 12, marginBottom: 14 }}>Esto es lo primero que SIELSE pregunta al registrar la solicitud.</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 10, marginBottom: 18 }}>
        {clases.map(c => {
          const activo = f.NombreClaseReclamo === c.valor;
          return (
            <div key={c.valor} onClick={() => elegirClase(c.valor)}
              onMouseEnter={e => { if (!activo) e.currentTarget.style.borderColor = "var(--accLight)"; }}
              onMouseLeave={e => { if (!activo) e.currentTarget.style.borderColor = "var(--bd)"; }}
              style={{
                position: "relative", cursor: "pointer", borderRadius: 10, padding: "14px 12px",
                border: "2px solid " + (activo ? "var(--acc)" : "var(--bd)"),
                background: activo ? "var(--selBg)" : "var(--card2)",
                transition: "border-color .12s, transform .12s", transform: activo ? "none" : undefined,
              }}>
              {activo && (
                <span style={{
                  position: "absolute", top: 8, right: 8, width: 18, height: 18, borderRadius: "50%",
                  background: "var(--acc)", color: "#fff", fontSize: 11, fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1,
                }}>✓</span>
              )}
              <div style={{ fontSize: 26, marginBottom: 6 }}>{c.icono || "📄"}</div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--titulo)" }}>{c.valor}</div>
              {c.ayuda && <div style={{ fontSize: 10.5, marginTop: 3, color: "var(--mut)" }}>{c.ayuda}</div>}
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 22, flexWrap: "wrap", alignItems: "flex-start" }}>
        <label style={lbl(340)}>
          <span style={lblSpan}>¿Cómo llegó el reclamo?</span>
          <select value={f.FORMA_PRESENTACION || ""} onChange={e => set("FORMA_PRESENTACION", e.target.value)} style={inp(false)}>
            <option value="">—</option>
            {formas.map(x => <option key={x.valor} value={x.valor}>{x.valor}</option>)}
          </select>
        </label>

        <label style={lbl(340)}>
          <span style={lblSpan}>Tipo de reclamo (SIELSE)</span>
          {tiposReclamo.length
            ? (
              <select value={f.NombreTipoReclamo || ""} onChange={e => set("NombreTipoReclamo", e.target.value)} style={inp(false)}>
                <option value="">—</option>
                {tiposReclamo.map(t => <option key={t.valor} value={t.valor}>{t.valor}</option>)}
              </select>
            )
            : (
              <input type="text" value={f.NombreTipoReclamo || ""} onChange={e => set("NombreTipoReclamo", e.target.value)}
                placeholder="como aparece en el desplegable de SIELSE" style={inp(false)} />
            )}
          {!f.NombreClaseReclamo && <div style={{ fontSize: 10.5, marginTop: 3, color: "var(--mut)" }}>Elige antes la clase de reclamo.</div>}
        </label>

        <label style={{ ...lbl(280), display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer" }}>
          <input type="checkbox" checked={!!f.RECLAMO_OSINERG} onChange={e => set("RECLAMO_OSINERG", e.target.checked)} style={{ marginTop: 3 }} />
          <span>
            <span style={{ ...lblSpan, display: "block" }}>Reclamo OSINERG</span>
            <span style={{ fontSize: 11, color: "var(--mut)" }}>en SIELSE genera correlativo OSINERG al admitir</span>
          </span>
        </label>
      </div>
    </div>
  );
}
