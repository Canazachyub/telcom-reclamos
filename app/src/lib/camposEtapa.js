// Campos a registrar en cada ETAPA (sección Evidencias), según el ROL del trabajador.
// Las claves coinciden con los corchetes [[CAMPO]] de las plantillas Word, así estos
// datos PRELLENAN los documentos luego. Se guardan en la BD (registros, tipo=datos).
//
// roles = qué roles ven/llenan los campos de esa etapa. Gerencia/Coordinación ven todo.

export const CAMPOS_ETAPA = {
  "Recepción": {
    roles: ["TRAMITADOR"],
    nota: "El registro nace AQUÍ (escaneo + IA + tu verificación). Completa lo que falte del solicitante; después se transcribe todo a SIELSE.",
    campos: [
      { k: "DNI", label: "DNI del solicitante", tipo: "text" },
      { k: "TARIFA", label: "Tarifa (BT5B…)", tipo: "text" },
      { k: "PERIODO_RECLAMADO", label: "Período reclamado", tipo: "text", ph: "Marzo 2026" },
      { k: "MONTO_RECLAMADO", label: "Monto en reclamo (S/)", tipo: "num" },
      // — transcripción SIELSE (§5 memoria)
      { k: "N_SOLICITUD_SIELSE", label: "N° de Solicitud SIELSE", tipo: "text", ph: "el número que SIELSE asigna al Guardar la Solicitud (ej. 2026001…)" },
    ],
  },
  "Evaluación": {
    roles: ["ANALISTA_LEGAL", "ANALISTA_JUNIOR"],
    nota: "Datos del análisis que sustentan el plazo y la futura resolución (alimentan el Reporte 1).",
    campos: [
      { k: "PLAZO_DIAS", label: "Plazo de atención", tipo: "select", opciones: ["10", "30"] },
      { k: "CONSUMO_RECLAMADO", label: "Consumo reclamado (kWh)", tipo: "num" },
      { k: "CONSUMO_PROMEDIO", label: "Consumo promedio Cp (kWh)", tipo: "num" },
      { k: "N_MESES_PROMEDIO", label: "N° meses del promedio", tipo: "num", ph: "12 / 36" },
      { k: "LECT_ANTERIOR", label: "Lectura anterior (kWh)", tipo: "num" },
      { k: "LECT_ACTUAL", label: "Lectura actual (kWh)", tipo: "num" },
      { k: "CONCLUSION_REPORTE1", label: "Conclusión del Reporte 1", tipo: "textarea" },
      // — transcripción SIELSE (§5 memoria)
      { k: "N_OSINERG_SIELSE", label: "Correlativo OSINERG (al Admitir)", tipo: "text", ph: "se genera al pulsar Admitir en SIELSE" },
      { k: "FECHA_ADMISION_SIELSE", label: "Fecha de admisión (SIELSE)", tipo: "date", ph: "dd/mm/aaaa — arranca el reloj de plazos" },
      { k: "DIRECCION_NOTIFICACION", label: "Dirección de notificación", tipo: "text", ph: "la registrada en la pestaña Reclamo de SIELSE" },
      // — 📒 cuadernos 2026 (Fase 2): alimenta el padrón mensual y 1RA INSPECCIÓN
      { k: "REQUIERE_INSPECCION", label: "¿Requiere inspección?", tipo: "select", opciones: ["", "SI", "NO", "ENCUESTA", "TRATO DIRECTO"] },
    ],
  },
  "Campo": {
    roles: ["TRAMITADOR"],
    nota: "Resultado de la inspección/contraste — alimenta el Reporte 1 y la resolución.",
    campos: [
      { k: "FECHA_INSPECCION", label: "Fecha de inspección", tipo: "date" },
      { k: "TIPO_INSPECCION", label: "Tipo de inspección", tipo: "select", opciones: ["Simple", "Con contraste", "Megado"] },
      { k: "INSPECTOR", label: "Inspector / técnico de campo", tipo: "text" },
      { k: "LECTURA_INSPECCION", label: "Lectura del medidor (kWh)", tipo: "num" },
      { k: "SERIE_MEDIDOR", label: "Serie del medidor", tipo: "text" },
      { k: "ESTADO_MEDIDOR", label: "Estado / accesibilidad", tipo: "text" },
      { k: "RESULTADO_PRUEBA", label: "Resultado prueba medidor", tipo: "select", opciones: ["CONFORME", "NO CONFORME"] },
      { k: "CARACTERISTICAS_INMUEBLE", label: "Características del inmueble", tipo: "text", ph: "2 pisos, material noble…" },
      { k: "OBS_INSPECCION", label: "Observaciones del inspector", tipo: "textarea" },
      // Tabla de cargas (inventario de artefactos declarados en la inspección) — 3 filas cortas.
      { k: "CARGA_1", label: "Carga 1", tipo: "text" },
      { k: "CANT_1", label: "Cant. 1", tipo: "num" },
      { k: "POT_1", label: "Pot. 1 (W)", tipo: "num" },
      { k: "DIAS_1", label: "Días/mes 1", tipo: "num" },
      { k: "HORAS_1", label: "Horas/día 1", tipo: "num" },
      { k: "CARGA_2", label: "Carga 2", tipo: "text" },
      { k: "CANT_2", label: "Cant. 2", tipo: "num" },
      { k: "POT_2", label: "Pot. 2 (W)", tipo: "num" },
      { k: "DIAS_2", label: "Días/mes 2", tipo: "num" },
      { k: "HORAS_2", label: "Horas/día 2", tipo: "num" },
      { k: "CARGA_3", label: "Carga 3", tipo: "text" },
      { k: "CANT_3", label: "Cant. 3", tipo: "num" },
      { k: "POT_3", label: "Pot. 3 (W)", tipo: "num" },
      { k: "DIAS_3", label: "Días/mes 3", tipo: "num" },
      { k: "HORAS_3", label: "Horas/día 3", tipo: "num" },
      // — transcripción SIELSE (§5 memoria)
      { k: "N_OT_SIELSE", label: "N° de Orden de Trabajo", tipo: "text", ph: "OT generada en SIELSE para la inspección" },
      { k: "FECHA_INFORME_OT", label: "Fecha en que se informó el resultado en SIELSE", tipo: "date", ph: "dd/mm/aaaa — plazo ≤2 d háb (penalidad 5.1)" },
      // — Mejoras a los TR (informe mensual/semestral de incumplimientos de contratistas de campo)
      { k: "CAUSA_INCUMPLIMIENTO_OT", label: "Si la OT llegó tarde: causa", tipo: "select", opciones: ["", "Contratista de campo demoró", "Acceso/ubicación del predio", "Clima", "Reprogramación de ELSE", "Datos errados del suministro", "Otro"] },
      // — 📒 cuadernos 2026 (Fase 2): alimentan 1RA INSPECCIÓN, 14 CONTRASTES y 15 CARTAS CVR
      { k: "FECHA_ENTREGA_CONSORCIO", label: "Fecha de entrega al consorcio", tipo: "date", ph: "cuando la OT sale al consorcio de campo" },
      { k: "FECHA_EJECUTADO_OT", label: "Fecha EJECUTADO (consorcio)", tipo: "date" },
      { k: "FECHA_DEVUELTO_OT", label: "Fecha DEVUELTO (consorcio)", tipo: "date" },
      { k: "HORA_EJEC", label: "Hora de ejecución del contraste", tipo: "text", ph: "09:30" },
      { k: "PRE_NOTIFICACION", label: "Pre-notificación del contraste", tipo: "date", ph: "carta/correo previo al usuario" },
      { k: "N_CARTA_CVR", label: "N° carta de contraste (CVR)", tipo: "text", ph: "CVR-0112-2026" },
    ],
  },
  "SIELSE": {
    roles: ["TRAMITADOR"],
    nota: "SIELSE se llena DESDE nuestra app: transcribe allá el detalle del expediente (datos del caso + resultados) y registra aquí la constancia (≤2 días hábiles).",
    campos: [
      { k: "N_CARTA_PRUEBA", label: "N° carta / refacturación (prueba)", tipo: "text" },
      { k: "FECHA_SIELSE", label: "Fecha informado en SIELSE", tipo: "date" },
      { k: "OBS_SIELSE", label: "Observación", tipo: "textarea" },
      // — transcripción SIELSE (§5 memoria)
      { k: "COMPROBANTES_DISPUTA", label: "Recibos en disputa (números)", tipo: "text", ph: "los agregados en Recibo en Reclamo" },
      { k: "MONTO_ACEPTADO", label: "Monto aceptado por el cliente (S/)", tipo: "num", ph: "para la refacturación" },
      { k: "FECHA_PROCEDENCIA", label: "Fecha de Procedente (SIELSE)", tipo: "date", ph: "dd/mm/aaaa — pasa a EN ATENCIÓN" },
    ],
  },
  "Resolución": {
    roles: ["ANALISTA_LEGAL", "ANALISTA_JUNIOR"],
    nota: "Decisión del reclamo — estos datos generan el Proyecto de Resolución.",
    campos: [
      { k: "N_RESOLUCION", label: "N° Resolución", tipo: "text", ph: "C-####-2026" },
      { k: "FECHA_RESOLUCION", label: "Fecha de la resolución", tipo: "date" },
      { k: "SENTIDO_FALLO", label: "Sentido del fallo", tipo: "select", opciones: ["FUNDADO", "INFUNDADO", "FUNDADO EN PARTE", "IMPROCEDENTE", "INADMISIBLE", "SUSPENSIÓN DE OFICIO"] },
      { k: "MONTO_DEVOLUCION", label: "Monto a devolver (S/)", tipo: "num" },
      { k: "ANALISIS_ARGUMENTO", label: "Análisis / fundamento clave", tipo: "textarea" },
      { k: "FIRMANTE", label: "Firmante", tipo: "text" },
      { k: "CARGO_FIRMANTE", label: "Cargo del firmante", tipo: "text" },
      // — transcripción SIELSE (§5 memoria)
      { k: "FECHA_EMISION_RES", label: "Fecha de emisión de la resolución", tipo: "date", ph: "dd/mm/aaaa — la que se registra en Con Resolución" },
      { k: "SENTIDO_RESOLUCION", label: "Tipo de Resolución (SIELSE)", tipo: "select", opciones: ["Fundado", "Fundado en Parte", "Infundado", "Improcedente", "Suspensión de Oficio", "Inadmisible"] },
    ],
  },
  "Firmas": {
    roles: ["TRAMITADOR", "ASISTENTE"],
    nota: "Circuito de firmas de la resolución.",
    campos: [
      { k: "VB_SUPERVISOR", label: "V°B° supervisor (fecha)", tipo: "date" },
      { k: "VB_JEFE", label: "V°B° jefe de división (fecha)", tipo: "date" },
      { k: "FIRMA_GERENTE", label: "Firma Gerente Comercial (fecha)", tipo: "date" },
      // — transcripción SIELSE (§5 memoria)
      { k: "FECHA_FIRMA_GERENTE", label: "Fecha de firma (Gerente Comercial)", tipo: "date", ph: "dd/mm/aaaa" },
    ],
  },
  "Notificación": {
    roles: ["ASISTENTE"],
    nota: "Diligencia de notificación — genera la cédula y su cargo.",
    campos: [
      { k: "N_CEDULA", label: "N° de cédula", tipo: "text" },
      { k: "FECHA_NOTIFICACION", label: "Fecha de notificación", tipo: "date" },
      { k: "HORA_NOTIFICACION", label: "Hora", tipo: "text" },
      { k: "RECEPTOR", label: "Recibido por", tipo: "text" },
      { k: "VINCULO", label: "Vínculo con el usuario", tipo: "select", opciones: ["Administrado", "Familiar", "Otros"] },
      { k: "MODALIDAD_NOTIF", label: "Modalidad", tipo: "select", opciones: ["Personal", "Bajo puerta", "Notarial"] },
      { k: "NOTIFICADOR", label: "Notificador / notario", tipo: "text" },
      { k: "OBS_NOTIF", label: "Observaciones", tipo: "textarea" },
      // — transcripción SIELSE (§5 memoria)
      { k: "FECHA_RECEPCION_CLIENTE", label: "Fecha de recepción por el cliente", tipo: "date", ph: "va en el informe Con Resolución de SIELSE" },
      { k: "FECHA_NOTIFICACION_NOTARIAL", label: "Fecha de notificación notarial", tipo: "date", ph: "≤5° día desde emisión (penalidad 5.12)" },
      // — 📒 cuadernos 2026 (Fase 2): alimentan 18 NOTARÍA y su retorno
      { k: "FECHA_ENTREGA_NOTARIA", label: "Fecha de entrega a notaría", tipo: "date" },
      { k: "FECHA_DEVUELTO_NOTARIA", label: "Fecha DEVUELTO de notaría", tipo: "date" },
      { k: "FECHA_EJECUTADO_NOTIF", label: "Fecha EJECUTADO (notificación)", tipo: "date" },
    ],
  },
  "Apelación (JARU)": {
    roles: ["ANALISTA_JUNIOR"],
    nota: "Datos de la elevación a JARU — generan el Informe de Elevación (Formato 6).",
    campos: [
      { k: "FECHA_APELACION", label: "Fecha de apelación", tipo: "date" },
      { k: "ARGUMENTOS_APELACION", label: "Argumentos del recurso", tipo: "textarea" },
      { k: "POSICION_EMPRESA", label: "Posición de la empresa", tipo: "textarea" },
      { k: "RECOMENDACION", label: "Recomendación", tipo: "select", opciones: ["Mantener", "Revocar", "Modificar"] },
      { k: "RELACION_DOCUMENTOS", label: "Relación de documentos que se elevan", tipo: "textarea" },
      { k: "N_FOJAS", label: "N° total de fojas", tipo: "num" },
      // — transcripción SIELSE (§5 memoria)
      { k: "FECHA_PRESENTACION_RECURSO", label: "Fecha en que el usuario presentó el recurso", tipo: "date", ph: "arranca los relojes: reconsideración 10 d.h. / elevación 5 d.h." },
      { k: "N_RECONSIDERACION", label: "N° de Reconsideración (si es reconsideración)", tipo: "text", ph: "el que registra SIELSE en Atención → Reconsideración" },
      { k: "FECHA_RECONSIDERACION", label: "Fecha de presentación de la reconsideración", tipo: "date", ph: "resolver en ≤10 d háb — penalidad 5.9" },
      { k: "N_EXPEDIENTE_JARU", label: "N° de Expediente (Apelación)", tipo: "text", ph: "el que registra SIELSE en Atención → Apelación" },
      { k: "FECHA_ELEVACION", label: "Fecha de elevación a JARU", tipo: "date", ph: "≤5 d háb desde el recurso (penalidad 5.10)" },
      { k: "N_RESOLUCION_JARU", label: "N° de Resolución JARU", tipo: "text", ph: "cuando OSINERGMIN resuelva" },
      { k: "TIPO_RESOLUCION_OSINERG", label: "Tipo de Resolución OSINERG", tipo: "text", ph: "el sentido que fija JARU" },
      // — 📒 cuadernos 2026 (Fase 2): completan el registro JARU del cuaderno 19
      { k: "COD_MGD", label: "Cód. único de expediente MGD", tipo: "text" },
      { k: "FECHA_ELEVACION_SIGED", label: "Fecha de elevación SIGED", tipo: "date" },
      { k: "MONTO_DESPLAZADO", label: "Monto desplazado", tipo: "text", ph: "S/ o 'PARA 04/2027'" },
      { k: "FECHA_RESJARU", label: "Fecha de RESJARU", tipo: "date" },
      { k: "N_RES_JARU", label: "N° de resolución JARU", tipo: "text" },
      { k: "DECISION_JARU", label: "Decisión JARU", tipo: "select", opciones: ["", "INFUNDADO", "FUNDADO", "FUNDADO EN PARTE", "IMPROCEDENTE", "NULO"] },
      { k: "MEDIDA_CORRECTIVA", label: "Medida correctiva ELSE", tipo: "textarea" },
    ],
  },
  "Foliado": {
    roles: ["TRAMITADOR"],
    nota: "Consolidación del expediente en un único PDF foliado.",
    campos: [
      { k: "N_FOJAS", label: "N° total de fojas", tipo: "num" },
      { k: "FECHA_FOLIADO", label: "Fecha de foliado", tipo: "date" },
      // — transcripción SIELSE (§5 memoria)
      { k: "N_FOLIOS", label: "N° total de folios", tipo: "num", ph: "del expediente único en PDF" },
    ],
  },
  "Cierre": {
    roles: ["TRAMITADOR"],
    nota: "Cierre del reclamo en SIELSE (≤16 días desde la notificación).",
    campos: [
      { k: "FECHA_CIERRE", label: "Fecha de cierre en SIELSE", tipo: "date" },
      { k: "MOTIVO_CIERRE", label: "Motivo de cierre", tipo: "select", opciones: ["", "ACTA DE REUNION DE TRATO DIRECTO", "CONFORMIDAD DEL CLIENTE", "FALTA DE APELACION", "POR RESOLUCION DE OSINERG", "TRABAJO REALIZADO", "FALTA DE PRESENTACION DE DOCUMENTOS", "Otro"] },
      // — transcripción SIELSE (§5 memoria) · la fecha de cierre ya existe arriba (FECHA_CIERRE)
      { k: "TIPO_CIERRE_SIELSE", label: "Vía de cierre en SIELSE", tipo: "select", opciones: ["Acto Firme", "Cumplimiento Resolución JARU", "Trato Directo", "Desistimiento del cliente"] },
      { k: "N_ACTA_TD", label: "N° de Acta de Trato Directo", tipo: "text", ph: "ej. ATD-103-2026 — solo si la vía es Trato Directo" },
      { k: "FECHA_REUNION_TD", label: "Fecha de la reunión de trato directo", tipo: "date", ph: "solo si la vía es Trato Directo" },
      { k: "TIPO_ACUERDO_TD", label: "Tipo de acuerdo", tipo: "select", opciones: ["", "Acuerdo Absoluto", "Acuerdo Parcial"] },
      // — 📒 cuadernos 2026 (Fase 2): post-fundado — alimentan 17 CAMBIOS DE MEDIDOR y 21 SUSPENDIDOS
      { k: "FECHA_CAMBIO_MEDIDOR", label: "Fecha de cambio de medidor / punto caliente", tipo: "date" },
      { k: "TELEFONO_USUARIO", label: "Teléfono del usuario", tipo: "text", ph: "para coordinar el cambio de medidor" },
      { k: "LECTURA_OK", label: "Fecha de lectura OK", tipo: "date" },
      { k: "LECTURA_1", label: "Fecha de lectura 1", tipo: "date" },
      { k: "LECTURA_2", label: "Fecha de lectura 2", tipo: "date" },
    ],
  },
};

