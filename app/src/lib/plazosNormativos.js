// ===== Motor de PLAZOS NORMATIVOS + alarma de Silencio Administrativo Positivo (SAP) =====
// Base: Directiva de Reclamos — Res. OSINERGMIN 269-2014-OS/CD, art. 21.1.
// El SAP hace que el reclamo se dé por FUNDADO y la contratista asume el monto (penalidad 5.5).
//
// Este módulo es de SOLO LECTURA sobre `datos` (objeto datos[codigo+"|Etapa"]) y `tickets/exp`.
// No escribe nada — solo calcula relojes para mostrarlos (SalaExpediente) y para el KPI (App/Hoy).

// ----- feriados (Perú, nacionales + Inti Raymi Cusco) — fuente ÚNICA: lib/model.js (`esFeriado`),
// que a su vez se sincroniza con el backend (Dominio.publico() -> GET dominio, feriados 2026-2030)
// vía aplicarDominio(), con fallback local si la red falla. Antes este módulo mantenía su propia
// copia (FERIADOS_FIJOS_MMDD/FERIADOS_VARIABLES_ISO) idéntica a la de model.js — verificado
// 2026-07-09: mismas 15 fechas fijas MM-DD y mismas 6 fechas móviles ISO 2026-2028, sin
// divergencias. Se eliminó la copia; se delega en model.js para no mantener dos fuentes a mano.
import { esFeriado } from "./model.js";

function esHabil(d){
  const dow = d.getDay(); // 0=dom, 6=sáb
  if(dow===0 || dow===6) return false;
  if(esFeriado(d)) return false;
  return true;
}

// ----- parseo defensivo de fechas: acepta Date, ISO ("2026-04-20" / con hora), o "dd/mm/aaaa" (+ hora opcional)
export function parseFechaFlexible(v){
  if(v==null || v==="") return null;
  if(v instanceof Date) return isNaN(v) ? null : v;
  const s = String(v).trim();
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if(m) return new Date(+m[3], +m[2]-1, +m[1], +(m[4]||0), +(m[5]||0), +(m[6]||0));
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if(m) return new Date(+m[1], +m[2]-1, +m[3]);
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

function soloFecha(d){ return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }

// ----- export function sumaHabiles(fechaISO|Date, n): lun-vie sin feriados. n puede ser negativo (retrocede).
export function sumaHabiles(fechaISOoDate, n){
  const base = fechaISOoDate instanceof Date ? fechaISOoDate : parseFechaFlexible(fechaISOoDate);
  if(!base) return null;
  let d = soloFecha(base);
  const paso = n>=0 ? 1 : -1;
  let restante = Math.abs(n);
  while(restante>0){
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate()+paso);
    if(esHabil(d)) restante--;
  }
  return d;
}

// ----- export function diasHabilesEntre(a, b): cantidad de días hábiles ENTRE a y b (b - a),
// positivo si b es posterior a a, negativo si b es anterior (cuenta días hábiles estrictamente
// intermedios recorridos, sin contar el propio día `a`). Sirve para "cuántos d.h. de exceso".
export function diasHabilesEntre(a, b){
  const da = a instanceof Date ? a : parseFechaFlexible(a);
  const db = b instanceof Date ? b : parseFechaFlexible(b);
  if(!da || !db) return null;
  let x = soloFecha(da), y = soloFecha(db);
  if(x.getTime()===y.getTime()) return 0;
  const signo = y>x ? 1 : -1;
  let cur = x, n = 0;
  while(cur.getTime()!==y.getTime()){
    cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate()+signo);
    if(esHabil(cur)) n += signo;
  }
  return n;
}

// días hábiles restantes HOY -> límite (positivo = faltan, negativo = vencido hace |n| d.h.)
function restantesHastaHoy(limite, hoy=new Date()){
  if(!limite) return null;
  return diasHabilesEntre(soloFecha(hoy), soloFecha(limite));
}

function estadoPorRestantes(restantes){
  if(restantes==null) return "no_aplica";
  if(restantes<0) return "vencido";
  if(restantes<=2) return "por_vencer";
  return "ok";
}

// Busca el valor de un campo en el objeto de datos de una etapa, probando varias claves
// posibles (defensivo: los nombres de campo evolucionan — ver camposEtapa.js).
function campo(datosEtapa, ...claves){
  if(!datosEtapa) return null;
  for(const k of claves){
    const v = datosEtapa[k];
    if(v!=null && v!=="") return v;
  }
  return null;
}
function fechaCampo(datosEtapa, ...claves){
  const v = campo(datosEtapa, ...claves);
  return v ? parseFechaFlexible(v) : null;
}

