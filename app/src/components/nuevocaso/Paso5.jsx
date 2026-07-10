/* ===================== PASO 5 — Revisa y crea el expediente ===================== */
export function Paso5({ f, file, irA }) {
  const filas = [
    ["Tipo", f.NombreClaseReclamo || "—", 1],
    ["Tipo SIELSE", f.NombreTipoReclamo || "—", 1],
    ["OSINERG", f.RECLAMO_OSINERG ? "Sí" : "No", 1],
    ["Forma", f.FORMA_PRESENTACION || "—", 1],
    ["Documentos adjuntos", file ? `📄 ${file.name}` : "Ninguno", 2],
    ["Reclamante", [f.NombreSolicitante, f.DNI].filter(Boolean).join(" · ") || "—", 3],
    ["Suministro", [f.CodigoSuministro, f.DireccionSolicitante].filter(Boolean).join(" · ") || "—", 4],
    ["Sector típico", f.SECTOR_TIPICO || "—", 4],
    ["Sede", f.SEDE || "Cusco", 4],
    ["Libro/Zona", [f.LIBRO, f.ZONA].filter(Boolean).join(" · ") || "—", 4],
  ];
  return (
    <div>
      <h4 style={{ margin: "0 0 4px", color: "var(--navy)" }}>Revisa y crea el expediente</h4>
      <div className="muted" style={{ fontSize: 12, marginBottom: 14 }}>Verifica los datos antes de crear — quedan asociados al expediente.</div>
      <div style={{ background: "var(--card2)", border: "1px solid var(--bd)", borderRadius: 10, padding: 4, maxWidth: 640 }}>
        {filas.map(([k, v, pasoDestino]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "9px 12px", borderBottom: "1px solid var(--bd)" }}>
            <span style={{ color: "var(--mut)", fontSize: 12.5 }}>{k}</span>
            <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ color: "var(--tx)", fontSize: 12.5, fontWeight: 600, textAlign: "right" }}>{v}</span>
              <button onClick={() => irA(pasoDestino)} title={`Corregir en el paso ${pasoDestino}`} style={{ background: "transparent", color: "var(--acc)", border: "1px solid var(--acc)", borderRadius: 6, padding: "2px 8px", fontSize: 10.5, cursor: "pointer", fontWeight: 600 }}>corregir</button>
            </span>
          </div>
        ))}
        <div style={{ padding: "9px 12px", fontSize: 12, color: "var(--mut)" }}>Se asignará automáticamente al responsable de Recepción.</div>
      </div>
      <div style={{
        marginTop: 12, maxWidth: 640, display: "flex", gap: 8, alignItems: "flex-start",
        background: "var(--selBg)", border: "1px solid var(--acc)", borderRadius: 10, padding: "10px 12px",
      }}>
        <span style={{ fontSize: 14 }}>⚠️</span>
        <span style={{ fontSize: 12, color: "var(--tx)" }}>
          Al crear: transcribe la Solicitud en SIELSE el mismo día (botón <b>Nuevo → Guardar</b>) y anota aquí el <b>Nº de Solicitud</b>.
        </span>
      </div>
    </div>
  );
}
