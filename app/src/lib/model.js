// ===== Modelo de dominio: mapea SIELSE (45 columnas) -> modelo del dashboard =====

export const SHEET_URL = "https://docs.google.com/spreadsheets/d/1WGq7sNiWqDld-ULJTmTcAw1yR4hCjGXt5Gqn2P77vXw/edit";
export const DRIVE_URL = "https://drive.google.com/drive/folders/1xA9rf6j9KZq_ZWotegLFSaH3zMFY1ayr";
// URL de las Herramientas (app Streamlit): local en desarrollo, Streamlit Cloud en producción.
export const STREAMLIT_URL = (typeof window !== "undefined" && /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname))
  ? "http://localhost:8501"
  : "https://telcom-herramientas.streamlit.app";
export const HOY = new Date();   // fecha real — los "restan Xd" de las vistas v1 se calculan contra hoy

// Equipo del contrato + matcher contra el campo Responsable (formato "NOMBRES,APELLIDOS")
export const TEAM = [
  { id:1, nombre:"Andre Araujo",    corto:"Andre",    rol:"Coordinador General",      color:"#b91c1c", match:"ARAUJO ALVAREZ" },
  { id:2, nombre:"Diego Marroquín", corto:"Diego",    rol:"Analista Legal",           color:"#1d4ed8", match:"MARROQUIN" },
  { id:3, nombre:"Juan Vargas",     corto:"Juan",     rol:"Analista Legal",           color:"#1d4ed8", match:"VARGAS MIRANDA" },
  { id:4, nombre:"Alvaro Montufar", corto:"Alvaro",   rol:"Analista Junior",          color:"#7c3aed", match:"MONTUFAR" },
  { id:5, nombre:"Milagros León",   corto:"Milagros", rol:"Asistente Administrativo", color:"#b45309", match:"LEON UMERES" },
  { id:6, nombre:"Jocabed Condori", corto:"Jocabed",  rol:"Tramitador/Digitador",     color:"#047857", match:"CONDORI CACERES" },
  { id:7, nombre:"Anais Ramos",     corto:"Anais",    rol:"Tramitador/Digitador",     color:"#047857", match:"ANAIS RAMOS" },
  { id:8, nombre:"Marilyn Hurtado", corto:"Marilyn",  rol:"Tramitador/Digitador",     color:"#047857", match:"HURTADO VEGA" },
];
export const EXTERNO = { id:0, corto:"Externo", nombre:"Externo / Call Center", rol:"No es del equipo", color:"#64748b" };

const norm = s => (s||"").toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[,]/g," ").replace(/\s+/g," ").trim();

export function mapResp(raw){
  const n = norm(raw);
  const t = TEAM.find(m => n.includes(m.match));
  return t || EXTERNO;
}
export const teamById = id => TEAM.find(t=>t.id===id) || EXTERNO;
export const wColor = id => (teamById(id).color);
export const wName  = id => (teamById(id).corto);

