import { SEDES_FALLBACK } from "./constantes.js";
import { lblSpan, inp, badgeDudoso } from "./estilos.js";

/* ===================== PASO 4 — ¿Sobre qué suministro y qué pide? ===================== */
export function Paso4({ f, set, sug, cats }) {
  const sectores = cats?.SECTOR_TIPICO || [];
  const tiposDeficiencia = (cats?.TIPO_DEFICIENCIA || []).filter(t => t.valor && !/completar desde el desplegable/i.test(t.valor));
  const sedes = (cats?.SEDE && cats.SEDE.length ? cats.SEDE.map(s => s.valor) : SEDES_FALLBACK);
  return (
    <div>
      <h4 style={{ margin: "0 0 4px", color: "var(--navy)" }}>¿Sobre qué suministro y qué pide?</h4>
      <div className="muted" style={{ fontSize: 12, marginBottom: 14 }}>Confirma el suministro y el detalle del reclamo.</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, maxWidth: 640 }}>
        <label style={{ fontSize: 12 }}>
          <span style={lblSpan}>Suministro *{sug.has("CodigoSuministro") && <span style={badgeDudoso}>revisar</span>}</span>
          <input type="text" value={f.CodigoSuministro || ""} onChange={e => set("CodigoSuministro", e.target.value)} style={inp(sug.has("CodigoSuministro"))} />
        </label>
        <label style={{ fontSize: 12 }}>
          <span style={lblSpan}>N° OSINERG{sug.has("NumeroOsinerg") && <span style={badgeDudoso}>revisar</span>}</span>
          <input type="text" value={f.NumeroOsinerg || ""} onChange={e => set("NumeroOsinerg", e.target.value)} style={inp(sug.has("NumeroOsinerg"))} />
        </label>
        <label style={{ fontSize: 12, gridColumn: "1 / -1" }}>
          <span style={lblSpan}>Dirección{sug.has("DireccionSolicitante") && <span style={badgeDudoso}>revisar</span>}</span>
          <input type="text" value={f.DireccionSolicitante || ""} onChange={e => set("DireccionSolicitante", e.target.value)} style={inp(sug.has("DireccionSolicitante"))} />
        </label>
        <label style={{ fontSize: 12 }}>
          <span style={lblSpan}>Distrito{sug.has("NombreDistrito") && <span style={badgeDudoso}>revisar</span>}</span>
          <input type="text" value={f.NombreDistrito || ""} onChange={e => set("NombreDistrito", e.target.value)} style={inp(sug.has("NombreDistrito"))} />
        </label>
        <label style={{ fontSize: 12 }}>
          <span style={lblSpan}>Monto en reclamo (S/){sug.has("monto_reclamo") && <span style={badgeDudoso}>revisar</span>}</span>
          <input type="number" value={f.monto_reclamo || ""} onChange={e => set("monto_reclamo", e.target.value)} style={inp(sug.has("monto_reclamo"))} />
        </label>
        <label style={{ fontSize: 12, gridColumn: "1 / -1" }}>
          <span style={lblSpan}>Pedido / descripción del reclamo *{sug.has("DescripcionReclamo") && <span style={badgeDudoso}>revisar</span>}</span>
          <textarea rows={3} value={f.DescripcionReclamo || ""} onChange={e => set("DescripcionReclamo", e.target.value)} style={inp(sug.has("DescripcionReclamo"))} />
        </label>
      </div>

      {/* Ubicación (lo pide SIELSE): campos propios de la pantalla Solicitud, ajenos al Formato 1 */}
      <div style={{ marginTop: 22, maxWidth: 640 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--titulo)", marginBottom: 2 }}>Ubicación (lo pide SIELSE)</div>
        <div style={{ fontSize: 11, color: "var(--mut)", marginBottom: 10 }}>Campos propios de la pantalla Solicitud — no vienen del Formato 1.</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label style={{ fontSize: 12, gridColumn: "1 / -1" }}>
            <span style={lblSpan}>Dirección frontis</span>
            <input type="text" value={f.DIRECCION_FRONTIS || ""} onChange={e => set("DIRECCION_FRONTIS", e.target.value)} style={inp(false)} />
          </label>
          <label style={{ fontSize: 12, gridColumn: "1 / -1" }}>
            <span style={lblSpan}>Referencia de ubicación de falla</span>
            <input type="text" value={f.REFERENCIA_FALLA || ""} onChange={e => set("REFERENCIA_FALLA", e.target.value)} style={inp(false)} />
          </label>
          <label style={{ fontSize: 12 }}>
            <span style={lblSpan}>Sector típico</span>
            <select value={f.SECTOR_TIPICO || ""} onChange={e => set("SECTOR_TIPICO", e.target.value)} style={inp(false)}>
              <option value="">—</option>
              {sectores.map(s => <option key={s.valor} value={s.valor}>{s.valor}</option>)}
            </select>
            <div style={{ fontSize: 10.5, marginTop: 3, color: "var(--mut)" }}>define si aplica NTCSE urbano o rural</div>
          </label>

          <label style={{ fontSize: 12 }}>
            <span style={lblSpan}>Libro (SIELSE)</span>
            <input type="text" value={f.LIBRO || ""} onChange={e => set("LIBRO", e.target.value)}
              placeholder="obligatorio en la pantalla Solicitud" style={inp(false)} />
          </label>
          <label style={{ fontSize: 12 }}>
            <span style={lblSpan}>Zona</span>
            <input type="text" value={f.ZONA || ""} onChange={e => set("ZONA", e.target.value)} style={inp(false)} />
          </label>
          <label style={{ fontSize: 12, gridColumn: "1 / -1" }}>
            <span style={lblSpan}>Localidad NTCSE</span>
            <input type="text" value={f.LOCALIDAD_NTCSE || ""} onChange={e => set("LOCALIDAD_NTCSE", e.target.value)}
              placeholder="obligatorio — define indicadores de calidad" style={inp(false)} />
          </label>
          <label style={{ fontSize: 12 }}>
            <span style={lblSpan}>Tipo de deficiencia</span>
            {tiposDeficiencia.length
              ? (
                <select value={f.TIPO_DEFICIENCIA || ""} onChange={e => set("TIPO_DEFICIENCIA", e.target.value)} style={inp(false)}>
                  <option value="">—</option>
                  {tiposDeficiencia.map(t => <option key={t.valor} value={t.valor}>{t.valor}</option>)}
                </select>
              )
              : (
                <input type="text" value={f.TIPO_DEFICIENCIA || ""} onChange={e => set("TIPO_DEFICIENCIA", e.target.value)}
                  placeholder="como aparece en el desplegable de SIELSE" style={inp(false)} />
              )}
          </label>
          <label style={{ fontSize: 12 }}>
            <span style={lblSpan}>Sede</span>
            <select value={f.SEDE || "Cusco"} onChange={e => set("SEDE", e.target.value)} style={inp(false)}>
              {sedes.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <div style={{ fontSize: 10.5, marginTop: 3, color: "var(--mut)" }}>Sedes ≠ Cusco: +1/+2 días hábiles en los plazos del contrato</div>
          </label>
        </div>
      </div>
    </div>
  );
}
