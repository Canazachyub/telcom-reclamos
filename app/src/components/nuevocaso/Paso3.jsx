import { lblSpan, inp, badgeDudoso } from "./estilos.js";

/* ===================== PASO 3 — ¿Quién reclama? ===================== */
export function Paso3({ f, set, sug, cats }) {
  const tiposDoc = cats.TIPO_DOC || [];
  const grados = cats.GRADO_PARENTESCO || [];
  const tipoActivo = f.TIPO_DOC || tiposDoc[0]?.valor || "";
  return (
    <div>
      <h4 style={{ margin: "0 0 4px", color: "var(--navy)" }}>¿Quién reclama?</h4>
      <div className="muted" style={{ fontSize: 12, marginBottom: 14 }}>Prellenado por la IA — confirma o corrige.</div>

      <div className="muted" style={{ fontSize: 11, marginBottom: 6, textTransform: "uppercase", letterSpacing: .4 }}>Tipo de documento</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        {tiposDoc.map(t => {
          const activo = tipoActivo === t.valor;
          return (
            <button key={t.valor} onClick={() => set("TIPO_DOC", t.valor)}
              style={{
                background: activo ? "var(--navy)" : "var(--card2)", color: activo ? "#fff" : "var(--tx)",
                border: "1px solid " + (activo ? "var(--navy)" : "var(--bd)"), borderRadius: 8, padding: "7px 14px", fontSize: 12.5, cursor: "pointer", fontWeight: 600,
              }}>{t.valor}</button>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, maxWidth: 640 }}>
        <label style={{ fontSize: 12 }}>
          <span style={lblSpan}>N° de documento{sug.has("DNI") && <span style={badgeDudoso}>revisar</span>}</span>
          <input type="text" value={f.DNI || ""} onChange={e => set("DNI", e.target.value)} style={inp(sug.has("DNI"))} />
        </label>
        <label style={{ fontSize: 12 }}>
          <span style={lblSpan}>Solicitante / reclamante *{sug.has("NombreSolicitante") && <span style={badgeDudoso}>revisar</span>}</span>
          <input type="text" value={f.NombreSolicitante || ""} onChange={e => set("NombreSolicitante", e.target.value)} style={inp(sug.has("NombreSolicitante"))} />
        </label>
        <label style={{ fontSize: 12 }}>
          <span style={lblSpan}>Celular / teléfono{sug.has("TELEFONO") && <span style={badgeDudoso}>revisar</span>}</span>
          <input type="text" value={f.TELEFONO || ""} onChange={e => set("TELEFONO", e.target.value)} style={inp(sug.has("TELEFONO"))} />
        </label>
        <label style={{ fontSize: 12 }}>
          <span style={lblSpan}>Correo electrónico</span>
          <input type="text" value={f.CORREO || ""} onChange={e => set("CORREO", e.target.value)} style={inp(false)} />
        </label>
        <label style={{ fontSize: 12 }}>
          <span style={lblSpan}>Grado de parentesco</span>
          <select value={f.GRADO_PARENTESCO || "Propietario"} onChange={e => set("GRADO_PARENTESCO", e.target.value)} style={inp(false)}>
            {grados.map(g => <option key={g.valor} value={g.valor}>{g.valor}</option>)}
          </select>
        </label>
      </div>
    </div>
  );
}
