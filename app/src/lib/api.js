// ===== Capa de acceso a datos =====
import { mapReclamo } from "./model.js";

// ===== BACKEND V2 (corte 2026-07-07) — router declarativo, GETs con token =====
export const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxJUZgISsiaXr1rNOFS5alyULjmhYkxGvn0AdmWytIrCcNIS3rYQPUGUtDD5F8-i4pI4w/exec";
// ROLLBACK V1 (vivo ~1 semana): descomentar esta línea y recompilar para volver atrás.
// export const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycby873l5XjLOfkrjwl7R0E-lqN7FcWzwVruQOM9T0W8FU7lP_mz6nkKkcI3CcKdry8im/exec";
export const USE_MOCK = false;            // false = login y escrituras al backend real
const SESION_KEY = "sesion_reclamos";

function getToken(){ try { return JSON.parse(localStorage.getItem(SESION_KEY))?.token; } catch { return null; } }
// V2: TODOS los GET de datos exigen sesión — el token viaja en la URL
const GET_URL = a => APPS_SCRIPT_URL + "?action=" + a + "&token=" + encodeURIComponent(getToken() || "");
// Si el backend responde "sesión inválida" (token del V1 o expirado): cerrar sesión y
// recargar UNA vez para que el usuario re-loguee — sin esto caería en silencio al respaldo local.
function sesionExpirada(j){
  if(j && typeof j === "object" && !Array.isArray(j) && /sesi/i.test(String(j.error || "")) ){
    try { localStorage.removeItem(SESION_KEY); } catch(e){}
    if (!sessionStorage.getItem("relogin_v2")) { sessionStorage.setItem("relogin_v2", "1"); location.reload(); }
    return true;
  }
  return false;
}

// Caché en memoria (por sesión de la página) para datos que cambian POCO (catálogos, config…):
// evita re-descargarlos en cada navegación. No cachea resultados vacíos (para reintentar).
const _cache = new Map();
async function cached(key, ttlMs, fn){
  const hit = _cache.get(key);
  if(hit && (Date.now() - hit.t) < ttlMs) return hit.v;
  const v = await fn();
  const vacio = v==null || (Array.isArray(v)&&!v.length) || (typeof v==="object"&&!Array.isArray(v)&&!Object.keys(v).length);
  if(!vacio) _cache.set(key, { t: Date.now(), v });
  return v;
}

// Lectura de reclamos EN VIVO desde el Sheet (fuente de verdad). El JSON local queda
// solo como respaldo si la API no responde (sin red / CORS).
export async function loadReclamos(){
  try{
    const res = await fetch(GET_URL("reclamos"));
    const raw = await res.json();
    if(Array.isArray(raw)) return raw.map(mapReclamo);   // [] válido = cartera en blanco
    if(sesionExpirada(raw)) return [];                   // fuerza re-login, NO respaldo viejo
  }catch(e){ /* cae al respaldo local */ }
  try{
    const res = await fetch("./reclamos.json");
    const raw = await res.json();
    return raw.map(mapReclamo);
  }catch(e){ return []; }
}

// Mapea el nombre de carpeta (NN_Etapa) del backend al nombre de etapa del frontend.
const NN_TO_ETAPA = {
  "01_Recepcion":"Recepción","02_Evaluacion":"Evaluación","03_Campo":"Campo","04_SIELSE":"SIELSE",
  "05_Resolucion":"Resolución","06_Firmas":"Firmas","07_Notificacion":"Notificación",
  "08_Apelacion":"Apelación (JARU)","09_Foliado":"Foliado","10_Cierre":"Cierre",
};

