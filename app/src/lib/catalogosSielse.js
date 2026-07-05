// ===== Catálogos SIELSE (v4) =====
// Respaldo LOCAL de los combos oficiales de SIELSE para el wizard "Nuevo caso".
// Fuente de verdad editable: hoja `catalogos` del Sheet (grupo|valor|extra) → GET ?action=catalogos.
// Estos valores vienen de datos REALES: el export de 256 reclamos SIELSE (FORMA_RECLAMO,
// CLASE_RECLAMO, TIPO_RESOLUCION) + los manuales oficiales (TIPO_DOC, GRADO_PARENTESCO, MEDIO).
// El equipo amplía la hoja copiando de los desplegables del SIELSE vivo — sin tocar código.

export const CATALOGOS_LOCAL = {
  CLASE_RECLAMO: [
    { valor: "RECLAMOS POR EXCESIVA FACTURACION", icono: "🧾", ayuda: "consumo, recálculos, recibos" },
    { valor: "RECLAMOS VARIOS", icono: "📄", ayuda: "otras materias del procedimiento" },
  ],
  FORMA_RECLAMO: [
    { valor: "PRESENCIAL" }, { valor: "TELEFONO" }, { valor: "PORTAL WEB" },
    { valor: "MESA VIRTUAL" }, { valor: "LIBRO DE OBSERVACION" }, { valor: "POR DENUNCIAS" },
    { valor: "CORREO ELECTRONICO" }, { valor: "ESCRITO" },
  ],
  TIPO_RESOLUCION: [
    { valor: "Fundado" }, { valor: "Fundado en Parte" }, { valor: "Infundado" },
    { valor: "Improcedente" }, { valor: "Suspensión de Oficio" }, { valor: "Inadmisible" },
  ],
  TIPO_DOC: [
    { valor: "D.N.I." }, { valor: "R.U.C." }, { valor: "CARNE DE EXTRANJERIA" },
  ],
  GRADO_PARENTESCO: [
    { valor: "Propietario" }, { valor: "Inquilino" }, { valor: "Familiar" }, { valor: "Representante" },
  ],
  MEDIO_COMUNICACION: [
    { valor: "CELULAR" }, { valor: "TELEFONO" }, { valor: "E-MAIL" },
  ],
};

// filas de la hoja catalogos [{grupo,valor,extra}] -> { GRUPO: [{valor, extra}] }
export function agruparCatalogos(rows) {
  const out = {};
  (rows || []).forEach(r => {
    const g = String(r.grupo || "").trim().toUpperCase();
    const v = String(r.valor || "").trim();
    if (!g || !v) return;
    (out[g] = out[g] || []).push({ valor: v, extra: String(r.extra || "").trim() });
  });
  return out;
}

// mezcla: lo que exista en el Sheet REEMPLAZA a ese grupo local (el Sheet manda);
// grupos que el Sheet no tenga se completan con el respaldo local.
export function mezclarCatalogos(deSheet) {
  const out = { ...CATALOGOS_LOCAL };
  Object.keys(deSheet || {}).forEach(g => { if (deSheet[g] && deSheet[g].length) out[g] = deSheet[g]; });
  return out;
}
