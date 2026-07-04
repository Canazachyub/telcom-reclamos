// ===== Capa de acceso a datos =====
import { mapReclamo } from "./model.js";

export const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycby873l5XjLOfkrjwl7R0E-lqN7FcWzwVruQOM9T0W8FU7lP_mz6nkKkcI3CcKdry8im/exec";
export const USE_MOCK = false;            // false = login y escrituras al backend real
const SESION_KEY = "sesion_reclamos";

function getToken(){ try { return JSON.parse(localStorage.getItem(SESION_KEY))?.token; } catch { return null; } }

// Lectura de reclamos EN VIVO desde el Sheet (fuente de verdad). El JSON local queda
// solo como respaldo si la API no responde (sin red / CORS).
export async function loadReclamos(){
  try{
    const res = await fetch(APPS_SCRIPT_URL + "?action=reclamos");
    const raw = await res.json();
    if(Array.isArray(raw)) return raw.map(mapReclamo);   // [] válido = cartera en blanco
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

// Lee las evidencias reales desde la hoja `registros` (tipo=evidencia).
export async function loadEvidencias(){
  if(!APPS_SCRIPT_URL) return [];
  try{
    const res = await fetch(APPS_SCRIPT_URL + "?action=registros");
    const rows = await res.json();
    if(!Array.isArray(rows)) return [];
    const mapped = rows.filter(r => r.tipo === "evidencia").map(r => {
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
    // mismo expediente comparten la misma url no vacía, son el mismo documento (colapsa a 1,
    // deja la última versión aunque difiera nombre/etapa por corridas de simulación repetidas).
    const seenUrl = new Set(), out = [];
    for(let i = pass1.length-1; i>=0; i--){
      const e = pass1[i];
      if(e.url){
        const ku = e.exp+"|"+e.url;
        if(seenUrl.has(ku)) continue; seenUrl.add(ku);
      }
      out.unshift(e);
    }
    return out;
  }catch(e){ return []; }
}

// ===== TICKETS (esquema v2) =====
// Lee los tickets reales del backend (hoja tickets). Devuelve [] si no hay backend/CORS.
export async function loadTickets(){
  if(!APPS_SCRIPT_URL) return [];
  try{
    const res = await fetch(APPS_SCRIPT_URL + "?action=tickets");
    const rows = await res.json();
    return Array.isArray(rows) ? rows : [];
  }catch(e){ return []; }
}

// Lee el calendario (vencimientos + hitos). Si el backend no lo trae, el front lo deriva de tickets.
export async function loadCalendario(){
  if(!APPS_SCRIPT_URL) return [];
  try{
    const res = await fetch(APPS_SCRIPT_URL + "?action=calendario");
    const rows = await res.json();
    return Array.isArray(rows) ? rows : [];
  }catch(e){ return []; }
}

// Cambia el estado de un ticket y/o reasigna responsable (solo Coordinador/Gerente) — con token.
export async function updTicket(ticket_id, estado, reclamo, responsable_id, responsable){
  return postAction("upd_ticket", { ticket_id, estado, reclamo, responsable_id, responsable });
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
export async function loadRegistros(){
  if(!APPS_SCRIPT_URL) return [];
  try{
    const res = await fetch(APPS_SCRIPT_URL + "?action=registros");
    const rows = await res.json();
    return Array.isArray(rows) ? rows : [];
  }catch(e){ return []; }
}

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
export async function loadDatos(){
  if(!APPS_SCRIPT_URL) return {};
  try{
    const res = await fetch(APPS_SCRIPT_URL + "?action=registros");
    const rows = await res.json();
    if(!Array.isArray(rows)) return {};
    const map = {};
    rows.filter(r => r.tipo === "datos").forEach(r => {
      let d = {}; try { d = typeof r.detalle === "string" ? JSON.parse(r.detalle) : (r.detalle||{}); } catch(e){}
      if(!d.etapa) return;
      const k = String(r.reclamo) + "|" + d.etapa;
      map[k] = { ...(map[k]||{}), ...(d.campos||{}) };   // última versión gana
    });
    return map;
  }catch(e){ return {}; }
}

// Guarda los datos de una etapa (van a registros, tipo=datos) y prellenan los Word después.
export async function guardarDatos({ exp, etapa, rol, campos }){
  return postAction("guardar_datos", { reclamo: exp, etapa, rol, campos });
}

// Observaciones/comentarios del expediente (registros tipo=comentario). Cualquier rol puede añadir.
export async function loadComentarios(){
  if(!APPS_SCRIPT_URL) return [];
  try{
    const res = await fetch(APPS_SCRIPT_URL + "?action=registros");
    const rows = await res.json();
    if(!Array.isArray(rows)) return [];
    return rows.filter(r => r.tipo === "comentario").map(r => {
      let d = {}; try { d = typeof r.detalle === "string" ? JSON.parse(r.detalle) : (r.detalle||{}); } catch(e){}
      return { reclamo:String(r.reclamo), etapa:d.etapa||"", texto:d.texto||"", rol:d.rol||"", nombre:d.nombre||r.usuario, usuario:r.usuario, fecha:String(r.fecha||"").slice(0,16).replace("T"," ") };
    });
  }catch(e){ return []; }
}
export async function comentar({ reclamo, etapa, texto, nombre }){
  return postAction("comentar", { reclamo, etapa, texto, nombre });
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