// ===== BITÁCORA (`registros`) — UNA sola descarga, tres derivados =====
// El arranque necesita evidencias + datos_etapa + comentarios + la bitácora cruda; TODOS salen de
// la MISMA hoja `registros`. Antes se descargaba 4 veces (lenta y crece sin límite). Ahora se baja
// UNA vez (_fetchRegistros) y se derivan en el navegador. loadRegistrosBundle() hace justo eso.
async function _fetchRegistros(){
  if(!APPS_SCRIPT_URL) return [];
  try{
    const res = await fetch(GET_URL("registros"));
    const rows = await res.json();
    return Array.isArray(rows) ? rows : [];
  }catch(e){ return []; }
}
function _derivEvidencias(rows){
  const mapped = (rows||[]).filter(r => r.tipo === "evidencia").map(r => {
    let d = {}; try { d = typeof r.detalle === "string" ? JSON.parse(r.detalle) : (r.detalle||{}); } catch(e){}
    return {
      exp: String(r.reclamo),
      etapa: NN_TO_ETAPA[d.etapa] || d.etapa,
      nombre: d.nombre || "documento",
      tipo: d.tipo || "PDF",
      url: d.url || "",
      fecha: String(r.fecha||"").slice(0,10),
      usuario: r.usuario || "",
      resp: 0,
    };
  });
  // deduplica por expediente + etapa + nombre + url (deja la última versión)
  const seen = new Set(), pass1 = [];
  for(let i = mapped.length-1; i>=0; i--){
    const e = mapped[i], k = e.exp+"|"+e.etapa+"|"+e.nombre+"|"+(e.url||"");
    if(seen.has(k)) continue; seen.add(k); pass1.unshift(e);
  }
  // segunda pasada: la URL identifica al archivo físico en Drive — si dos registros del
  // mismo expediente comparten la misma url no vacía, son el mismo documento (colapsa a 1).
  const seenUrl = new Set(), out = [];
  for(let i = pass1.length-1; i>=0; i--){
    const e = pass1[i];
    if(e.url){ const ku = e.exp+"|"+e.url; if(seenUrl.has(ku)) continue; seenUrl.add(ku); }
    out.unshift(e);
  }
  return out;
}
function _derivDatos(rows){
  const map = {};
  (rows||[]).filter(r => r.tipo === "datos").forEach(r => {
    let d = {}; try { d = typeof r.detalle === "string" ? JSON.parse(r.detalle) : (r.detalle||{}); } catch(e){}
    if(!d.etapa) return;
    const k = String(r.reclamo) + "|" + d.etapa;
    map[k] = { ...(map[k]||{}), ...(d.campos||{}) };   // última versión gana
  });
  return map;
}
function _derivComentarios(rows){
  return (rows||[]).filter(r => r.tipo === "comentario").map(r => {
    let d = {}; try { d = typeof r.detalle === "string" ? JSON.parse(r.detalle) : (r.detalle||{}); } catch(e){}
    return { reclamo:String(r.reclamo), etapa:d.etapa||"", texto:d.texto||"", rol:d.rol||"", nombre:d.nombre||r.usuario, usuario:r.usuario, fecha:String(r.fecha||"").slice(0,16).replace("T"," ") };
  });
}
// Descarga la bitácora UNA vez y devuelve los 4 conjuntos que necesita el arranque.
export async function loadRegistrosBundle(){
  const rows = await _fetchRegistros();
  return { registros: rows, evidencias: _derivEvidencias(rows), datos: _derivDatos(rows), comentarios: _derivComentarios(rows) };
}
// Compat: cada loader individual sigue existiendo (1 fetch propio) para refrescos puntuales.
export async function loadEvidencias(){ return _derivEvidencias(await _fetchRegistros()); }

// ===== TICKETS (esquema v2) =====
// Lee los tickets reales del backend (hoja tickets). Devuelve [] si no hay backend/CORS.
export async function loadTickets(){
  if(!APPS_SCRIPT_URL) return [];
  try{
    const res = await fetch(GET_URL("tickets"));
    const rows = await res.json();
    return Array.isArray(rows) ? rows : [];
  }catch(e){ return []; }
}

// Lee el calendario (vencimientos + hitos). Si el backend no lo trae, el front lo deriva de tickets.
export async function loadCalendario(){
  if(!APPS_SCRIPT_URL) return [];
  try{
    const res = await fetch(GET_URL("calendario"));
    const rows = await res.json();
    return Array.isArray(rows) ? rows : [];
  }catch(e){ return []; }
}