// ===== Flujo del expediente (etapas con pasos + evidencia esperada) =====
export const FLUJO = [
  {etapa:"Recepción",rol:"Tramitador/Digitador",act:"ACT-03",plazo:"diario",pen:"—",
    quien:"Lo hacemos NOSOTROS (mesa de partes TELCOM) — el mismo día que ELSE entrega los expedientes.",
    desc:"Cada mañana (8–9am) recoges en ELSE los expedientes nuevos, los ESCANEAS y los registras en NUESTRA plataforma con ➕ Nuevo caso: la IA extrae los datos del Formato 1 y tú los validas contra el escaneo. Aquí nace el expediente digital; el detalle quedará listo para transcribirlo a SIELSE en su etapa.",
    pasos:["Recoger y escanear el expediente","Registrarlo en la app (➕ Nuevo caso · IA extrae, tú validas)","Verificar registro/admisión"],evi:["Cargo de recepción","Formato 1: Reclamo"],
    guia:{formatos:"PDF (documentos) · JPG/PNG (cargos escaneados)",espera:"El cargo de recepción del expediente y el Formato 1 (solicitud del reclamo que ingresó el usuario). Es la primera foja del expediente."}},
  {etapa:"Evaluación",rol:"Analista Legal",act:"ACT-03",plazo:"al recibir",pen:"—",
    quien:"Lo hace NUESTRO analista legal — apenas recibe el caso define si es de 10 o 30 días hábiles.",
    desc:"Analizas el expediente con la información de SIELSE y defines si el reclamo se resuelve en 10 o 30 días hábiles. Para sustentarlo elaboras el Reporte 1 y el anexo de consumo histórico de los últimos 36 meses.",
    pasos:["Analizar con SIELSE","Definir plazo 10/30 días","Reporte 1 + histórico 36m"],evi:["Reporte 1 (Anexo 3)","Anexo a Reporte 1"],
    guia:{formatos:"PDF (Reporte 1) · XLSX (anexo de consumo histórico)",espera:"El Reporte 1 (Anexo 3 de la Directiva 269-2014) y el anexo con el consumo histórico de 36 meses que sustenta si el reclamo es de 10 o 30 días."}},
  {etapa:"Campo",rol:"Tramitador/Digitador",act:"ACT-03",plazo:"R01-R07",pen:"5.4",
    quien:"Lo ejecutan las CONTRATISTAS DE CAMPO de ELSE (plazos R01–R07 en días hábiles) — nosotros generamos la OT, CONTROLAMOS que cumplan su plazo y registramos el resultado.",
    desc:"Programas las órdenes de trabajo a las contratistas de campo (verificación de lectura, contraste de medidor, megado) y controlas que cumplan sus plazos R01–R07. Luego recibes y revisas los resultados.",
    penDesc:"no cumplir los trabajos de campo dentro del plazo se penaliza con S/30 por infracción (ítem 5.4).",
    pasos:["Programar OT (lectura/contraste/megado)","Controlar R01-R07","Recibir resultados"],evi:["Ficha verificación de lectura","Certificado de contraste","Ficha de megado","Fotos de campo"],
    guia:{formatos:"PDF (fichas y certificados) · JPG/PNG (fotos de campo)",espera:"Las fichas técnicas de los trabajos de campo (lectura, contraste, megado) y las fotos que actúan como medios probatorios: medidor, fachada e inventario de cargas."}},
  {etapa:"SIELSE",rol:"Tramitador/Digitador",act:"ACT-03",plazo:"≤2 días háb.",pen:"5.1 / 5.2",
    quien:"Lo hacemos NOSOTROS (tramitador) — transcribir a SIELSE en ≤2 días hábiles de recibido cada resultado.",
    desc:"TRANSCRIBES al SIELSE de ELSE todo el detalle que ya está registrado en nuestra app (datos del caso + resultados de campo) y digitalizas los documentos — en máximo 2 días hábiles. Nuestra app es donde trabajamos; SIELSE es donde ELSE y OSINERGMIN lo ven: todo lo que digitas ahí viaja en línea al regulador.",
    penDesc:"no informar el resultado en SIELSE cuesta S/50 (5.1); no digitalizar, S/30 (5.2).",
    pasos:["Abrir el expediente en la app (ahí está TODO el detalle a digitar)","Transcribir a SIELSE datos y resultados","Digitalizar/adjuntar documentos","Registrar aquí la constancia (fecha + captura)"],evi:["Captura SIELSE","PDF digitalizado"],
    guia:{formatos:"JPG/PNG (captura del sistema) · PDF (documento digitalizado)",espera:"La constancia de que el resultado fue informado en SIELSE dentro de los 2 días hábiles y el documento digitalizado adjunto al módulo de reclamos."}},
  {etapa:"Resolución",rol:"Analista Legal",act:"ACT-01",plazo:"≤8º/27º día háb.",pen:"5.9 / 5.5 +monto",
    quien:"Lo hace NUESTRO analista legal — entrega el proyecto ≤8º día hábil (reclamos de 10) o ≤27º (de 30), contados desde la admisión.",
    desc:"Proyectas la resolución debidamente motivada: aplicas la norma y los lineamientos JARU, actúas todos los medios probatorios y entregas el documento con sus cédulas (≤8º día hábil para reclamos de 10 días, ≤27º para los de 30).",
    penDesc:"una resolución mal motivada cuesta S/100 + el monto del reclamo (5.9); si JARU declara silencio positivo por mala tramitación, S/300 + el monto (5.5).",
    pasos:["Determinar normas + JARU","Actuar medios probatorios","Redactar resolución motivada","Entregar + cédulas"],evi:["Proyecto de resolución","Cédulas de notificación"],
    guia:{formatos:"PDF (resolución y cédulas) · DOCX (proyecto editable)",espera:"El proyecto de resolución debidamente motivado, con sus medios probatorios actuados, y las cédulas de notificación, entregados dentro del plazo (≤8º/27º día)."}},
  {etapa:"Firmas",rol:"Tramitador / Asistente",act:"ACT-01",plazo:"—",pen:"—",
    quien:"Firman los FUNCIONARIOS DE ELSE (supervisor comercial, jefe de división, Gerente Comercial) — nosotros gestionamos el circuito y hacemos seguimiento diario.",
    desc:"Gestionas el circuito de firmas de la resolución: visto bueno del supervisor comercial, luego del jefe de división y, finalmente, la firma del Gerente Comercial.",
    pasos:["VB supervisor","VB jefe división","Firma Gerente Comercial"],evi:["Resolución firmada"],
    guia:{formatos:"PDF (resolución con firmas y sellos)",espera:"La resolución con el visto bueno del supervisor comercial, del jefe de división y la firma del Gerente Comercial."}},
  {etapa:"Notificación",rol:"Asistente Administrativo",act:"ACT-05",plazo:"≤5 días háb.",pen:"5.12 +monto",
    quien:"La ejecuta el NOTARIO (solo ciudad de Cusco) — nosotros llevamos las cédulas a la notaría (≤4º día háb.) y garantizamos que notifique ≤5 días hábiles desde la emisión.",
    desc:"Llevas las cédulas a la notaría (≤4º día) y garantizas la notificación notarial dentro de los 5 días hábiles desde la emisión de la resolución, con registro fotográfico de la fachada y la caja portamedidor, y recibes el cargo notarial.",
    penDesc:"notificar fuera de los 5 días o no lograr la notificación cuesta S/300 + el monto del reclamo (5.12).",
    pasos:["Cédulas a notaría (≤4d)","Notificación notarial (≤5d)","Registro fotográfico","Recibir cargo"],evi:["Cargo notarial","Foto fachada","Foto portamedidor"],
    guia:{formatos:"PDF (cargo notarial visado) · JPG/PNG (fotos)",espera:"El cargo notarial con nombre, DNI, fecha y hora de quien recibió (o constancia de bajo puerta), más el registro fotográfico de fachada y caja portamedidor."}},
  {etapa:"Apelación (JARU)",rol:"Analista Junior",act:"ACT-02",plazo:"≤5 días háb.",pen:"5.10 +monto",
    quien:"NOSOTROS elevamos (Formato 6 + oficio, ≤5 días hábiles) — RESUELVE la JARU de OSINERGMIN (segunda instancia, ya no ELSE).",
    desc:"Si el usuario impugna, evalúas el petitorio, redactas el informe de elevación (Formato 6) y el oficio defendiendo la resolución de 1ª instancia, folias el expediente y lo elevas a JARU en ≤5 días hábiles.",
    penDesc:"no elevar la apelación en el plazo o la forma debida cuesta S/300 + el monto del reclamo (5.10).",
    pasos:["Evaluar petitorio","Informe de elevación (Formato 6)","Oficio","Foliar y elevar"],evi:["Informe de elevación","Oficio de elevación","Expediente foliado"],
    guia:{formatos:"PDF (informe, oficio y expediente foliado)",espera:"El informe de elevación (Formato 6 de la Directiva), el oficio de elevación y el expediente foliado, elevados a JARU dentro de los 5 días hábiles."}},
  {etapa:"Foliado",rol:"Tramitador/Digitador",act:"ACT-03",plazo:"≤2 días háb.",pen:"5.3",
    quien:"Lo hacemos NOSOTROS (tramitador) — ≤2 días hábiles desde que se recaba la cédula de notificación.",
    desc:"Folias el expediente completo, lo escaneas en un solo archivo PDF y lo adjuntas a SIELSE, dentro de los 2 días hábiles de recabada la cédula de notificación.",
    penDesc:"foliar mal o no foliar el expediente cuesta S/30 (5.3).",
    pasos:["Foliar completo","Escanear PDF único","Adjuntar a SIELSE"],evi:["Expediente PDF foliado"],
    guia:{formatos:"PDF (un solo archivo, todas las fojas foliadas)",espera:"El expediente completo en un único PDF foliado (todos los actuados, en orden), listo para adjuntar a SIELSE y archivar. Evita las penalidades 5.2 y 5.3."}},
  {etapa:"Cierre",rol:"Tramitador/Digitador",act:"ACT-03",plazo:"≤16 días háb.",pen:"mora",
    quien:"Lo hacemos NOSOTROS en SIELSE — ≤16 días desde la notificación, si el usuario no apeló.",
    desc:"Si el usuario no impugna, cierras el reclamo en SIELSE (≤16 días desde la notificación), verificas que el monto se incluya en el próximo recibo y entregas el expediente a ELSE una vez por semana para su archivo.",
    penDesc:"cerrar el expediente fuera de plazo genera penalidad por mora diaria.",
    pasos:["Cerrar en SIELSE","Verificar monto en recibo","Entrega semanal a ELSE"],evi:["Captura cierre SIELSE","Constancia OSINERGMIN"],
    guia:{formatos:"JPG/PNG (captura de cierre) · PDF (constancia)",espera:"La constancia del cierre del reclamo en SIELSE (≤16 días desde la notificación) y, de corresponder, la constancia de envío a OSINERGMIN."}},
];
export const ETAPAS = FLUJO.map(f=>f.etapa);
// nombre amigable de etapa -> carpeta NN en Drive
export const ETAPA_NN = {
  "Recepción":"01_Recepcion","Evaluación":"02_Evaluacion","Campo":"03_Campo","SIELSE":"04_SIELSE",
  "Resolución":"05_Resolucion","Firmas":"06_Firmas","Notificación":"07_Notificacion",
  "Apelación (JARU)":"08_Apelacion","Foliado":"09_Foliado","Cierre":"10_Cierre",
};
export const stageIdx = e => ETAPAS.indexOf(e);
export const metaEtapa = e => FLUJO[stageIdx(e)] || FLUJO[0];

