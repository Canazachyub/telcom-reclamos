// ===== Catálogos SIELSE (v4) =====
// Respaldo LOCAL de los combos oficiales de SIELSE para el wizard "Nuevo caso".
// Fuente de verdad editable: hoja `catalogos` del Sheet (grupo|valor|extra) → GET ?action=catalogos.
// Estos valores vienen de datos REALES: el export de 256 reclamos SIELSE (FORMA_RECLAMO,
// CLASE_RECLAMO, TIPO_RESOLUCION) + los manuales oficiales (TIPO_DOC, GRADO_PARENTESCO, MEDIO).
// El equipo amplía la hoja copiando de los desplegables del SIELSE vivo — sin tocar código.

export const CATALOGOS_LOCAL = {
  // Universo COMPLETO: art. 13 de la Directiva 269-2014-OS/CD (13 materias reclamables)
  // + clases operativas vistas en SIELSE/manuales. El equipo poda/renombra en la hoja
  // `catalogos` contra el desplegable real de SIELSE — aquí no se limita nada.
  CLASE_RECLAMO: [
    { valor: "RECLAMOS POR EXCESIVA FACTURACION", icono: "🧾", ayuda: "importe facturado mayor al debido (art. 13.c)" },
    { valor: "EXCESIVO CONSUMO", icono: "📈", ayuda: "consumo registrado mayor al real (art. 13.b)" },
    { valor: "RECUPERO DE ENERGIA", icono: "♻️", ayuda: "cobro por consumos no registrados (art. 13.d)" },
    { valor: "COBRO INDEBIDO", icono: "💰", ayuda: "conceptos ajenos al servicio (art. 13.e)" },
    { valor: "CORTE DEL SERVICIO", icono: "🔌", ayuda: "corte indebido o sin aviso (art. 13.f)" },
    { valor: "NEGATIVA A LA INSTALACION DEL SUMINISTRO", icono: "🚫", ayuda: "no atienden el nuevo suministro (art. 13.a)" },
    { valor: "NEGATIVA AL INCREMENTO DE POTENCIA", icono: "⚡", ayuda: "art. 13.g" },
    { valor: "NEGATIVA AL CAMBIO DE OPCION TARIFARIA", icono: "🔁", ayuda: "art. 13.h" },
    { valor: "REEMBOLSO DE APORTES O CONTRIBUCIONES", icono: "💵", ayuda: "devolución de aportes (art. 13.i)" },
    { valor: "REUBICACION DE INSTALACIONES", icono: "🏗️", ayuda: "instalaciones a cargo de la concesionaria (art. 13.j)" },
    { valor: "MALA CALIDAD (TENSION / INTERRUPCIONES)", icono: "💡", ayuda: "calidad de producto/servicio (art. 13.k)" },
    { valor: "DEUDAS DE TERCEROS", icono: "👥", ayuda: "cobran deuda de otro titular (art. 13.l)" },
    { valor: "FALTA DE SERVICIO EN EL PREDIO", icono: "🕯️", ayuda: "sin energía en el predio (SIELSE/denuncia)" },
    { valor: "ALUMBRADO PUBLICO", icono: "🛣️", ayuda: "deficiencias de AP — Proc. 094-2017" },
    { valor: "DAÑOS Y PERJUICIOS", icono: "🔥", ayuda: "artefactos dañados por sobretensión" },
    { valor: "EMERGENCIAS", icono: "🚨", ayuda: "riesgo eléctrico grave / atención inmediata" },
    { valor: "RECLAMOS VARIOS", icono: "📄", ayuda: "otras cuestiones del servicio (art. 13.m)" },
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
  // Tipo Reclamo SIELSE: depende de la Clase Reclamo elegida (extra = clase padre).
  // Solo el par confirmado en captura real; el resto lo completa el equipo en la hoja
  // `catalogos` copiando el desplegable del SIELSE vivo para cada clase (§6 memoria).
  TIPO_RECLAMO: [
    { valor: "EXCESIVO CONSUMO FACTURADO", extra: "EXCESIVO CONSUMO" },
  ],
  // Sector Típico SIELSE: define si aplica NTCSE (urbano) o NTCSER (rural). Confirmado
  // en captura: "Rural de Media Densidad"; los otros son los sectores típicos usuales
  // — el equipo confirma el listado completo contra el SIELSE vivo.
  SECTOR_TIPICO: [
    { valor: "Urbano" }, { valor: "Rural de Media Densidad" }, { valor: "Rural de Baja Densidad" },
  ],
  // Combo obligatorio de la pantalla Solicitud en SIELSE. Aún no capturado en una
  // solicitud real; el equipo lo puebla en la hoja `catalogos` copiando el desplegable
  // vivo de SIELSE (§6 memoria) — placeholder mientras tanto.
  TIPO_DEFICIENCIA: [
    { valor: "(completar desde el desplegable de SIELSE)" },
  ],
  // Sedes de atención del contrato. Las sedes ≠ Cusco tienen +1/+2 días hábiles en
  // informar OT / entrega de resolución / foliado / cierre (bases del contrato).
  SEDE: [
    { valor: "Cusco" }, { valor: "Valle Sagrado" }, { valor: "Quispicanchi" },
    { valor: "Anta" }, { valor: "Vilcanota" }, { valor: "Provincias Altas" }, { valor: "La Convención" },
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
// grupos que el Sheet no tenga se completan con el respaldo local. Al reemplazar,
// se conservan icono/ayuda del respaldo local cuando el valor coincide (el Sheet
// solo trae grupo|valor|extra).
export function mezclarCatalogos(deSheet) {
  const out = { ...CATALOGOS_LOCAL };
  Object.keys(deSheet || {}).forEach(g => {
    if (!deSheet[g] || !deSheet[g].length) return;
    const locales = CATALOGOS_LOCAL[g] || [];
    out[g] = deSheet[g].map(e => {
      const loc = locales.find(l => l.valor.toUpperCase() === e.valor.toUpperCase());
      return loc ? { ...loc, ...e, ayuda: e.extra || loc.ayuda } : { ...e, ayuda: e.extra || "" };
    });
  });
  return out;
}