// ===== los relojes del caso =====
// exp: el reclamo (modelo App.jsx / model.js) — usa exp.codigo, exp.fechaAdm, exp.fechaLim
// datos: objeto completo { [codigo+"|Etapa"]: {campos} } — TODOS los casos (se filtra adentro)
// tickets: todos los tickets (se filtra por exp.codigo) — para fallback de "cuándo se abrió Apelación"
export function relojesDelCaso({ exp, datos, tickets }){
  if(!exp) return [];
  const codigo = String(exp.codigo);
  const D = datos || {};
  const dEval   = D[codigo+"|Evaluación"];
  const dRes    = D[codigo+"|Resolución"];
  const dNotif  = D[codigo+"|Notificación"];
  const dApel   = D[codigo+"|Apelación (JARU)"];
  const hoy = new Date();
  const relojes = [];

  const propios = (tickets||[]).filter(t=>String(t.reclamo)===codigo);
  const tkApel = propios.find(t=>t.etapa==="Apelación (JARU)");

  // ---------- SUPUESTO 1: no resolver dentro del plazo (art. 21.1) ----------
  // Base: FechaLimiteAtencion del caso (SIELSE), o si no existe, admisión + 10/30 d.h.
  {
    let limite = parseFechaFlexible(exp.fechaLim) || null;
    let base = parseFechaFlexible(exp.fechaAdm) || fechaCampo(dEval, "FECHA_ADMISION_SIELSE");
    if(!limite && base){
      const plazoDias = campo(dEval, "PLAZO_DIAS");
      const n = plazoDias ? parseInt(plazoDias,10) : null;
      if(n===10 || n===30) limite = sumaHabiles(base, n);
    }
    // ¿ya está resuelto? si hay FECHA_EMISION_RES, este reloj deja de correr (cumplido).
    const resuelto = !!fechaCampo(dRes, "FECHA_EMISION_RES", "FECHA_RESOLUCION");
    if(!base && !limite){
      relojes.push({ id:"sap1", nombre:"SAP · resolver dentro del plazo (10/30 d.h.)", base:null, limite:null,
        estado:"no_aplica", dias:null, esSAP:true,
        nota:"Falta la fecha de admisión — llena FECHA_ADMISION_SIELSE en la etapa Evaluación (o el plazo 10/30 en PLAZO_DIAS)." });
    } else if(resuelto){
      relojes.push({ id:"sap1", nombre:"SAP · resolver dentro del plazo (10/30 d.h.)", base, limite,
        estado:"cumplido", dias:0, esSAP:true, nota:"Resuelto — resolución emitida antes del vencimiento." });
    } else {
      const restantes = restantesHastaHoy(limite, hoy);
      relojes.push({ id:"sap1", nombre:"SAP · resolver dentro del plazo (10/30 d.h.)", base, limite,
        estado: estadoPorRestantes(restantes), dias: restantes, esSAP:true,
        nota: restantes!=null && restantes<0
          ? "No se resolvió dentro del plazo — riesgo de silencio administrativo positivo (FUNDADO, penalidad 5.5)."
          : "Vence "+(limite?limite.toLocaleDateString("es-PE"):"—")+"." });
    }
  }

  // ---------- SUPUESTO 3: reconsideración no resuelta en 10 d.h. ----------
  // Presentación: FECHA_RECONSIDERACION (dato aún no modelado en camposEtapa.js — se prueba
  // igual, defensivamente) o FECHA_APELACION como aproximación de "se presentó un recurso".
  {
    const presentacion = fechaCampo(dApel, "FECHA_RECONSIDERACION", "FECHA_APELACION");
    if(!presentacion){
      relojes.push({ id:"sap3", nombre:"SAP · reconsideración resuelta en 10 d.h.", base:null, limite:null,
        estado:"no_aplica", dias:null, esSAP:true,
        nota:"No hay recurso de reconsideración presentado — o falta FECHA_RECONSIDERACION en la etapa Apelación (JARU)." });
    } else {
      const limite = sumaHabiles(presentacion, 10);
      // resuelta si existe un registro POSTERIOR de resolución (FECHA_EMISION_RES > presentación)
      const fechaResPosterior = fechaCampo(dRes, "FECHA_EMISION_RES", "FECHA_RESOLUCION");
      const resuelta = fechaResPosterior && fechaResPosterior >= presentacion;
      if(resuelta){
        relojes.push({ id:"sap3", nombre:"SAP · reconsideración resuelta en 10 d.h.", base:presentacion, limite,
          estado:"cumplido", dias:0, esSAP:true, nota:"Reconsideración resuelta." });
      } else {
        const restantes = restantesHastaHoy(limite, hoy);
        relojes.push({ id:"sap3", nombre:"SAP · reconsideración resuelta en 10 d.h.", base:presentacion, limite,
          estado: estadoPorRestantes(restantes), dias: restantes, esSAP:true,
          nota: restantes!=null && restantes<0
            ? "Reconsideración sin resolver dentro de 10 d.h. — riesgo de silencio positivo (penalidad 5.5)."
            : "Registra FECHA_EMISION_RES en Resolución apenas se resuelva, para cerrar este reloj." });
      }
    }
  }

  // ---------- SUPUESTO 4: resolución emitida y NO notificada en 5 d.h. → INEFICAZ ----------
  {
    const emision = fechaCampo(dRes, "FECHA_EMISION_RES", "FECHA_RESOLUCION");
    if(!emision){
      relojes.push({ id:"sap4", nombre:"SAP · notificar la resolución en 5 d.h.", base:null, limite:null,
        estado:"no_aplica", dias:null, esSAP:true,
        nota:"Aún no hay resolución emitida — llena FECHA_EMISION_RES en la etapa Resolución." });
    } else {
      const limite = sumaHabiles(emision, 5);
      const fNotifCliente = fechaCampo(dNotif, "FECHA_RECEPCION_CLIENTE");
      const fNotifNotarial = fechaCampo(dNotif, "FECHA_NOTIFICACION_NOTARIAL");
      const fNotif = [fNotifCliente, fNotifNotarial].filter(Boolean).sort((a,b)=>a-b)[0] || null;
      if(fNotif){
        const aTiempo = fNotif <= limite;
        relojes.push({ id:"sap4", nombre:"SAP · notificar la resolución en 5 d.h.", base:emision, limite,
          estado: aTiempo ? "cumplido" : "vencido", dias: aTiempo?0:(diasHabilesEntre(limite, fNotif)||0), esSAP:true,
          nota: aTiempo ? "Notificada dentro del plazo." : "Notificada FUERA de plazo — la resolución es INEFICAZ (penalidad 5.5/5.12)." });
      } else {
        const restantes = restantesHastaHoy(limite, hoy);
        relojes.push({ id:"sap4", nombre:"SAP · notificar la resolución en 5 d.h.", base:emision, limite,
          estado: estadoPorRestantes(restantes), dias: restantes, esSAP:true,
          nota: restantes!=null && restantes<0
            ? "Resolución emitida y NO notificada en 5 d.h. — la resolución es INEFICAZ y hay riesgo de silencio positivo (penalidad 5.5)."
            : "Registra FECHA_RECEPCION_CLIENTE o FECHA_NOTIFICACION_NOTARIAL en Notificación apenas se logre." });
      }
    }
  }

  // ---------- OTRO RELOJ (no SAP): elevación de apelación ≤5 d.h. — penalidad 5.10 ----------
  {
    const presentacionRecurso = fechaCampo(dApel, "FECHA_PRESENTACION_RECURSO", "FECHA_APELACION")
      || (tkApel && tkApel.fechaInicio ? parseFechaFlexible(tkApel.fechaInicio) : null);
    if(!presentacionRecurso){
      relojes.push({ id:"elevacion", nombre:"Elevación de apelación ≤5 d.h. (pen. 5.10)", base:null, limite:null,
        estado:"no_aplica", dias:null, esSAP:false,
        nota:"Sin apelación en curso — o falta FECHA_PRESENTACION_RECURSO/FECHA_APELACION en la etapa Apelación (JARU)." });
    } else {
      const limite = sumaHabiles(presentacionRecurso, 5);
      const fElevacion = fechaCampo(dApel, "FECHA_ELEVACION");
      if(fElevacion){
        const aTiempo = fElevacion <= limite;
        relojes.push({ id:"elevacion", nombre:"Elevación de apelación ≤5 d.h. (pen. 5.10)", base:presentacionRecurso, limite,
          estado: aTiempo ? "cumplido" : "vencido", dias: aTiempo?0:(diasHabilesEntre(limite, fElevacion)||0), esSAP:false,
          nota: aTiempo ? "Elevada dentro del plazo." : "Elevada fuera de plazo — penalidad 5.10 (S/300 + monto)." });
      } else {
        const restantes = restantesHastaHoy(limite, hoy);
        relojes.push({ id:"elevacion", nombre:"Elevación de apelación ≤5 d.h. (pen. 5.10)", base:presentacionRecurso, limite,
          estado: estadoPorRestantes(restantes), dias: restantes, esSAP:false,
          nota: restantes!=null && restantes<0
            ? "No se elevó a JARU dentro de 5 d.h. — penalidad 5.10 (S/300 + monto)."
            : "Registra FECHA_ELEVACION en Apelación (JARU) apenas se eleve el expediente." });
      }
    }
  }

  return relojes;
}

// ===== KPI global: riesgo de silencio administrativo positivo en toda la cartera =====
// casos: array de reclamos (modelo App.jsx). datos/tickets: los mismos objetos completos.
export function riesgoSAPGlobal(casos, datos, tickets){
  const out = { total:0, casos:[] };
  (casos||[]).forEach(exp=>{
    const relojes = relojesDelCaso({ exp, datos, tickets });
    const criticos = relojes.filter(r=>r.esSAP && (r.estado==="vencido" || r.estado==="por_vencer"));
    if(criticos.length){
      out.total += criticos.filter(r=>r.estado==="vencido").length;
      out.casos.push({ codigo: exp.codigo, osinerg: exp.osinerg, relojes: criticos });
    }
  });
  return out;
}