// Rol canónico (enum) que trabaja cada etapa — ESPEJO de Dominio.ETAPAS[..][2] del backend
// (V2_01_Nucleo.gs). Base del "tomar tarea": un trabajador solo puede auto-asignarse un
// ticket cuya etapa la trabaja SU rol (sustitución entre pares; p.ej. los 3 tramitadores
// entre sí). Debe coincidir EXACTO con el gate de H_tomar_tarea; si cambia el backend, cambiar aquí.
export const ETAPA_ROL = {
  "Recepción":"TRAMITADOR", "Evaluación":"ANALISTA_LEGAL", "Campo":"TRAMITADOR", "SIELSE":"TRAMITADOR",
  "Resolución":"ANALISTA_LEGAL", "Firmas":"TRAMITADOR", "Notificación":"ASISTENTE",
  "Apelación (JARU)":"ANALISTA_JUNIOR", "Foliado":"TRAMITADOR", "Cierre":"TRAMITADOR",
};
// ¿Este rol puede TOMAR (auto-asignarse) un ticket de esta etapa? Mismo rol = sí.
export const puedeTomar = (rol, etapa) => !!rol && ETAPA_ROL[etapa] === rol;

// Etapas de plazo legal "duro" (riesgo de silencio administrativo positivo / notarial) — ESPEJO
// de Dominio.ETAPAS_CRITICAS del backend. Fallback local; `aplicarDominio` la reemplaza en sitio.
export const CRITICAS = ["Resolución", "Notificación", "Apelación (JARU)"];