// Cambia el estado de un ticket y/o reasigna responsable (solo Coordinador/Gerente) — con token.
export async function updTicket(ticket_id, estado, reclamo, responsable_id, responsable){
  return postAction("upd_ticket", { ticket_id, estado, reclamo, responsable_id, responsable });
}

// TOMAR (auto-asignarse) una tarea del pozo del equipo — self-claim entre pares del mismo rol.
// El backend fija el responsable = quien llama y lo firma en bitácora (tipo tomar_tarea).
export async function tomarTarea(ticket_id, reclamo){
  return postAction("tomar_tarea", { ticket_id, reclamo });
}

// Resume un documento del expediente con IA (Gemini lee escaneos/PDF). Devuelve {ok,resumen}.
export async function resumirIA({ fileId, url, texto, prompt, reclamo, etapa }){
  return postAction("resumir_ia", { fileId, url, texto, prompt, reclamo, etapa });
}
// Copiloto de texto (DeepSeek). Devuelve {ok,respuesta}.
export async function iaChat({ prompt, sistema, contexto, reclamo }){
  return postAction("ia_chat", { prompt, sistema, contexto, reclamo });
}

// Extrae campos de un documento (Gemini) como SUGERENCIA (guardar=false). Devuelve {ok,campos:{K:valor|null}}.
// Acepta un File del navegador (lo lee a base64) o un fileId/url de Drive.
export async function extraerCamposIA({ file, fileId, url, etapa, campos, reclamo, guardar = false }){
  let base64, mime;
  if (file) { base64 = await fileToBase64(file); mime = file.type || "application/pdf"; }
  return postAction("extraer_ia", { base64, mime, fileId, url, etapa, campos, reclamo, guardar });
}

// Lee el log completo (registros) — para el resumen diario del Gerente.
export async function loadRegistros(){ return _fetchRegistros(); }

// Inicia un expediente nuevo (Recepción). Devuelve {ok, codigo}.
export async function nuevoReclamo(datos){
  return postAction("nuevo_reclamo", { datos });
}

// ===== BANDEJA DE CORREOS =====
// Lee los correos sincronizados (buzones ELSE/OSINERGMIN). Devuelve:
//  - [] si hay backend pero la bandeja está vacía (o falló la red/CORS)
//  - null si el backend AÚN NO implementa action=correos (respuesta no es un array) ->
//    la pestaña Bandeja lo interpreta como "se activa tras el próximo redeploy".
export async function loadCorreos(){
  if(!APPS_SCRIPT_URL) return [];
  const token = getToken();
  if(!token) return [];
  try{
    const res = await fetch(APPS_SCRIPT_URL + "?action=correos&token=" + encodeURIComponent(token));
    const rows = await res.json();
    return Array.isArray(rows) ? rows : null;
  }catch(e){ return []; }
}

// Vincula un correo a un expediente existente (por código/OSINERG). Escritura vía POST estándar.
export async function vincularCorreo(id, codigo){
  return postAction("vincular_correo", { id, codigo });
}

// Lee el cuerpo completo de un correo (asunto/de/fecha/text/html). Devuelve {ok:false} si
// el backend aún no implementa action=correo_completo (o hay error de red/CORS/sesión).
export async function correoCompleto(id){
  if(!APPS_SCRIPT_URL) return { ok:false };
  const token = getToken();
  if(!token) return { ok:false, error:"Sin sesión" };
  try{
    const res = await fetch(APPS_SCRIPT_URL + "?action=correo_completo&id=" + encodeURIComponent(id) + "&token=" + encodeURIComponent(token));
    const data = await res.json();
    return data && typeof data === "object" ? data : { ok:false };
  }catch(e){ return { ok:false, error:String(e) }; }
}

// Responde un correo desde el buzón TELCOM (texto plano). Devuelve {ok,...} / {ok:false,error}.
export async function responderCorreo(id, texto){
  return postAction("responder_correo", { id, texto });
}

