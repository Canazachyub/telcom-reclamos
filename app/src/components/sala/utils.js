import { toast } from "../ui.jsx";
import { CAMPOS_ETAPA, CAMPOS_POR_FALLO } from "../../lib/camposEtapa.js";

// Helpers puros de la Sala del expediente (SalaExpediente.jsx). Extraído tal cual.

export const ICONO_ETAPA = { "Recepción":"📥","Evaluación":"🔍","Campo":"🚙","SIELSE":"💻","Resolución":"⚖️","Firmas":"✍️","Notificación":"📨","Apelación (JARU)":"🏛️","Foliado":"📚","Cierre":"✅" };
export const iniciales = n => (n||"").split(" ").map(s=>s[0]).slice(0,2).join("").toUpperCase();

export function copiar(txt, etiqueta){
  try{ navigator.clipboard.writeText(String(txt)); toast("Copiado: "+etiqueta); }catch(e){ toast("No se pudo copiar"); }
}

// fecha ISO/Date -> "05/07 13:52" (hora local, legible) — la usa también el Drawer (bitácora)
export function fmtCuando(v){
  const d = new Date(v);
  if(isNaN(d)) return String(v||"").slice(0,16);
  const p = n => ("0"+n).slice(-2);
  return p(d.getDate())+"/"+p(d.getMonth()+1)+" "+p(d.getHours())+":"+p(d.getMinutes());
}

// registro crudo de la bitácora -> frase humana (nada de JSON en pantalla) — exportado para el Drawer
export function humanizarRegistro(r){ return humanizar(r); }
export function humanizar(r){
  const raw = typeof r.detalle==="string" ? r.detalle : "";
  let d={}; try{ const j=JSON.parse(raw); if(j && typeof j==="object") d=j; }catch(e){}
  const txt = raw && raw.charAt(0)!=="{" ? raw : "";
  const t = String(r.tipo||"");
  const limpiaEt = e => String(e||"").replace(/^\d+_/,"");
  if(t==="datos"){ const ks=Object.keys(d.campos||{}); return "registró datos de "+(d.etapa||"la etapa")+(ks.length?" — "+ks.slice(0,4).join(", ")+(ks.length>4?"…":""):""); }
  if(t==="evidencia") return "subió "+(d.nombre||"un documento")+(d.etapa?" a "+limpiaEt(d.etapa):"");
  if(t==="nuevo_caso") return "creó el expediente"+(d.solicitante?" — "+d.solicitante:"");
  if(t==="delegacion") return "reasignó el caso a "+(d.a||"otro responsable");
  if(t==="estado") return "cambió el estado a "+(txt||d.estado||"—");
  if(t==="etapa") return "movió la etapa a "+(txt||"—");
  if(t==="ticket") return "actualizó la etapa"+(d.estado?" → "+(d.estado==="hecho"?"terminada ✓":String(d.estado).replace("_"," ")):"");
  if(t==="edicion") return "editó "+(d.campo||"un campo")+(d.valor!=null?" → "+String(d.valor).slice(0,40):"");
  if(t==="expediente") return "generó el expediente foliado";
  if(t==="eliminacion") return "🗑 ELIMINÓ el expediente — motivo: "+(d.motivo||"—");
  if(t==="sync_cambio") return "📤 SIELSE actualizó: "+((d.campos||[]).join(", ")||"campos del caso");
  if(t==="sync_nuevo") return "📥 llegó desde SIELSE (sync diario)"+(d.solicitante?" — "+d.solicitante:"");
  if(t==="reporte") return "cerró su reporte del día";
  return (txt||JSON.stringify(d)).slice(0,110);
}

// etiqueta bonita de cada campo registrado (clave técnica → label del formulario)
export const LBL_CAMPO = (()=>{ const m={};
  Object.values(CAMPOS_ETAPA||{}).forEach(s=>(s?.campos||[]).forEach(c=>{ m[c.k]=c.label; }));
  Object.values(CAMPOS_POR_FALLO||{}).forEach(arr=>(arr||[]).forEach(c=>{ m[c.k]=c.label; }));
  return m; })();
