// Autenticación. MOCK local (PIN provisional) ; real = Apps Script login().
import { USE_MOCK, APPS_SCRIPT_URL } from "./api.js";

// Espejo de la hoja `usuarios` (resp_id = teamId del modelo). PIN demo: 2026
export const USERS = [
  { usuario:"jcanaza",   nombre:"Jael Canaza",      rol:"GERENTE",         resp_id:0, pin:"2026" },
  { usuario:"aaraujo",   nombre:"Andre Araujo",     rol:"COORDINADOR",     resp_id:1, pin:"2026" },
  { usuario:"dmarroquin",nombre:"Diego Marroquín",  rol:"ANALISTA_LEGAL",  resp_id:2, pin:"2026" },
  { usuario:"jvargas",   nombre:"Juan Vargas",      rol:"ANALISTA_LEGAL",  resp_id:3, pin:"2026" },
  { usuario:"amontufar", nombre:"Alvaro Montufar",  rol:"ANALISTA_JUNIOR", resp_id:4, pin:"2026" },
  { usuario:"mleon",     nombre:"Milagros León",    rol:"ASISTENTE",       resp_id:5, pin:"2026" },
  { usuario:"jcondori",  nombre:"Jocabed Condori",  rol:"TRAMITADOR",      resp_id:6, pin:"2026" },
  { usuario:"aramos",    nombre:"Anais Ramos",      rol:"TRAMITADOR",      resp_id:7, pin:"2026" },
  { usuario:"mhurtado",  nombre:"Marilyn Hurtado",  rol:"TRAMITADOR",      resp_id:8, pin:"2026" },
];

export const ROL_LABEL = {
  GERENTE:"Gerencia", COORDINADOR:"Coordinador General", ANALISTA_LEGAL:"Analista Legal",
  ANALISTA_JUNIOR:"Analista Junior", ASISTENTE:"Asistente Administrativo", TRAMITADOR:"Tramitador / Digitador",
};

const KEY = "sesion_reclamos";
export function getSesion(){ try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } }
export function logout(){ localStorage.removeItem(KEY); }

// Sesión válida para ESCRIBIR/usar IA contra el backend real.
// Una sesión "mock" vieja (creada antes de sembrar usuarios, o sin red) no sirve para el backend:
// la descartamos para forzar un re-login real y evitar que las escrituras/IA fallen en silencio.
export function getSesionValida(){
  const s = getSesion();
  if(!s) return null;
  if(!USE_MOCK && s.token === "mock"){ logout(); return null; }
  return s;
}

function loginLocal(usuario, pin){
  const u = USERS.find(x=>x.usuario===usuario.trim().toLowerCase());
  if(!u) return { ok:false, error:"Usuario no encontrado" };
  if(u.pin !== String(pin).trim()) return { ok:false, error:"PIN incorrecto" };
  const perfil = { usuario:u.usuario, nombre:u.nombre, rol:u.rol, resp_id:u.resp_id, token:"mock" };
  localStorage.setItem(KEY, JSON.stringify(perfil));
  return { ok:true, perfil };
}

export async function login(usuario, pin){
  // 1) intentar backend real
  if(!USE_MOCK && APPS_SCRIPT_URL){
    try{
      const res = await fetch(APPS_SCRIPT_URL, { method:"POST", headers:{"Content-Type":"text/plain;charset=utf-8"}, body:JSON.stringify({ action:"login", usuario:usuario.trim().toLowerCase(), pin }) });
      const data = await res.json();
      if(data.ok){ localStorage.setItem(KEY, JSON.stringify({ ...data.perfil, token:data.token })); return data; }
      // El backend respondió y RECHAZÓ (PIN/usuario): mostrar el error real, NO entrar como mock
      // (un token mock rompería las escrituras y la IA en silencio).
      return data;
    }catch(e){ /* CORS/red caída -> respaldo local de demo */ }
  }
  // 2) respaldo local (demo / setup en curso)
  return loginLocal(usuario, pin);
}

// permisos
export const puedeVerTodo = rol => rol==="GERENTE" || rol==="COORDINADOR";
export const puedeDelegar = rol => rol==="COORDINADOR";
export const esGerente    = rol => rol==="GERENTE";
export const esOperativo  = rol => ["ANALISTA_LEGAL","ANALISTA_JUNIOR","ASISTENTE","TRAMITADOR"].includes(rol);