// Previsualiza TRADUCIDO un adjunto .eml (correo reenviado como archivo) ya guardado en Drive.
// Devuelve {ok,de,para,cc,fecha,asunto,html,text} o {ok:false,error}.
export async function verEml(idCorreo, nombre){
  if(!APPS_SCRIPT_URL) return { ok:false, error:"Sin backend" };
  const token = getToken();
  if(!token) return { ok:false, error:"Sin sesión" };
  try{
    const url = APPS_SCRIPT_URL + "?action=ver_eml&id=" + encodeURIComponent(idCorreo) + "&nombre=" + encodeURIComponent(nombre) + "&token=" + encodeURIComponent(token);
    const res = await fetch(url);
    const data = await res.json();
    return data && typeof data === "object" ? data : { ok:false, error:"respuesta inválida" };
  }catch(e){ return { ok:false, error:String(e) }; }
}

// Lee un File del navegador como base64 (sin el prefijo data:).
function fileToBase64(file){
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(",")[1] || "");
    r.onerror = rej; r.readAsDataURL(file);
  });
}
// Sube un archivo real (PDF/imagen) a la carpeta del reclamo/etapa en Drive. Devuelve {ok,url,nombre}.
export async function subirArchivo(reclamo, etapaNN, file){
  const base64 = await fileToBase64(file);
  return postAction("subir_archivo", { reclamo, etapaNN, nombre: file.name, mime: file.type || "application/octet-stream", base64 });
}

// Lee los datos de etapa registrados (registros tipo=datos) -> mapa "exp|etapa" -> {campos}
export async function loadDatos(){ return _derivDatos(await _fetchRegistros()); }

// Guarda los datos de una etapa (van a registros, tipo=datos) y prellenan los Word después.
export async function guardarDatos({ exp, etapa, rol, campos }){
  return postAction("guardar_datos", { reclamo: exp, etapa, rol, campos });
}

// Observaciones/comentarios del expediente (registros tipo=comentario). Cualquier rol puede añadir.
export async function loadComentarios(){ return _derivComentarios(await _fetchRegistros()); }
export async function comentar({ reclamo, etapa, texto, nombre }){
  return postAction("comentar", { reclamo, etapa, texto, nombre });
}

// Ficha SIELSE editable: escribe la columna real de la hoja reclamos (o datos_etapa si no
// hay columna) y deja rastro en registros. El caller debe refrescar la cartera al éxito.
export async function editarReclamo(codigo, campo, valor){
  return postAction("editar_reclamo", { codigo, campo, valor });
}

// Config general (v4): hoja `config` del Sheet (clave->valor), p.ej. PU_ACT01..PU_ACT05
// (precios unitarios reales de la oferta económica). Si el backend aún no la implementa,
// devuelve {} y el caller usa sus valores por defecto (placeholder).
export async function loadConfig(){
  return cached("config", 600000, async () => {   // cambia poco → caché 10 min (evita el doble fetch Admin+Reportes)
    try{
      const r = await fetch(GET_URL("config"));
      const j = await r.json();
      if(j && typeof j==="object" && !Array.isArray(j)) return j;
    }catch(e){ /* respaldo: {} */ }
    return {};
  });
}

// Eliminar expediente (SOLO Gerencia, motivo obligatorio). El backend borra reclamo+tickets+
// calendario y deja el rastro firmado en la bitácora (registros y datos_etapa se conservan).
export async function eliminarReclamo(codigo, motivo){
  return postAction("eliminar_reclamo", { codigo, motivo });
}

// Catálogos SIELSE (v4): hoja `catalogos` del Sheet (grupo|valor|extra); si aún no existe
// (falta ejecutarSetupCatalogos o el redeploy), devuelve null y el wizard usa CATALOGOS_LOCAL.
export async function loadCatalogos(){
  return cached("catalogos", 600000, async () => {   // catálogos = referencia estable → caché 10 min
    try{
      const res = await fetch(GET_URL("catalogos"));
      const raw = await res.json();
      if(Array.isArray(raw) && raw.length) return raw;   // [{grupo, valor, extra}]
    }catch(e){ /* respaldo local */ }
    return null;
  });
}

