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
  { id:7, nombre:"Dante Jara",      corto:"Dante",    rol:"Tramitador/Digitador",     color:"#047857", match:"JARA PARI" },
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
    desc:"Cada mañana (8–9am) recoges en ELSE los expedientes nuevos, los ESCANEAS y los registras en NUESTRA plataforma con ➕ Nuevo caso: la IA extrae los datos del Formato 1 y tú los validas contra el escaneo. Aquí nace el expediente digital; el detalle quedará listo para transcribirlo a SIELSE en su etapa.",
    pasos:["Recoger y escanear el expediente","Registrarlo en la app (➕ Nuevo caso · IA extrae, tú validas)","Verificar registro/admisión"],evi:["Cargo de recepción","Formato 1: Reclamo"],
    guia:{formatos:"PDF (documentos) · JPG/PNG (cargos escaneados)",espera:"El cargo de recepción del expediente y el Formato 1 (solicitud del reclamo que ingresó el usuario). Es la primera foja del expediente."}},
  {etapa:"Evaluación",rol:"Analista Legal",act:"ACT-03",plazo:"al recibir",pen:"—",
    desc:"Analizas el expediente con la información de SIELSE y defines si el reclamo se resuelve en 10 o 30 días hábiles. Para sustentarlo elaboras el Reporte 1 y el anexo de consumo histórico de los últimos 36 meses.",
    pasos:["Analizar con SIELSE","Definir plazo 10/30 días","Reporte 1 + histórico 36m"],evi:["Reporte 1 (Anexo 3)","Anexo a Reporte 1"],
    guia:{formatos:"PDF (Reporte 1) · XLSX (anexo de consumo histórico)",espera:"El Reporte 1 (Anexo 3 de la Directiva 269-2014) y el anexo con el consumo histórico de 36 meses que sustenta si el reclamo es de 10 o 30 días."}},
  {etapa:"Campo",rol:"Tramitador/Digitador",act:"ACT-03",plazo:"R01-R07",pen:"5.4",
    desc:"Programas las órdenes de trabajo a las contratistas de campo (verificación de lectura, contraste de medidor, megado) y controlas que cumplan sus plazos R01–R07. Luego recibes y revisas los resultados.",
    penDesc:"no cumplir los trabajos de campo dentro del plazo se penaliza con S/30 por infracción (ítem 5.4).",
    pasos:["Programar OT (lectura/contraste/megado)","Controlar R01-R07","Recibir resultados"],evi:["Ficha verificación de lectura","Certificado de contraste","Ficha de megado","Fotos de campo"],
    guia:{formatos:"PDF (fichas y certificados) · JPG/PNG (fotos de campo)",espera:"Las fichas técnicas de los trabajos de campo (lectura, contraste, megado) y las fotos que actúan como medios probatorios: medidor, fachada e inventario de cargas."}},
  {etapa:"SIELSE",rol:"Tramitador/Digitador",act:"ACT-03",plazo:"≤2 días",pen:"5.1 / 5.2",
    desc:"TRANSCRIBES al SIELSE de ELSE todo el detalle que ya está registrado en nuestra app (datos del caso + resultados de campo) y digitalizas los documentos — en máximo 2 días hábiles. Nuestra app es donde trabajamos; SIELSE es donde ELSE y OSINERGMIN lo ven: todo lo que digitas ahí viaja en línea al regulador.",
    penDesc:"no informar el resultado en SIELSE cuesta S/50 (5.1); no digitalizar, S/30 (5.2).",
    pasos:["Abrir el expediente en la app (ahí está TODO el detalle a digitar)","Transcribir a SIELSE datos y resultados","Digitalizar/adjuntar documentos","Registrar aquí la constancia (fecha + captura)"],evi:["Captura SIELSE","PDF digitalizado"],
    guia:{formatos:"JPG/PNG (captura del sistema) · PDF (documento digitalizado)",espera:"La constancia de que el resultado fue informado en SIELSE dentro de los 2 días hábiles y el documento digitalizado adjunto al módulo de reclamos."}},
  {etapa:"Resolución",rol:"Analista Legal",act:"ACT-01",plazo:"≤8º/27º día",pen:"5.9 / 5.5 +monto",
    desc:"Proyectas la resolución debidamente motivada: aplicas la norma y los lineamientos JARU, actúas todos los medios probatorios y entregas el documento con sus cédulas (≤8º día hábil para reclamos de 10 días, ≤27º para los de 30).",
    penDesc:"una resolución mal motivada cuesta S/100 + el monto del reclamo (5.9); si JARU declara silencio positivo por mala tramitación, S/300 + el monto (5.5).",
    pasos:["Determinar normas + JARU","Actuar medios probatorios","Redactar resolución motivada","Entregar + cédulas"],evi:["Proyecto de resolución","Cédulas de notificación"],
    guia:{formatos:"PDF (resolución y cédulas) · DOCX (proyecto editable)",espera:"El proyecto de resolución debidamente motivado, con sus medios probatorios actuados, y las cédulas de notificación, entregados dentro del plazo (≤8º/27º día)."}},
  {etapa:"Firmas",rol:"Tramitador / Asistente",act:"ACT-01",plazo:"—",pen:"—",
    desc:"Gestionas el circuito de firmas de la resolución: visto bueno del supervisor comercial, luego del jefe de división y, finalmente, la firma del Gerente Comercial.",
    pasos:["VB supervisor","VB jefe división","Firma Gerente Comercial"],evi:["Resolución firmada"],
    guia:{formatos:"PDF (resolución con firmas y sellos)",espera:"La resolución con el visto bueno del supervisor comercial, del jefe de división y la firma del Gerente Comercial."}},
  {etapa:"Notificación",rol:"Asistente Administrativo",act:"ACT-05",plazo:"≤5 días",pen:"5.12 +monto",
    desc:"Llevas las cédulas a la notaría (≤4º día) y garantizas la notificación notarial dentro de los 5 días hábiles desde la emisión de la resolución, con registro fotográfico de la fachada y la caja portamedidor, y recibes el cargo notarial.",
    penDesc:"notificar fuera de los 5 días o no lograr la notificación cuesta S/300 + el monto del reclamo (5.12).",
    pasos:["Cédulas a notaría (≤4d)","Notificación notarial (≤5d)","Registro fotográfico","Recibir cargo"],evi:["Cargo notarial","Foto fachada","Foto portamedidor"],
    guia:{formatos:"PDF (cargo notarial visado) · JPG/PNG (fotos)",espera:"El cargo notarial con nombre, DNI, fecha y hora de quien recibió (o constancia de bajo puerta), más el registro fotográfico de fachada y caja portamedidor."}},
  {etapa:"Apelación (JARU)",rol:"Analista Junior",act:"ACT-02",plazo:"≤5 días",pen:"5.10 +monto",
    desc:"Si el usuario impugna, evalúas el petitorio, redactas el informe de elevación (Formato 6) y el oficio defendiendo la resolución de 1ª instancia, folias el expediente y lo elevas a JARU en ≤5 días hábiles.",
    penDesc:"no elevar la apelación en el plazo o la forma debida cuesta S/300 + el monto del reclamo (5.10).",
    pasos:["Evaluar petitorio","Informe de elevación (Formato 6)","Oficio","Foliar y elevar"],evi:["Informe de elevación","Oficio de elevación","Expediente foliado"],
    guia:{formatos:"PDF (informe, oficio y expediente foliado)",espera:"El informe de elevación (Formato 6 de la Directiva), el oficio de elevación y el expediente foliado, elevados a JARU dentro de los 5 días hábiles."}},
  {etapa:"Foliado",rol:"Tramitador/Digitador",act:"ACT-03",plazo:"≤2 días",pen:"5.3",
    desc:"Folias el expediente completo, lo escaneas en un solo archivo PDF y lo adjuntas a SIELSE, dentro de los 2 días hábiles de recabada la cédula de notificación.",
    penDesc:"foliar mal o no foliar el expediente cuesta S/30 (5.3).",
    pasos:["Foliar completo","Escanear PDF único","Adjuntar a SIELSE"],evi:["Expediente PDF foliado"],
    guia:{formatos:"PDF (un solo archivo, todas las fojas foliadas)",espera:"El expediente completo en un único PDF foliado (todos los actuados, en orden), listo para adjuntar a SIELSE y archivar. Evita las penalidades 5.2 y 5.3."}},
  {etapa:"Cierre",rol:"Tramitador/Digitador",act:"ACT-03",plazo:"≤16 días",pen:"mora",
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

// ===== fechas =====
export function parseFecha(s){
  if(!s) return null;
  const m = String(s).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if(!m) return null;
  return new Date(+m[3], +m[2]-1, +m[1], +(m[4]||0), +(m[5]||0), +(m[6]||0));
}
export function daysLeft(s, ref=HOY){
  const d = parseFecha(s); if(!d) return null;
  return Math.round((new Date(d.getFullYear(),d.getMonth(),d.getDate()) - new Date(ref.getFullYear(),ref.getMonth(),ref.getDate()))/86400000);
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
  let etapa = cerrado ? "Cierre" : apela ? "Apelación (JARU)" : admitido ? "Resolución" : "Evaluación";
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
    sucursal: r.CodigoSucursal,
    raw: r,
  };
}

// ===== penalidades (escala resumida) =====
export const PEN_TOPE_PCT = 10;
export const MONTO_CONTRATO = 1250000;
