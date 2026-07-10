/* ===== guía para el TRABAJADOR: cómo trabajar esta sección (no es la arquitectura) ===== */
export function ComoFunciona() {
  const tarjeta = (emoji, titulo, texto) => (
    <div style={{ flex: "1 1 240px", minWidth: 220, background: "var(--card2)", border: "1px solid var(--bd)", borderRadius: 10, padding: "11px 13px" }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--titulo)" }}>{emoji} {titulo}</div>
      <div className="muted" style={{ fontSize: 11.5, marginTop: 4, lineHeight: 1.45 }}>{texto}</div>
    </div>
  );
  return (
    <div style={{ marginTop: 12, padding: 14, border: "1px dashed var(--bd)", borderRadius: 12, background: "var(--card)" }}>
      <div style={{ fontWeight: 700, color: "var(--titulo)", marginBottom: 4 }}>¿Cómo trabajo en Cuadernos?</div>
      <div className="muted" style={{ fontSize: 12, marginBottom: 12 }}>
        Son los <b>mismos cuadernos de siempre</b>, ahora dentro de la plataforma. Abre un cuaderno tocando su
        tarjeta. Todo lo que hagas queda registrado con tu nombre (evidencia) y se sincroniza con el Sheet.
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {tarjeta("🔎", "Buscar un dato", "Abre el cuaderno y usa el buscador o filtra por 📅 día / mes. Toca una fila para abrir el expediente completo (Sala).")}
        {tarjeta("➕", "Registrar / ✏ corregir", "«➕ Registrar» agrega una fila; «✏» corrige una existente. Los campos son los del cuaderno (EJECUTADO, DEVUELTO…). Queda firmado.")}
        {tarjeta("📋", "Pegar desde tu Excel", "«📋 Pegar de Excel»: elige el día, copia las filas de tu Excel y pégalas. Se suben todas juntas. Pegar el mismo día otra vez actualiza (no duplica).")}
        {tarjeta("🖨️", "Emitir un cargo", "Elige el 📅 día y pulsa «🖨 Cargo»: sale el cargo de ESE día con ENTREGADO POR / RECIBIDO POR / DNI / FECHA-HORA para firmar.")}
        {tarjeta("🧮", "Llevarlo a Excel", "«🧮 Excel» descarga lo que estás viendo (respeta el filtro) para trabajarlo en tu Excel si lo necesitas.")}
        {tarjeta("🟡", "Celda amarilla = falta", "Una celda amarilla es un dato pendiente de llenar. Complétalo con ✏ o pegando el día.")}
      </div>
      <div className="muted" style={{ fontSize: 11, marginTop: 10 }}>
        ¿Dudas? El cuaderno «19 Apelaciones» además te marca en rojo/ámbar el plazo de elevación a JARU. Si un
        dato ya lo cargó otra etapa del expediente, ese manda — aquí lo verás igual.
      </div>
    </div>
  );
}