// ===== fechas =====
export function parseFecha(s){
  if(!s) return null;
  if(s instanceof Date) return isNaN(s) ? null : s;
  const t = String(s).trim();
  // ISO del backend: celdas de FECHA reales en el Sheet llegan como "2026-08-21T05:00:00.000Z"
  // (así quedó la hoja tras importar el Excel de SIELSE). Con hora → Date directo (respeta zona);
  // solo fecha "2026-08-21" → construir LOCAL para no retroceder un día en Lima (UTC-5).
  if(/^\d{4}-\d{2}-\d{2}T/.test(t)){ const d = new Date(t); return isNaN(d) ? null : d; }
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(iso) return new Date(+iso[1], +iso[2]-1, +iso[3]);
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if(!m) return null;
  return new Date(+m[3], +m[2]-1, +m[1], +(m[4]||0), +(m[5]||0), +(m[6]||0));
}
// ===== días HÁBILES (lun-vie, sin feriados Perú/Cusco — alineado con lib/plazosNormativos y backend) =====
// FALLBACK local (hasta que cargue GET dominio / si la red falla): fijos por patrón MM-DD
// (aplica a CUALQUIER año) + móviles explícitos 2026-2028. Cubre el plazo del contrato aunque
// nunca llegue a aplicarse `aplicarDominio` (sin red, sin sesión, etc.).
const FERIADOS_FIJOS_MMDD = new Set(["01-01","05-01","06-07","06-24","06-29","07-23","07-28","07-29","08-06","08-30","10-08","11-01","12-08","12-09","12-25"]);
const FERIADOS_MOVILES_ISO = new Set(["2026-04-02","2026-04-03","2027-03-25","2027-03-26","2028-04-13","2028-04-14"]);
// Fuente ÚNICA real (Dominio.FERIADOS del backend, 2026-2030): vacío hasta que `aplicarDominio()`
// la llene (una vez, al arrancar la app). Mientras esté vacío, esDiaHabil usa el fallback de arriba.
const FERIADOS_ISO = new Set();
// esFeriado: única fuente de "¿es feriado?" (SIN el chequeo de fin de semana — eso lo hace
// esDiaHabil aquí abajo, y esHabil en plazosNormativos.js). Exportada para que
// lib/plazosNormativos.js (SalaExpediente/CalendarioRelojes) deje de mantener su propia copia
// de FERIADOS_FIJOS_MMDD/FERIADOS_VARIABLES_ISO — misma lista, misma semántica (verificado
// 2026-07: ambas copias eran idénticas antes de unificar). No se expone el Set FERIADOS_ISO
// directo (mutable, lo llena aplicarDominio) para que nadie fuera de este módulo lo reasigne.
export function esFeriado(d){
  const mm = String(d.getMonth()+1).padStart(2,"0"), dd = String(d.getDate()).padStart(2,"0");
  if(FERIADOS_ISO.size) return FERIADOS_ISO.has(d.getFullYear()+"-"+mm+"-"+dd);   // backend ya cargó: manda
  if(FERIADOS_FIJOS_MMDD.has(mm+"-"+dd)) return true;                             // fallback local
  return FERIADOS_MOVILES_ISO.has(d.getFullYear()+"-"+mm+"-"+dd);
}
export function esDiaHabil(d){
  const dow = d.getDay(); if(dow===0 || dow===6) return false;
  return !esFeriado(d);
}
// días HÁBILES restantes hasta la fecha (negativo = venció hace N d háb.) — los plazos del
// contrato y de la Directiva son SIEMPRE hábiles; nada se muestra en días corridos.
export function daysLeft(s, ref=HOY){
  const d = parseFecha(s); if(!d) return null;
  let x = new Date(ref.getFullYear(),ref.getMonth(),ref.getDate());
  let y = new Date(d.getFullYear(),d.getMonth(),d.getDate());
  if(x.getTime()===y.getTime()) return 0;
  const sign = y>x ? 1 : -1;
  const lo = sign>0 ? x : y, hi = sign>0 ? y : x;
  let c = 0; const t = new Date(lo);
  while(t<hi){ t.setDate(t.getDate()+1); if(esDiaHabil(t)) c++; }
  return sign*c;
}
export const fmtFecha = s => { const d=parseFecha(s); return d? d.toLocaleDateString("es-PE") : (s||"—"); };