// Campos ADICIONALES de "Resolución" según el SENTIDO_FALLO elegido (reactivo al select).
// Se concatenan a CAMPOS_ETAPA["Resolución"].campos en SubirEvidencia.jsx y Formularios.jsx.
export const CAMPOS_POR_FALLO = {
  "FUNDADO EN PARTE": [
    { k: "VIR_KWH", label: "VIR (kWh)", tipo: "num" },
    { k: "N_MESES_ACUMULACION", label: "N° meses de acumulación", tipo: "num" },
    { k: "INICIO_ACUMULACION", label: "Inicio de acumulación", tipo: "date" },
    { k: "FIN_ACUMULACION", label: "Fin de acumulación", tipo: "date" },
    { k: "N_CERTIFICADO", label: "N° de certificado", tipo: "text" },
    { k: "CONSUMO_CORRECTO", label: "Consumo correcto (kWh)", tipo: "num" },
    { k: "N_CUOTAS", label: "N° de cuotas", tipo: "num" },
    { k: "FUNDAMENTO_AMPARO", label: "Fundamento del extremo amparado", tipo: "textarea" },
    { k: "FUNDAMENTO_NO_AMPARO", label: "Fundamento del extremo no amparado", tipo: "textarea" },
    { k: "EXTREMO_FUNDADO", label: "Extremo declarado fundado", tipo: "textarea" },
    { k: "EXTREMO_INFUNDADO", label: "Extremo declarado infundado", tipo: "textarea" },
  ],
  "INADMISIBLE": [
    { k: "FECHA_OBSERVACION", label: "Fecha de observación", tipo: "date" },
    { k: "DEFECTO_FORMAL", label: "Defecto formal advertido", tipo: "textarea" },
  ],
  "SUSPENSIÓN DE OFICIO": [
    { k: "FECHA_PRUEBA1", label: "Fecha de 1ª prueba", tipo: "date" },
    { k: "FECHA_PRUEBA2", label: "Fecha de 2ª prueba", tipo: "date" },
    { k: "RESULTADO_PRUEBAS", label: "Resultado de las pruebas", tipo: "textarea" },
    { k: "INICIO_HISTORIAL", label: "Inicio del historial revisado", tipo: "date" },
    { k: "FUNDAMENTO_SUSPENSION", label: "Fundamento de la suspensión", tipo: "textarea" },
  ],
  "INFUNDADO": [
    { k: "RESULTADO_CONTRASTE", label: "Resultado del contraste", tipo: "textarea" },
    { k: "DIFERENCIA_PCT", label: "Diferencia (%)", tipo: "num" },
  ],
  "FUNDADO": [
    { k: "FECHA_LECTURA", label: "Fecha de lectura", tipo: "date" },
    { k: "HORA_LECTURA", label: "Hora de lectura", tipo: "text" },
    { k: "OBS_LECTURA", label: "Observaciones de lectura", tipo: "textarea" },
  ],
};