// ===== 📒 CUADERNOS 2026 (V2_06) =====
// Contadores para el hub (total/huecos/cruces por tipo + por mes + url del Sheet generado).
export async function loadCuadernosResumen(){
  // el resumen es pesado (~25s) y Apps Script a veces devuelve un 404 transitorio en el
  // redirect → reintentar unas veces antes de rendirse (así el hub no queda en 0/"cargando").
  for(let i=0;i<3;i++){
    try{
      const r = await fetch(GET_URL("cuadernos_resumen"));
      const j = await r.json();
      if(j && j.ok) return j;
      if(sesionExpirada(j)) return null;
    }catch(e){ /* transitorio: reintenta */ }
    await new Promise(res=>setTimeout(res, 1500));
  }
  return null;
}
// Registros de cuadernos de UN expediente (cruce por código / N° OSINERG) — conecta SIELSE ⇄ cuadernos.
export async function loadCuadernosPorCaso(codigo, osinerg){
  try{
    const url = GET_URL("cuadernos_por_caso") + "&codigo=" + encodeURIComponent(codigo||"") + "&osinerg=" + encodeURIComponent(osinerg||"");
    const r = await fetch(url);
    const j = await r.json();
    if(Array.isArray(j)) return j;
    sesionExpirada(j);
  }catch(e){ /* sin backend */ }
  return [];
}
// Filas de UN cuaderno: fuente='mensual' (+mes opcional 1-12) o un tipo de registros_control.
export async function loadCuadernoDatos(fuente, mes){
  try{
    const url = GET_URL("cuadernos_datos") + "&fuente=" + encodeURIComponent(fuente) + (mes ? "&mes=" + mes : "");
    const r = await fetch(url);
    const j = await r.json();
    if(Array.isArray(j)) return j;
    sesionExpirada(j);
  }catch(e){ /* sin backend */ }
  return null;
}
// Alta (sin id) o edición (con id) de una fila de registros_control — queda en bitácora.
export async function registroControl(payload){
  return postAction("registro_control", payload);
}
// Regenera el Google Sheet «📒 CUADERNOS 2026» (solo Coordinación/Gerencia).
export async function regenerarCuadernos(){
  return postAction("regenerar_cuadernos", {});
}
// PEGAR DE EXCEL: sube N filas a un cuaderno — upsert idempotente por llave natural, así pegar
// dos veces actualiza y no duplica. payload = {tipo, rows} (temáticos) o {hoja:'cuaderno_mensual', rows}.
export async function cuadernosBulk(payload){
  return postAction("cuadernos_bulk", payload);
}

// Escrituras (delegar / estado / evidencia / reporte). Real si hay sesión válida; simula si token mock.
export async function postAction(action, payload){
  const token = getToken();
  // Modo demo real (USE_MOCK): simula éxito sin backend.
  if(USE_MOCK || !APPS_SCRIPT_URL){ return { ok:true, mock:true, action, payload }; }
  // Backend real pero sin token válido (sesión local/vencida): fallar CLARO, no fingir éxito.
  if(!token || token === "mock"){ return { ok:false, error:"Sesión local: vuelve a iniciar sesión (Salir → Ingresar)", action }; }
  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method:"POST",
      headers:{ "Content-Type":"text/plain;charset=utf-8" },
      body: JSON.stringify({ action, token, ...payload }),
    });
    const data = await res.json();
    // Token caducado/ inválido en el backend -> cerrar sesión y volver al login (no dejar atascado).
    if(data && data.ok === false && /sesi[oó]n inv|expirad/i.test(String(data.error||""))){
      try { localStorage.removeItem(SESION_KEY); } catch(e){}
      alert("Tu sesión expiró. Vuelve a iniciar sesión.");
      location.reload();
    }
    return data;
  } catch(e){ return { ok:false, error:String(e), action }; }
}