// ===== map de un reclamo SIELSE -> modelo app =====
export function mapReclamo(r, i){
  const resp = mapResp(r.Responsable);
  const estadoCom = (r.NombreEstadoReclamoComercial||"").trim();
  const cerrado = estadoCom === "CERRADO";
  const venc = String(r.vencido||"0") !== "0";
  const apela = String(r.Apelacion||"0") === "1";
  const admitido = String(r.EsAdmitido||"") === "1";
  // respaldo v1 (solo casos sin tickets) — misma honestidad que _pathDe del backend:
  // admitido garantiza Recepción+Evaluación; con resolución emitida vive en Firmas
  const conRes = String(r.NombreTipoResolucionReclamo||"").trim() !== "";
  let etapa = cerrado ? "Cierre" : apela ? "Apelación (JARU)" : conRes ? "Firmas" : admitido ? "Campo" : "Evaluación";
  let estado = cerrado ? "Cerrado" : venc ? "Observado" : "En proceso";
  return {
    id: i+1,
    codigo: r.CodigoReclamo,
    osinerg: r.NumeroOsinerg,
    solicitante: r.NombreSolicitante,
    direccion: r.DireccionSolicitante,
    suministro: r.CodigoSuministro,
    clase: r.NombreClaseReclamo,
    tipoRes: r.NombreTipoResolucionReclamo,
    forma: r.NombreFormaReclamo,
    situacion: r.NombreSituacionReclamo,
    area: r.NombreAreaAdministrativa,
    motivoCierre: r.NombreMotivoCierreReclamo,
    estadoCom, estado, etapa, vencido:venc, apelacion:apela, admitido,
    respRaw: r.Responsable, resp: resp.id,
    depto:r.NombreDepartamento, provincia:r.NombreProvincia, distrito:r.NombreDistrito,
    set:r.NombreSET, sed:r.NombreSED, referencia:r.ReferenciaUbicacion,
    descripcion: r.DescripcionReclamo, solucion: r.DescripcionSolucion,
    docRef: r.DocumentoReferencia,
    fechaReg: r.FechaRegistroReclamo, fechaAdm: r.FechaAdmisionReclamo,
    fechaLim: r.FechaLimiteAtencion, fechaSol: r.FechaHoraSolucionReclamo,
    fechaEstimada: r.FechaEstimadaSolucion,
    usuarioCrea: r.UsuarioCrea, usuarioModifica: r.UsuarioModifica,
    fechaMod: r.FechaModificacion,   // última modificación registrada EN SIELSE (viene del export)
    sucursal: r.CodigoSucursal,
    raw: r,
  };
}