// ¿Este rol puede registrar datos en esta etapa?
export function rolPuedeEtapa(rol, etapa) {
  if (rol === "GERENTE" || rol === "COORDINADOR") return true;
  const e = CAMPOS_ETAPA[etapa];
  return !!e && e.roles.includes(rol);
}

// Contexto "según las bases" por etapa → botón ⓘ. Explica qué es, por qué importan los
// datos, el plazo y la penalidad en juego. También es el contexto que recibe la IA.
// `pen` = ítem/nombre de la penalidad (lo ve TODO el personal).
// `penMonto` = importe en S/ (SOLO visible para GERENTE; los trabajadores no ven montos).
export const INFO_ETAPA = {
  "Recepción": { que_es: "Recoges el cargo del expediente y verificas la admisión en SIELSE.",
    importa: "Aquí ARRANCA el cómputo de plazos. Si la fecha de admisión queda mal, todos los vencimientos se calculan mal.",
    plazo: "Diario (al recibir).", pen: "—", penMonto: "" },
  "Evaluación": { que_es: "Elaboras el Reporte 1 y el histórico de 36 meses.",
    importa: "Define si el plazo es 10 o 30 días hábiles y sustenta la excesiva facturación. Es la base técnica de la resolución.",
    plazo: "Al recibir el expediente.", pen: "—", penMonto: "" },
  "Campo": { que_es: "Verificación de lectura, contraste de medidor o megado, con fotos.",
    importa: "Es la prueba objetiva del consumo. Sin ella la resolución es atacable y se cae en apelación.",
    plazo: "Según OT R01–R07.", pen: "5.4 — trabajos de campo fuera de plazo", penMonto: "S/30" },
  "SIELSE": { que_es: "Informas el resultado en SIELSE y digitalizas el documento.",
    importa: "Lo que registras viaja EN LÍNEA a OSINERGMIN; la fecha y la forma son tu responsabilidad.",
    plazo: "≤ 2 días hábiles.", pen: "5.1 no informar · 5.2 no digitalizar", penMonto: "S/50 · S/30" },
  "Resolución": { que_es: "Proyectas la resolución motivada (ACT-01) con sus medios probatorios.",
    importa: "Una mala motivación se penaliza y puede generar silencio positivo en JARU (la contratista asume el monto del reclamo).",
    plazo: "≤ 8º día hábil (10d) / ≤ 27º (30d).", pen: "5.9 resolución mal motivada · 5.5 silencio JARU", penMonto: "S/100 + monto · S/300 + monto" },
  "Firmas": { que_es: "Circuito de V°B° y firma del Gerente Comercial.",
    importa: "Sin las firmas no puedes notificar; controla los tiempos para no comerte el plazo de notificación.",
    plazo: "El día háb. siguiente a la resolución (deja margen para los ≤5 días de notificación).", pen: "— (sin penalidad propia; el riesgo es la 5.12 de notificación)", penMonto: "" },
  "Notificación": { que_es: "Llevas las cédulas a la notaría y logras la notificación notarial con su cargo.",
    importa: "Si notificas tarde o no logras notificar, es la penalidad más cara y frecuente.",
    plazo: "≤ 5 días hábiles (cédulas a notaría ≤ 4º).", pen: "5.12 notificación notarial tardía/no lograda", penMonto: "S/300 + monto" },
  "Apelación (JARU)": { que_es: "Elaboras el Informe de Elevación (Formato 6) y elevas el expediente a JARU.",
    importa: "Defiendes la resolución de 1ª instancia; elevar tarde o mal expone a la penalidad y al monto.",
    plazo: "≤ 5 días hábiles desde el recurso.", pen: "5.10 apelación fuera de plazo/forma", penMonto: "S/300 + monto" },
  "Foliado": { que_es: "Consolidas el expediente en un único PDF foliado y lo adjuntas a SIELSE.",
    importa: "Un expediente mal foliado se penaliza y complica la auditoría de OSINERGMIN.",
    plazo: "≤ 2 días hábiles desde la cédula.", pen: "5.3 foliar mal/no foliar", penMonto: "S/30" },
  "Cierre": { que_es: "Cierras el reclamo en SIELSE y verificas el monto en el próximo recibo.",
    importa: "Cerrar fuera de plazo genera mora; el cierre ordenado evita observaciones de ELSE.",
    plazo: "≤ 16 días hábiles desde la notificación.", pen: "Mora por día de atraso", penMonto: "fórmula 0.10×monto/(F×plazo)" },
};

