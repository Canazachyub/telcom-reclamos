// Constantes y helpers puros del wizard de alta de reclamo (NuevoCaso.jsx).
// Extraído tal cual desde NuevoCaso.jsx — cero cambios de lógica.

// Campos que la IA extrae del Formato 1 / cargo de recepción. ESTE registro es la
// mesa de partes digital de TELCOM: aquí nace el expediente; SIELSE se llena DESPUÉS
// transcribiendo este detalle (etapa SIELSE, ≤2 días háb. — penalidades 5.1/5.2).
export const EXTRAER = [
  { k: "NombreSolicitante", label: "Nombre del solicitante / reclamante" },
  { k: "DNI", label: "DNI del solicitante (8 dígitos)" },
  { k: "TELEFONO", label: "Teléfono / celular de contacto" },
  { k: "CodigoSuministro", label: "Código de suministro (11 dígitos)" },
  { k: "NumeroOsinerg", label: "N° OSINERG (REC00…) si aparece" },
  { k: "DireccionSolicitante", label: "Dirección del suministro" },
  { k: "NombreDistrito", label: "Distrito" },
  { k: "NombreClaseReclamo", label: "Materia del reclamo", opciones: ["RECLAMOS POR EXCESIVA FACTURACION", "RECLAMOS VARIOS"] },
  { k: "PERIODO_RECLAMADO", label: "Período/mes reclamado (ej. Junio 2026)" },
  { k: "monto_reclamo", label: "Monto en reclamo (solo número)" },
  { k: "FechaAdmisionReclamo", label: "Fecha de presentación del reclamo (DD/MM/AAAA)" },
  { k: "DescripcionReclamo", label: "Descripción / motivo del reclamo" },
];

export const PASOS = [
  { n: 1, titulo: "¿Qué reclama?" },
  { n: 2, titulo: "Documento" },
  { n: 3, titulo: "¿Quién reclama?" },
  { n: 4, titulo: "Suministro y pedido" },
  { n: 5, titulo: "Revisar y crear" },
];

// Checklist de sustentos recomendados por materia (Directiva 269-2014-OS/CD, Formato 1).
// Puramente orientativo: ayuda al digitador a no olvidar pedir algo en mesa de partes.
export const SUSTENTOS_POR_CLASE = {
  "RECLAMOS POR EXCESIVA FACTURACION": ["Recibo(s) reclamado(s)", "Historial de consumos (si lo tiene)", "DNI del reclamante"],
  "EXCESIVO CONSUMO": ["Recibo(s) reclamado(s)", "Historial de consumos (si lo tiene)", "DNI del reclamante"],
  "RECUPERO DE ENERGIA": ["Carta/notificación de recupero", "Acta de intervención", "Recibo"],
  "CORTE DEL SERVICIO": ["Recibo con el corte", "Constancia/foto del corte"],
  "DAÑOS Y PERJUICIOS": ["Relación de artefactos dañados", "Fotos", "Presupuesto/proforma de reparación"],
};
export const SUSTENTOS_DEFAULT = ["Documento del reclamo", "DNI del reclamante"];
export const sustentosDe = clase => SUSTENTOS_POR_CLASE[clase] || SUSTENTOS_DEFAULT;

// Heurística simple de plazo estimado, solo para orientar al digitador — SIELSE fija el oficial
// al Admitir (10 o 30 días hábiles según la clase y el análisis del Analista Legal en Evaluación).
export const CLASES_RAPIDAS = new Set(["CORTE DEL SERVICIO", "NEGATIVA A LA INSTALACION DEL SUMINISTRO", "MALA CALIDAD (TENSION / INTERRUPCIONES)"]);
export function plazoEstimado(f) {
  if (f.NombreClaseReclamo && CLASES_RAPIDAS.has(f.NombreClaseReclamo)) return 10;
  if (f.RECLAMO_OSINERG) return 30;
  return 10;
}
// fecha límite aprox.: hoy + plazo en días CALENDARIO (aproximación simple para el resumen en vivo)
export function fechaLimiteAprox(dias) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export const BORRADOR_KEY = "nuevoCaso_borrador";

// Clases del art. 13 de la Directiva 269-2014-OS/CD: en SIELSE, al Admitir estas
// materias se genera el correlativo OSINERG. Marcamos el checkbox en true por defecto
// para estas; el resto queda en false (el usuario confirma según el caso).
export const CLASES_ART13 = new Set([
  "RECLAMOS POR EXCESIVA FACTURACION", "EXCESIVO CONSUMO", "RECUPERO DE ENERGIA", "COBRO INDEBIDO",
  "CORTE DEL SERVICIO", "NEGATIVA A LA INSTALACION DEL SUMINISTRO", "NEGATIVA AL INCREMENTO DE POTENCIA",
  "NEGATIVA AL CAMBIO DE OPCION TARIFARIA", "REEMBOLSO DE APORTES O CONTRIBUCIONES",
  "REUBICACION DE INSTALACIONES", "MALA CALIDAD (TENSION / INTERRUPCIONES)", "DEUDAS DE TERCEROS",
  "RECLAMOS VARIOS",
]);

// Fallback local de sedes si el catálogo (Sheet o CATALOGOS_LOCAL) no trae el grupo SEDE todavía.
export const SEDES_FALLBACK = ["Cusco", "Valle Sagrado", "Quispicanchi", "Anta", "Vilcanota", "Provincias Altas", "La Convención"];