// ===== penalidades (escala resumida) =====
export const PEN_TOPE_PCT = 10;
export const MONTO_CONTRATO = 1250000;

// ===== HERENCIA CONTRACTUAL =====
// TELCOM tomó el contrato CP-026-2026-ELSE el 01/07/2026 (se importó el histórico completo de
// SIELSE ene→10 jul, ~4,341 casos). Los casos cuyo plazo venció ANTES de este corte son gestión
// de la contratista ANTERIOR — no se presumen cerrados (jamás auto-cerrar por antigüedad: riesgo
// penalidad 5.5 si en verdad seguían en trámite), pero SÍ se segmentan de las alarmas de HOY
// para no inflarlas con vencidos que no son responsabilidad de TELCOM. Ver HerenciaPanel.jsx
// (Reportes → ⚖ Herencia) para el archivado en lote CON evidencia de resolución.
export const CORTE_TELCOM = "2026-07-01";
// ¿Esta fecha límite (cualquier formato que entienda parseFecha) es ANTERIOR al corte? Un plazo
// aún corriendo, o que vence el mismo corte o después, NUNCA es herencia — aunque venza mañana.
export function esHerencia(fechaLimite){
  const d = parseFecha(fechaLimite);
  if(!d) return false;
  return d < parseFecha(CORTE_TELCOM);
}
// Conveniencia para tickets (t.vencido + t.fechaLimite, ver lib/tickets.js mapTicket): solo un
// ticket YA VENCIDO cuyo plazo cayó antes del corte es herencia. Un vencido posterior al 01/07
// es NUESTRO (TELCOM ya tenía el servicio) — nunca es herencia aunque esté fuera de plazo.
export function esHerenciaTicket(t){
  return !!(t && t.vencido && esHerencia(t.fechaLimite));
}