// Ayuda corta por campo (por qué importa) → tooltip y contexto para la IA.
export const AYUDA_CAMPO = {
  LECTURA_INSPECCION: "Lectura del medidor en campo; sustenta el consumo real vs. el facturado.",
  CONSUMO_PROMEDIO: "Promedio histórico (Cp); base para detectar excesiva facturación y calcular la devolución.",
  SENTIDO_FALLO: "El fallo determina la plantilla de resolución y los plazos de apelación.",
  N_RESOLUCION: "Correlativo C-####-2026; identifica la resolución ante OSINERGMIN.",
  FECHA_RESOLUCION: "Inicia el plazo de notificación (≤5 días háb.) — clave para evitar la penalidad 5.12.",
  MONTO_DEVOLUCION: "Monto a devolver al usuario; debe reflejarse en el próximo recibo.",
  RESULTADO_PRUEBA: "Conforme/No conforme del medidor; prueba objetiva del reclamo.",
  FECHA_NOTIFICACION: "Fecha real de notificación; arranca el plazo de cierre/apelación.",
  N_FOJAS: "Total de fojas del expediente que se eleva a JARU.",
  FECHA_APELACION: "Inicia el plazo de elevación a JARU (≤5 días háb.) — penalidad 5.10 si se incumple.",
  LECT_ANTERIOR: "Lectura del período anterior; con la actual determina el consumo facturado.",
  LECT_ACTUAL: "Lectura del período reclamado; con la anterior determina el consumo facturado.",
  CONCLUSION_REPORTE1: "Conclusión técnica del Reporte 1 (Anexo 3); va textual al documento.",
  INSPECTOR: "Nombre del técnico que hizo la inspección; firma el informe de campo.",
  CARACTERISTICAS_INMUEBLE: "Descripción del predio; va en el informe de campo y en la cédula.",
  N_CARTA_PRUEBA: "N° de la carta/refacturación que se cita como prueba en la resolución.",
  NOTIFICADOR: "Quien diligencia la notificación (notario o notificador); firma la cédula.",
  RELACION_DOCUMENTOS: "Lista de documentos del expediente que se elevan a JARU (Formato 6).",
};