// ============================================================================
// ===== SINCRONIZACIÓN CON EL BACKEND (GET dominio → Dominio.publico()) =====
// ============================================================================
// TEAM/FLUJO/ETAPA_ROL/CRITICAS/feriados arriba son el FALLBACK local: la app debe seguir
// funcionando (con esos valores) si `dominio` falla o no hay red — hay plazos contractuales
// de por medio. `aplicarDominio(dom)` la llama api.js UNA sola vez al arrancar (loadDominio,
// con caché) y actualiza estas estructuras EN SITIO (mutación in-place: los `find`/push/Object.assign
// de abajo, nunca `TEAM = ...`) para que las referencias que YA importaron otros módulos
// (tickets.js, componentes…) vean el cambio sin tener que volver a importar nada.
//
// Qué SÍ se sincroniza 1:1 (mismo shape, mismo significado en front y back):
//   - equipo: usuario/nombre/corto/color/buzones de cada TEAM[i] (match por `id` = resp_id).
//   - ETAPA_ROL[etapa]: el rol-enum que trabaja cada etapa (backend = única fuente real).
//   - CRITICAS: la lista de etapas con plazo legal duro.
//   - feriados: reemplaza POR COMPLETO el set de fechas no laborables (backend cubre 2026-2030
//     completo; el fallback local solo llega a 2028).
//
// Qué NO se pisa (y por qué — ver riesgos en el mensaje final del worker):
//   - TEAM[i].rol / TEAM[i].match: `dominio.equipo[].rol` es el ENUM (p.ej. "COORDINADOR"), no
//     el label humano que usa la UI ("Coordinador General"); y el backend NO expone `match`
//     (los patrones para reconocer el campo Responsable de SIELSE) — solo vive en el código.
//     El enum sí se guarda, pero aparte, en `TEAM[i].rolEnum` (campo nuevo, aditivo).
//   - FLUJO[i].rol/plazo/pen (textos humanos, a veces combinan varios códigos de penalidad,
//     p.ej. "5.9 / 5.5 +monto"): `dominio.etapas[].rol/pen` son más simples (un solo código/enum)
//     y pisarlos perdería esa información ya mostrada en FlujoCards. Se guardan aparte, aditivos,
//     en FLUJO[i].rolEnum / FLUJO[i].penCodigo. Sí se sincronizan `act`, `dias` (nuevo, aditivo)
//     y `nn` (nuevo, aditivo) por ser el mismo dato con el mismo formato.
//   - EXTERNO (id 0, sentinel "sin match" para Responsable que no calza con nadie del equipo):
//     el backend NO lo manda en `equipo` (ahí id 0 sería el GERENTE, otro concepto) — se
//     conserva intacto, nunca se toca ni se borra.
export function aplicarDominio(dom){
  if(!dom || typeof dom !== "object") return;

  // ---- equipo (roster real: cambia con las altas/bajas de personal — 2026-07 resp_id 4/6/7) ----
  if(Array.isArray(dom.equipo)){
    dom.equipo.forEach(d => {
      const m = TEAM.find(x => x.id === d.id);
      if(!m) return;   // id que no existe en el fallback local: no hay slot, se ignora
      if(d.usuario) m.usuario = d.usuario;
      if(d.nombre)  m.nombre  = d.nombre;
      if(d.corto)   m.corto   = d.corto;
      if(d.color)   m.color   = d.color;
      if(Array.isArray(d.buzones)) m.buzones = d.buzones;
      if(d.rol)     m.rolEnum = d.rol;   // enum aparte — no pisa el label humano `rol`
    });
  }

  // ---- etapas: FLUJO conserva su contenido editorial (desc/pasos/evi/guia/penDesc/plazo/pen);
  // solo sincroniza los campos operativos con el mismo shape/semántica en ambos lados.
  if(Array.isArray(dom.etapas)){
    dom.etapas.forEach(d => {
      const f = FLUJO.find(x => x.etapa === d.etapa);
      if(f){
        if(d.act) f.act = d.act;
        if(d.nn) f.nn = d.nn;
        if(d.dias != null) f.dias = d.dias;
        if(d.rol) f.rolEnum = d.rol;
        if(d.pen) f.penCodigo = d.pen;
      }
      // ETAPA_ROL[etapa]: SÍ es un espejo 1:1 del enum del backend — aquí manda el backend.
      if(d.etapa && d.rol) ETAPA_ROL[d.etapa] = d.rol;
    });
  }

  // ---- etapas críticas (plazo legal duro / riesgo SAP) ----
  if(Array.isArray(dom.criticas) && dom.criticas.length){
    CRITICAS.length = 0;
    dom.criticas.forEach(e => CRITICAS.push(e));
  }

  // ---- feriados: el backend es la fuente real (2026-2030); reemplaza el set completo ----
  if(Array.isArray(dom.feriados) && dom.feriados.length){
    FERIADOS_ISO.clear();
    dom.feriados.forEach(f => { if(f) FERIADOS_ISO.add(String(f).slice(0,10)); });
  }
}
