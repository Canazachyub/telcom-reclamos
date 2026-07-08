import { useState, useMemo, useEffect } from "react";
import { ETAPAS, FLUJO, fmtFecha, wColor, TEAM, puedeTomar, teamById } from "../lib/model.js";
import { toast } from "./ui.jsx";
import { GuiaSielseBox } from "../lib/guiaSielse.jsx";
import { CAMPOS_ETAPA, CAMPOS_POR_FALLO } from "../lib/camposEtapa.js";
import FichaSielse from "./FichaSielse.jsx";
import { relojesDelCaso } from "../lib/plazosNormativos.js";
import { CUADERNOS, valCuaderno } from "../lib/cuadernosDef.js";
import { loadCuadernosPorCaso } from "../lib/api.js";
import { qrDataURL, descargarQR, imprimirQRs } from "../lib/qr.js";

// def de cuaderno por su `fuente` (tipo de registros_control) — para nombres/columnas
const CUAD_POR_FUENTE = {}; CUADERNOS.forEach(c => { CUAD_POR_FUENTE[c.fuente] = c; });

// ===================== Sala del expediente (v4, patrón courier) =====================
// Vista de SEGUIMIENTO y colaboración de un caso: dónde está, quién lo tiene, cuánto plazo
// queda, sus documentos y todo lo que el equipo hizo. NO reemplaza al Drawer: el botón
// "Trabajar esta etapa" abre el Drawer de siempre (la Sala es para VER, el Drawer para HACER).

const ICONO_ETAPA = { "Recepción":"📥","Evaluación":"🔍","Campo":"🚙","SIELSE":"💻","Resolución":"⚖️","Firmas":"✍️","Notificación":"📨","Apelación (JARU)":"🏛️","Foliado":"📚","Cierre":"✅" };
const iniciales = n => (n||"").split(" ").map(s=>s[0]).slice(0,2).join("").toUpperCase();

function copiar(txt, etiqueta){
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
function humanizar(r){
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
const LBL_CAMPO = (()=>{ const m={};
  Object.values(CAMPOS_ETAPA||{}).forEach(s=>(s?.campos||[]).forEach(c=>{ m[c.k]=c.label; }));
  Object.values(CAMPOS_POR_FALLO||{}).forEach(arr=>(arr||[]).forEach(c=>{ m[c.k]=c.label; }));
  return m; })();

// ===================== ⚖ Relojes normativos → mini-calendario interactivo =====================
// Pedido del gerente: "como un calendario de muestra con botones en las fechas calculadas; al
// seleccionar, cuadros llamativos al costado explican qué es o qué está pasando". Motor de datos
// intacto (relojesDelCaso, lib/plazosNormativos.js) — esto es SOLO presentación.

const DOW_REL = ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"];
const MESES_REL = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
const isoDia = d => d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const hoyISO_REL = isoDia(new Date());

// normaliza reloj.base / reloj.limite (Date u ISO) -> "yyyy-mm-dd" (o null)
function isoDeFecha(v){
  if(v==null || v==="") return null;
  const d = v instanceof Date ? v : new Date(v);
  return isNaN(d) ? null : isoDia(d);
}

// reloj.base/reloj.limite vienen como Date (motor puro) — fmtFecha (model.js) solo parsea
// strings "dd/mm/aaaa", así que para estos dos campos formateamos aparte (dd/mm/aaaa, es-PE).
function fmtFechaReloj(v){
  if(v==null || v==="") return "—";
  const d = v instanceof Date ? v : new Date(v);
  return isNaN(d) ? String(v) : d.toLocaleDateString("es-PE");
}

// peor estado entre varios relojes del mismo día (para pintar el botón del día)
const RANGO_ESTADO = { vencido:4, por_vencer:3, ok:2, cumplido:1, no_aplica:0 };
function peorEstado(lista){
  return lista.reduce((peor,r)=> RANGO_ESTADO[r.estado] > RANGO_ESTADO[peor] ? r.estado : peor, "no_aplica");
}

const ESTADO_INFO = {
  vencido:     { pillBg:"#FDE7E7", pillCl:"#DC2626", txt:"vencido" },
  por_vencer:  { pillBg:"#FEF3DF", pillCl:"#B45309", txt:"por vencer" },
  ok:          { pillBg:"#E5F7EC", pillCl:"#15803D", txt:"en plazo" },
  cumplido:    { pillBg:"#EDF2F8", pillCl:"var(--mut)", txt:"cumplido ✓" },
  no_aplica:   { pillBg:"#EDF2F8", pillCl:"var(--mut)", txt:"no aplica" },
};

// jerarquía para preseleccionar el reloj/día más urgente: vencido+SAP > vencido > por_vencer (más próximo) > resto
function urgenciaReloj(r){
  if(r.estado==="vencido" && r.esSAP) return 0;
  if(r.estado==="vencido") return 1;
  if(r.estado==="por_vencer" && r.esSAP) return 2;
  if(r.estado==="por_vencer") return 3;
  if(r.estado==="ok") return 4;
  if(r.estado==="cumplido") return 5;
  return 6;
}

function CalendarioRelojes({ relojes, ladoALado }){
  // días con reloj (agrupados por fecha yyyy-mm-dd), solo los que tienen límite calculado
  const porDia = useMemo(()=>{
    const m = {};
    (relojes||[]).forEach(r=>{
      const k = isoDeFecha(r.limite);
      if(!k) return;
      (m[k] = m[k] || []).push(r);
    });
    return m;
  }, [relojes]);

  // reloj/día más urgente (para preseleccionar) — solo entre los que SÍ tienen fecha
  const relojesConFecha = (relojes||[]).filter(r=>isoDeFecha(r.limite));
  const masUrgente = relojesConFecha.slice().sort((a,b)=>urgenciaReloj(a)-urgenciaReloj(b))[0] || null;
  const diaUrgenteISO = masUrgente ? isoDeFecha(masUrgente.limite) : null;

  // mes inicial: el del límite pendiente más próximo (vencido u por_vencer), si no el mes actual
  const mesInicial = useMemo(()=>{
    if(diaUrgenteISO){ const d=new Date(diaUrgenteISO); return new Date(d.getFullYear(), d.getMonth(), 1); }
    return new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  }, [diaUrgenteISO]);

  const [mes, setMes] = useState(mesInicial);
  const [diaSel, setDiaSel] = useState(diaUrgenteISO);

  const y = mes.getFullYear(), m = mes.getMonth();
  const primero = new Date(y, m, 1);
  const offset = (primero.getDay()+6)%7; // lunes=0
  const nDias = new Date(y, m+1, 0).getDate();
  const celdas = [];
  for(let i=0;i<offset;i++) celdas.push(null);
  for(let d=1; d<=nDias; d++) celdas.push(new Date(y,m,d));

  // días "base" (inicio de cómputo) — solo puntito sutil, no botón
  const basesPorDia = {};
  (relojes||[]).forEach(r=>{ const k=isoDeFecha(r.base); if(k) basesPorDia[k]=true; });

  const relojesDia = diaSel ? (porDia[diaSel]||[]) : [];

  function elegirDia(k){
    setDiaSel(sel => sel===k ? null : k);
  }

  // resumen de una línea
  const nTot = (relojes||[]).length;
  const nVencidos = (relojes||[]).filter(r=>r.estado==="vencido").length;
  const nPorVencer = (relojes||[]).filter(r=>r.estado==="por_vencer").length;
  const nResto = nTot - nVencidos - nPorVencer;

  const apilado = ladoALado;

  const CS = {
    wrap:{ display:"flex", flexDirection: apilado ? "column" : "row", gap:14, marginTop:6, flexWrap:"wrap" },
    colCal:{ flex: apilado ? "1 1 100%" : "1 1 55%", minWidth:260 },
    colTarjeta:{ flex: apilado ? "1 1 100%" : "1 1 45%", minWidth:230 },
    navFila:{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 },
    mesTit:{ minWidth:120, textAlign:"center", fontSize:12.5, fontWeight:700, color:"var(--titulo)", textTransform:"capitalize" },
    navBtn:{ background:"var(--card2)", border:"1px solid var(--bd)", color:"var(--tx)", borderRadius:7, fontSize:12, padding:"3px 9px", cursor:"pointer", fontFamily:"inherit" },
    grid:{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:3 },
    dow:{ textAlign:"center", fontSize:9.5, color:"var(--mut)", fontWeight:700, padding:"1px 0" },
    celdaBase:{ minHeight:30, minWidth:30, borderRadius:7, display:"flex", alignItems:"center", justifyContent:"center",
      position:"relative", fontSize:11, fontFamily:"inherit", transition:"transform .12s ease, box-shadow .12s ease" },
    resumen:{ marginTop:10, fontSize:11.5, color:"var(--tx)", background:"var(--card2)", border:"1px solid var(--bd)", borderRadius:9, padding:"7px 11px" },
    tarjeta:{ background:"var(--card2)", border:"1px solid var(--bd)", borderRadius:12, padding:"11px 12px", height:"100%" },
    cuadro:(cl)=>({ background:"#fff", border:"1px solid var(--bd)", borderLeft:"4px solid "+cl, borderRadius:10, padding:"9px 11px", marginBottom:9 }),
    cuadroCab:{ display:"flex", alignItems:"center", gap:7, flexWrap:"wrap", marginBottom:5 },
    pill:(bg,cl)=>({ fontSize:10, fontWeight:700, padding:"2px 9px", borderRadius:999, background:bg, color:cl, marginLeft:"auto" }),
    linea:{ fontSize:11.5, color:"var(--tx)", margin:"2px 0" },
    franjaSAP:(estado)=>({ marginTop:7, fontSize:11, fontWeight:700, borderRadius:8, padding:"6px 9px",
      background: estado==="vencido" ? "#FDE7E7" : "#FEF3DF", color: estado==="vencido" ? "#B91C1C" : "#B45309" }),
  };

  return (
    <div>
      <div style={CS.wrap}>
        {/* ===== columna calendario (55%) ===== */}
        <div style={CS.colCal}>
          <div style={CS.navFila}>
            <button type="button" style={CS.navBtn} onClick={()=>setMes(new Date(y, m-1, 1))} aria-label="Mes anterior">‹</button>
            <span style={CS.mesTit}>{MESES_REL[m]} {y}</span>
            <button type="button" style={CS.navBtn} onClick={()=>setMes(new Date(y, m+1, 1))} aria-label="Mes siguiente">›</button>
          </div>
          <div style={CS.grid}>
            {DOW_REL.map(d=><div key={d} style={CS.dow}>{d}</div>)}
            {celdas.map((d,i)=>{
              if(!d) return <div key={i}/>;
              const k = isoDia(d);
              const esHoy = k===hoyISO_REL;
              const lista = porDia[k];
              const esBase = basesPorDia[k];
              const sel = diaSel===k;
              let estilo = { ...CS.celdaBase, cursor: lista ? "pointer" : "default", color:"var(--tx)", background:"var(--card2)", border:"1px solid var(--bd)" };
              let contenido = d.getDate();
              let badge = null;
              if(lista && lista.length){
                const peor = peorEstado(lista);
                if(peor==="vencido"){
                  const esSAP = lista.some(r=>r.esSAP && r.estado==="vencido");
                  estilo = { ...estilo, background:"#E3001B", color:"#fff", border:"1px solid #E3001B", fontWeight:700 };
                  contenido = <>{esSAP ? "⚠" : ""}{d.getDate()}</>;
                } else if(peor==="por_vencer"){
                  estilo = { ...estilo, background:"#F59E0B", color:"#fff", border:"1px solid #F59E0B", fontWeight:700 };
                } else if(peor==="ok"){
                  estilo = { ...estilo, border:"2px solid #16A34A", fontWeight:700 };
                } else if(peor==="cumplido"){
                  // verde positivo: "esto YA lo cumplí" — informativo, no alarma
                  estilo = { ...estilo, background:"#E5F7EC", color:"#15803D", border:"1px solid #BFE5CB", fontWeight:700 };
                  contenido = <>{d.getDate()}<span style={{fontSize:9,marginLeft:1}}>✓</span></>;
                }
                if(lista.length>1){
                  badge = (
                    <span style={{ position:"absolute", top:-5, right:-5, minWidth:14, height:14, borderRadius:999,
                      background:"var(--navy)", color:"#fff", fontSize:8.5, fontWeight:700, display:"flex",
                      alignItems:"center", justifyContent:"center", padding:"0 2px", border:"1px solid #fff" }}>{lista.length}</span>
                  );
                }
              }
              if(esHoy) estilo = { ...estilo, boxShadow:"0 0 0 2px var(--navy)" };
              if(sel) estilo = { ...estilo, transform:"scale(1.08)", boxShadow:(estilo.boxShadow?estilo.boxShadow+", ":"")+"0 2px 6px rgba(22,41,75,.25)" };
              return (
                <button key={i} type="button" disabled={!lista}
                  onClick={()=>elegirDia(k)}
                  title={lista ? (lista.length+" reloj(es) vence(n) este día") : (esBase ? "inicio del cómputo" : undefined)}
                  style={{ ...estilo, appearance:"none" }}>
                  {contenido}
                  {!lista && esBase && <span title="inicio del cómputo" style={{ position:"absolute", bottom:2, width:4, height:4, borderRadius:"50%", background:"var(--navy)" }}/>}
                  {badge}
                </button>
              );
            })}
          </div>

          <div style={CS.resumen}>
            <b style={{color:"var(--titulo)"}}>{nTot}</b> reloj{nTot===1?"":"es"}: <span style={{color:"#DC2626",fontWeight:700}}>{nVencidos} vencido{nVencidos===1?"":"s"}</span> · <span style={{color:"#B45309",fontWeight:700}}>{nPorVencer} por vencer</span> · <span style={{color:"#15803D",fontWeight:700}}>{nResto} en plazo/cumplido{nResto===1?"":"s"}</span>
          </div>
        </div>

        {/* ===== columna tarjeta explicativa (45%) ===== */}
        <div style={CS.colTarjeta}>
          <div style={CS.tarjeta}>
            {!diaSel && (
              <>
                <div style={{fontSize:12.5,color:"var(--tx)",marginBottom:9}}>
                  👉 Toca una fecha marcada para ver qué vence ese día.
                </div>
                <div style={{display:"grid",gap:5,fontSize:11}}>
                  <div><span style={{display:"inline-block",width:10,height:10,borderRadius:3,background:"#E3001B",marginRight:6}}/>vencido</div>
                  <div><span style={{display:"inline-block",width:10,height:10,borderRadius:3,background:"#F59E0B",marginRight:6}}/>por vencer</div>
                  <div><span style={{display:"inline-block",width:10,height:10,borderRadius:3,border:"2px solid #16A34A",marginRight:6}}/>en plazo</div>
                  <div><span style={{display:"inline-block",width:10,height:10,borderRadius:3,background:"#E5F7EC",border:"1px solid #BFE5CB",marginRight:6}}/><span style={{color:"#15803D",fontWeight:700}}>cumplido ✓</span> — actividad ya realizada</div>
                  <div><span style={{display:"inline-block",width:6,height:6,borderRadius:"50%",background:"var(--navy)",marginRight:10}}/>inicio del cómputo (base)</div>
                </div>
              </>
            )}
            {diaSel && !relojesDia.length && (
              <div style={{fontSize:12,color:"var(--mut)"}}>Ese día no tiene relojes con vencimiento — es solo el inicio del cómputo de otro reloj.</div>
            )}
            {diaSel && relojesDia.map(r=>{
              const info = ESTADO_INFO[r.estado] || ESTADO_INFO.no_aplica;
              const icono = (r.esSAP && r.estado==="vencido") ? "🚨" : (r.esSAP ? "⚖" : "⏱");
              const franjaRiesgo = r.esSAP && (r.estado==="vencido" || r.estado==="por_vencer");
              return (
                <div key={r.id} style={CS.cuadro(info.pillCl)}>
                  <div style={CS.cuadroCab}>
                    <span style={{fontSize:15}}>{icono}</span>
                    <b style={{fontSize:12.5,color:"var(--titulo)"}}>{r.nombre}</b>
                    <span style={CS.pill(info.pillBg, info.pillCl)}>{info.txt}</span>
                  </div>
                  {r.estado==="no_aplica" ? (
                    <div style={{fontSize:11.5,color:"var(--mut)"}}>Se activará cuando se registre: {r.nota||"el dato faltante correspondiente."}</div>
                  ) : (
                    <>
                      <div style={CS.linea}><b>QUÉ ES:</b> {r.nota || "reloj normativo del expediente."}</div>
                      {r.base && <div style={CS.linea}><b>ARRANCÓ:</b> {fmtFechaReloj(r.base)}</div>}
                      {r.limite && <div style={CS.linea}><b>VENCE:</b> {fmtFechaReloj(r.limite)}</div>}
                      <div style={CS.linea}>
                        {r.estado==="cumplido"
                          ? "cumplido"+(r.limite?" el "+fmtFechaReloj(r.limite):"")
                          : (r.dias!=null && r.dias<0)
                            ? "venció hace "+Math.abs(r.dias)+" d háb."
                            : (r.dias!=null ? "faltan "+r.dias+" d háb." : "sin fecha calculada")}
                      </div>
                    </>
                  )}
                  {franjaRiesgo && (
                    <div style={CS.franjaSAP(r.estado)}>
                      ⚠ Si este reloj cae: el reclamo puede darse por FUNDADO — penalidad 5.5 (S/300 + el monto).
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SalaExpediente({ exp, tickets, evidencias, registros, comentarios, perfil, datos, correos, onComentar, onTrabajar, onClose, onEditar, onEstadoTicket, onReasignarTicket, onTomarTarea, onAbrirCuaderno, onEliminar, ladoALado }){
  const [texto, setTexto] = useState("");
  const [verFicha, setVerFicha] = useState(false);
  const [etapaSel, setEtapaSel] = useState(null);   // etapa clickeada en la línea de tiempo
  const [verTodaAct, setVerTodaAct] = useState(false); // feed comprimido (5) vs completo
  const [cuadRegs, setCuadRegs] = useState(null);   // registros de CUADERNOS de este caso (2ª fuente)
  const [qrImg, setQrImg] = useState("");           // PNG (data-URL) del QR del caso (por suministro)
  const puedeCorregir = ["GERENTE","COORDINADOR"].includes(perfil?.rol);

  // QR del caso (codifica ?sum=<suministro>) — para verlo/descargar/pegar en el libro físico
  useEffect(() => {
    let vivo = true; setQrImg("");
    if (exp.suministro) qrDataURL(exp.suministro, 220).then(u => { if (vivo) setQrImg(u); }).catch(() => {});
    return () => { vivo = false; };
  }, [exp.suministro]);

  // 2ª fuente: los registros de los cuadernos (Excel) que cruzan con ESTE expediente
  useEffect(() => {
    let vivo = true;
    setCuadRegs(null);
    loadCuadernosPorCaso(exp.codigo, exp.osinerg).then(r => { if (vivo) setCuadRegs(r || []); });
    return () => { vivo = false; };
  }, [exp.codigo, exp.osinerg]);

  // tickets del caso en orden de flujo; el ACTIVO es el primero no-hecho
  const propios = (tickets||[]).filter(t=>String(t.reclamo)===String(exp.codigo))
    .sort((a,b)=>ETAPAS.indexOf(a.etapa)-ETAPAS.indexOf(b.etapa));
  const idxAct = propios.findIndex(t=>!t.hecho);
  const act = idxAct>=0 ? propios[idxAct] : null;
  const sig = idxAct>=0 && idxAct+1<propios.length ? propios[idxAct+1] : null;
  const etapaActual = act ? act.etapa : (propios.length ? "Cierre" : exp.etapa);
  const flujoInfo = FLUJO.find(f=>f.etapa===etapaActual);
  const hechas = propios.filter(t=>t.hecho).length;
  const cerrado = propios.length>0 && hechas===propios.length;

  // plazo de la etapa activa
  const plazoPill = !act ? (cerrado
      ? { tx:"Expediente completado", bg:"#E5F7EC", cl:"#15803D" }
      : { tx:"Sin tickets aún (respaldo v1: "+(exp.etapa||"—")+")", bg:"#EDF2F8", cl:"var(--mut)" })
    : act.vencido
      ? { tx:"VENCIDO hace "+Math.abs(act.diasRestantes||0)+" d háb. — "+(act.fechaLimite?fmtFecha(act.fechaLimite):""), bg:"#FDE7E7", cl:"#DC2626" }
      : (act.diasRestantes!=null && act.diasRestantes<=2)
        ? { tx:"Vence en "+act.diasRestantes+" d háb. — "+(act.fechaLimite?fmtFecha(act.fechaLimite):""), bg:"#FEF3DF", cl:"#B45309" }
        : { tx: act.diasRestantes!=null ? ("Vence en "+act.diasRestantes+" d háb. — "+(act.fechaLimite?fmtFecha(act.fechaLimite):"")) : "Sin plazo registrado", bg:"#E5F7EC", cl:"#15803D" };

  // actividad: registros del caso + comentarios, lo más nuevo primero (append-only → invertimos).
  // Los registros tipo 'comentario' se excluyen: ya llegan por la prop comentarios (evita duplicados).
  const evRegs = (registros||[]).filter(r=>String(r.reclamo||"")===String(exp.codigo) && String(r.tipo)!=="comentario")
    .map(r=>({ quien:r.usuario||"—", que:humanizar(r), cuando:fmtCuando(r.fecha), etapa:r.etapa||"" }));
  const evComs = (comentarios||[]).filter(c=>String(c.reclamo||"")===String(exp.codigo))
    .map(c=>({ quien:c.nombre||c.usuario||"—", que:"💬 "+(c.texto||""), cuando:fmtCuando(c.fecha), etapa:c.etapa||"" }));
  const actividadTodo = [...evRegs.reverse(), ...evComs];
  const actividad = verTodaAct ? actividadTodo.slice(0,40) : actividadTodo.slice(0,5);

  // documentos del caso SIN repetidos (misma URL, o mismo nombre+etapa, = un solo chip)
  const docs = [];
  { const visto = {};
    (evidencias||[]).filter(e=>String(e.exp||"")===String(exp.codigo)).forEach(dd=>{
      const k = (dd.url||"") || ((dd.nombre||"")+"|"+(dd.etapa||""));
      if(visto[k]) return; visto[k]=1; docs.push(dd);
    }); }

  // correos vinculados a este caso — el campo real de vínculo es `reclamo_vinculado` (ver Bandeja.jsx)
  const correosDelCaso = (correos||[]).filter(c=>String(c.reclamo_vinculado||"")===String(exp.codigo));

  // ===== relojes normativos (SAP + elevación) — motor puro en lib/plazosNormativos.js =====
  const relojes = relojesDelCaso({ exp, datos, tickets });
  const haySAPVencido = relojes.some(r=>r.esSAP && r.estado==="vencido");

  function enviarComentario(){
    const t = texto.trim(); if(!t) return;
    onComentar && onComentar({ reclamo: exp.codigo, etapa: etapaActual, texto: t, nombre: perfil?.nombre });
    setTexto(""); toast("Comentario registrado ✓");
  }

  const S = {
    overlay:{ position:"fixed", inset:0, background:"rgba(22,41,75,.45)", zIndex:95, display:"flex", justifyContent: ladoALado ? "flex-start" : "center", alignItems:"flex-start", padding:"3vh 12px", overflowY:"auto" },
    panel:{ width: ladoALado ? "clamp(380px, calc(100vw - 760px), 640px)" : "min(1080px,100%)", background:"var(--bg)", border:"1px solid var(--bd)", borderRadius:16, padding:18, maxHeight:"94vh", overflowY:"auto", boxShadow:"0 24px 70px rgba(22,41,75,.28)" },
    head:{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:10, marginBottom:12 },
    hero:{ background:"var(--card)", border:"1px solid var(--bd)", borderRadius:16, padding:"18px 20px" },
    icono:{ width:52, height:52, borderRadius:13, background:"linear-gradient(135deg,#E3001B,#FF5A63)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, flexShrink:0 },
    estadoTit:{ margin:0, fontSize:23, color:"var(--titulo)", lineHeight:1.1 },
    pill:(p)=>({ display:"inline-block", fontSize:11.5, fontWeight:700, padding:"3px 11px", borderRadius:999, background:p.bg, color:p.cl, marginTop:8 }),
    tl:{ marginTop:20, overflowX:"auto", paddingBottom:4 },
    tlInner:{ display:"flex", minWidth:830 },
    hito:{ flex:1, position:"relative", textAlign:"center" },
    barra:(estado)=>({ position:"absolute", top:12, left:0, right:0, height:4, background: estado==="done" ? "#E3001B" : estado==="actual" ? "linear-gradient(90deg,#E3001B 0 50%,#E9EEF5 50%)" : "#E9EEF5" }),
    nodo:(estado, cond)=>({ position:"relative", zIndex:1, width:26, height:26, margin:"0 auto", borderRadius:"50%",
      background: estado==="done" ? "#E3001B" : estado==="actual" ? "#1E3A5F" : (cond ? "transparent" : "#E9EEF5"),
      border: "2px solid "+(estado==="done" ? "#E3001B" : estado==="actual" ? "#3C5B85" : "#D3DCE8"),
      borderStyle: cond && estado==="pend" ? "dashed" : "solid",
      display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700,
      color: estado==="done" || estado==="actual" ? "#fff" : "var(--mut2)",
      boxShadow: estado==="actual" ? "0 0 0 5px rgba(227,0,27,.18)" : "none" }),
    lb:(estado)=>({ fontSize:10.5, marginTop:6, lineHeight:1.25, color: estado==="actual" ? "var(--titulo)" : estado==="done" ? "#C50018" : "var(--mut)", fontWeight: estado==="actual" ? 700 : 400 }),
    fecha:{ fontSize:9.5, color:"var(--mut2)", marginTop:1 },
    resp:{ display:"flex", flexWrap:"wrap", alignItems:"center", gap:11, marginTop:16, background:"var(--card2)", border:"1px solid var(--bd)", borderRadius:12, padding:"10px 13px", fontSize:13 },
    ava:(c)=>({ width:29, height:29, borderRadius:"50%", background:c||"#1E5FAF", color:"#fff", display:"inline-flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, flexShrink:0 }),
    descargas:{ display:"flex", flexWrap:"wrap", gap:7, marginTop:13 },
    doc:{ display:"inline-flex", alignItems:"center", gap:6, border:"1px solid var(--bd)", borderRadius:999, padding:"5px 13px", fontSize:12, color:"var(--tx)", background:"var(--card2)", textDecoration:"none" },
    fichas:{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:11, marginTop:13 },
    ficha:{ background:"var(--card)", border:"1px solid var(--bd)", borderRadius:13, padding:13 },
    fTit:{ margin:"5px 0 7px", fontSize:12.5, color:"var(--titulo)", fontWeight:700 },
    fKv:{ fontSize:12, color:"var(--mut)", display:"grid", gap:3 },
    copy:{ float:"right", background:"transparent", border:"1px solid var(--bd)", color:"var(--mut)", borderRadius:7, fontSize:10.5, padding:"2px 8px", cursor:"pointer", fontFamily:"inherit" },
    feed:{ background:"var(--card)", border:"1px solid var(--bd)", borderRadius:16, padding:15, marginTop:13 },
    evento:{ display:"flex", gap:11, padding:"9px 2px", borderBottom:"1px solid #EDF1F6", fontSize:12.5 },
    correos:{ background:"var(--card)", border:"1px solid var(--bd)", borderRadius:16, padding:15, marginTop:13 },
    correoFila:{ display:"flex", alignItems:"flex-start", gap:9, padding:"8px 2px", borderBottom:"1px solid #EDF1F6" },
    correoAsunto:{ fontSize:12.5, fontWeight:700, color:"var(--titulo)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" },
    correoMeta:{ fontSize:11, color:"var(--mut)", marginTop:2 },
    relojesBox:{ background:"var(--card)", border:"1px solid var(--bd)", borderRadius:16, padding:15, marginTop:13 },
    relojBannerSAP:{ display:"flex", alignItems:"center", gap:8, background:"#FDE7E7", border:"1px solid #F3B4B4", color:"#B91C1C", borderRadius:10, padding:"9px 13px", marginBottom:11, fontSize:12.5, fontWeight:700 },
  };

  return (
    <div style={S.overlay} onClick={e=>{ if(ladoALado) return; if(e.target===e.currentTarget) onClose(); }}>
      <div style={S.panel}>
        <div style={S.head}>
          <div>
            <h2 style={{margin:0,fontSize:17,color:"var(--titulo)"}}>Sala del expediente</h2>
            <div className="muted" style={{fontSize:11.5}}>seguimiento y colaboración — para trabajar la etapa usa el botón rojo</div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button className="btn-ghost" onClick={()=>setVerFicha(true)} title="Ver el registro SIELSE completo del caso, lo trabajado por fase y sus documentos">📋 Ficha SIELSE</button>
            {perfil?.rol==="GERENTE" && onEliminar && (
              <button className="btn-ghost" style={{color:"#DC2626",borderColor:"#F3B4B4"}}
                title="Eliminar este expediente (solo Gerencia; motivo obligatorio; la bitácora conserva el rastro)"
                onClick={()=>{
                  if(!confirm("⚠ Vas a ELIMINAR el expediente "+(exp.osinerg||exp.codigo)+(exp.solicitante?" ("+exp.solicitante+")":"")+".\n\nSe borran el caso, sus etapas y su calendario. La bitácora y los archivos de Drive se conservan como respaldo.\n\n¿Continuar?")) return;
                  const motivo = prompt("Motivo de la eliminación (obligatorio — queda firmado en la bitácora):");
                  if(motivo==null) return;
                  if(!String(motivo).trim()){ toast("⛔ Sin motivo no se elimina"); return; }
                  onEliminar(exp.codigo, String(motivo).trim());
                }}>🗑 Eliminar</button>
            )}
            <button className="btn-ghost" onClick={onClose}>✕ Cerrar</button>
          </div>
        </div>

        {/* ===== hero de estado ===== */}
        <div style={S.hero}>
          <div style={{display:"flex",flexWrap:"wrap",gap:13,alignItems:"flex-start"}}>
            <div style={S.icono}>{ICONO_ETAPA[etapaActual]||"📄"}</div>
            <div style={{minWidth:200}}>
              <h3 style={S.estadoTit}>{cerrado ? "Expediente cerrado" : "En "+etapaActual}</h3>
              <div className="muted" style={{fontSize:12.5,marginTop:3}}>
                {flujoInfo ? (flujoInfo.rol+" · "+(flujoInfo.act||"")+(flujoInfo.plazo?" · plazo "+flujoInfo.plazo:"")) : "—"}
              </div>
              <span style={S.pill(plazoPill)}>{plazoPill.tx}</span>
            </div>
            <div style={{marginLeft:"auto",textAlign:"right",fontSize:12,color:"var(--mut)"}}>
              <div className="mono" style={{fontSize:14.5,fontWeight:800,color:"var(--titulo)"}}>{exp.osinerg||exp.codigo}</div>
              <div>Cód. <span className="mono">…{String(exp.codigo).slice(-8)}</span></div>
              {exp.fechaLim && <div>Límite global: {fmtFecha(exp.fechaLim)}</div>}
              {propios.length>0 && <div>Etapas hechas: <b style={{color:"var(--titulo)"}}>{hechas}/{propios.length}</b></div>}
            </div>
          </div>

          {/* ===== línea de tiempo: SIEMPRE las 10 etapas del flujo (espejo de SIELSE) =====
               Las que aún no tienen ticket se ven "fantasma": Apelación es condicional (solo si
               el usuario impugna) y Foliado/Cierre nacen al avanzar. Cada hito es CLICKEABLE:
               abre su detalle abajo, con corrección (reabrir/marcar hecha) para Coord./Gerencia. */}
          {propios.length>0 && (
            <div style={S.tl}><div style={{...S.tlInner, minWidth:980}}>
              {ETAPAS.map((et,i)=>{
                const t = propios.find(x=>x.etapa===et);
                const estado = t ? (t.hecho ? "done" : (act && act.etapa===et ? "actual" : "pend")) : "pend";
                const ghost = !t;
                const cond = et==="Apelación (JARU)";
                const sel = etapaSel===et;
                return (
                  <div key={et} style={{...S.hito, cursor:"pointer", opacity: ghost && !cond ? .55 : 1}}
                       onClick={()=>setEtapaSel(sel?null:et)}
                       title={ghost ? (cond?"Solo si el reclamante impugna":"Se crea al avanzar el flujo") : "Ver detalle de "+et}>
                    <div style={{...S.barra(estado), ...(i===0?{left:"50%"}:{}), ...(i===ETAPAS.length-1?{right:"50%"}:{})}}/>
                    <div style={{...S.nodo(estado, cond||ghost), ...(sel?{boxShadow:"0 0 0 4px rgba(30,58,95,.28)"}:{})}}>
                      {t && t.hecho ? "✓" : (cond && estado!=="actual" ? "·" : i+1)}
                    </div>
                    <div style={{...S.lb(estado), ...(sel?{fontWeight:700, color:"var(--titulo)"}:{})}}>
                      {et==="Apelación (JARU)" ? "Apelación" : et}{cond && !t ? <><br/>(si ocurre)</> : null}
                    </div>
                    <div style={S.fecha}>{estado==="actual" ? "en curso" : (t && t.hecho && t.fechaLimite ? "lím. "+fmtFecha(t.fechaLimite) : "")}</div>
                  </div>
                );
              })}
            </div></div>
          )}
          {propios.length>0 && !etapaSel && <div className="muted" style={{fontSize:11,marginTop:2}}>Toca cualquier etapa de la línea para ver su detalle{puedeCorregir?" o corregirla":""}.</div>}
          {!propios.length && <div className="muted" style={{marginTop:14,fontSize:12}}>Este caso aún no tiene flujo de etapas (v1). Ábrelo con "Trabajar esta etapa" para verlo en el detalle clásico.</div>}

          {/* ===== detalle de la etapa seleccionada (navegable + corregible) ===== */}
          {etapaSel && (()=>{
            const t = propios.find(x=>x.etapa===etapaSel);
            const fEt = FLUJO.find(f=>f.etapa===etapaSel);
            const nn = ("0"+(ETAPAS.indexOf(etapaSel)+1)).slice(-2)+"_";
            const docsEt = docs.filter(d=>String(d.etapa||"").indexOf(nn)===0 || String(d.etapa||"")===etapaSel);
            return (
              <div style={{marginTop:12, background:"var(--card2)", border:"1px solid var(--bd)", borderRadius:12, padding:"12px 14px"}}>
                <div style={{display:"flex",flexWrap:"wrap",alignItems:"center",gap:10}}>
                  <span style={{fontSize:16}}>{ICONO_ETAPA[etapaSel]||"📄"}</span>
                  <b style={{color:"var(--titulo)",fontSize:13.5}}>{etapaSel}</b>
                  {t ? (
                    <span style={{fontSize:11,fontWeight:700,padding:"2px 9px",borderRadius:999,
                      background: t.hecho?"#E5F7EC":(t.vencido?"#FDE7E7":"#FEF3DF"),
                      color: t.hecho?"#15803D":(t.vencido?"#DC2626":"#B45309")}}>
                      {t.hecho?"✓ CUMPLIDA":(t.vencido?"⚠ VENCIDA — pendiente":"en curso/pendiente")}
                    </span>
                  ) : <span className="muted" style={{fontSize:11.5}}>{etapaSel==="Apelación (JARU)"?"condicional — solo si el reclamante impugna":"aún sin ticket — nace al avanzar el flujo"}</span>}
                  {t && <span style={{fontSize:12,color:"var(--mut)"}}>Responsable: <b style={{color:"var(--tx)"}}>{t.responsable||"—"}</b>{t.fechaLimite?" · límite "+fmtFecha(t.fechaLimite):""}</span>}
                  {fEt && <span style={{fontSize:11.5,color:"var(--mut2)"}}>({fEt.rol}{fEt.plazo?" · "+fEt.plazo:""})</span>}
                  <button className="btn-ghost" style={{marginLeft:"auto",fontSize:11.5,padding:"4px 9px"}} onClick={()=>setEtapaSel(null)}>✕</button>
                </div>
                {fEt?.quien && <div style={{fontSize:11.5,color:"var(--mut)",marginTop:6}}>👥 <b>Quién lo hace:</b> {fEt.quien}</div>}
                {docsEt.length>0 && (
                  <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:9}}>
                    {docsEt.slice(0,5).map((d,i)=><a key={i} style={{...S.doc,fontSize:11.5,padding:"3px 10px"}} href={d.url||"#"} target="_blank" rel="noreferrer">⬇ {d.nombre}</a>)}
                  </div>
                )}
                {/* lo TRABAJADO en esta etapa (informativo, solo lectura — la edición vive en el área de trabajo) */}
                {(()=>{
                  const dEt = (datos && datos[exp.codigo+"|"+etapaSel]) || {};
                  const ks = Object.keys(dEt).filter(k=>String(dEt[k]??"").trim()!=="");
                  const actEt = actividadTodo.filter(a=>String(a.etapa||"")===etapaSel).slice(0,3);
                  return (
                    <div style={{marginTop:9}}>
                      {ks.length
                        ? <>
                            <div style={{fontSize:10.5,textTransform:"uppercase",letterSpacing:".05em",color:"var(--mut)",fontWeight:700,marginBottom:5}}>📋 Registrado en esta etapa ({ks.length})</div>
                            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                              {ks.map(k=>(
                                <span key={k} title={String(dEt[k])} style={{fontSize:11.5,background:"#F4FBF6",border:"1px solid #BFE5CB",borderRadius:8,padding:"3px 9px",color:"var(--tx)",maxWidth:340,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                                  <b style={{color:"#15803D"}}>✓ {LBL_CAMPO[k]||k}:</b> {String(dEt[k])}
                                </span>
                              ))}
                            </div>
                          </>
                        : <div className="muted" style={{fontSize:11.5}}>📋 Aún sin datos registrados en esta etapa — se llenan desde «Evidencia + datos» en el área de trabajo.</div>}
                      {actEt.length>0 && (
                        <div style={{marginTop:8}}>
                          <div style={{fontSize:10.5,textTransform:"uppercase",letterSpacing:".05em",color:"var(--mut)",fontWeight:700,marginBottom:4}}>🕐 Actividad de esta etapa</div>
                          {actEt.map((a,i)=>(
                            <div key={i} style={{fontSize:11.5,color:"var(--tx)",padding:"2px 0"}}>
                              <b style={{color:"var(--titulo)"}}>{a.quien}</b> {a.que} <span className="muted" style={{fontSize:10.5}}>· {a.cuando}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
                <div style={{marginTop:9}}><GuiaSielseBox etapa={etapaSel} compacta/></div>
                <div style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:10}}>
                  <button className="btn sm" onClick={()=>onTrabajar(exp.id, etapaSel)}>Abrir esta etapa en el trabajo</button>
                  {t && puedeCorregir && onEstadoTicket && (t.hecho
                    ? <button className="btn-ghost" style={{fontSize:12}} title="Corrige un cierre por error: la etapa vuelve a pendiente y queda registrado en la bitácora"
                        onClick={()=>{ if(confirm("¿Reabrir la etapa "+etapaSel+"? Volverá a pendiente (queda en bitácora).")){ onEstadoTicket(t,"pendiente"); toast("Etapa reabierta — corrige y vuelve a terminarla"); } }}>↩ Reabrir (corregir)</button>
                    : <button className="btn-ghost" style={{fontSize:12,color:"#15803D",borderColor:"#A7D9B9"}} title="Marca la etapa como terminada (queda en bitácora)"
                        onClick={()=>{ if(confirm("¿Marcar "+etapaSel+" como hecha?")){ onEstadoTicket(t,"hecho"); toast("Etapa marcada como hecha ✓"); } }}>✓ Marcar hecha</button>)}
                  {t && !puedeCorregir && <span className="muted" style={{fontSize:11,alignSelf:"center"}}>Corregir etapas: solo Coordinación/Gerencia</span>}
                </div>
              </div>
            );
          })()}

          {/* ===== responsable actual y siguiente ===== */}
          <div style={S.resp}>
            <span style={S.ava(act?wColor(act.respId):"#8B9BB1")}>{iniciales(act?act.responsable:"—")}</span>
            <span>Encargado ahora: <b style={{color:"var(--titulo)"}}>{act?act.responsable:(cerrado?"— (cerrado)":"—")}</b></span>
            {/* Reasignar la etapa actual — SOLO Coordinador/Gerente (upd_ticket, gate de jefe) */}
            {act && onReasignarTicket && (perfil?.rol==="COORDINADOR"||perfil?.rol==="GERENTE") &&
              <select value={act.respId} title={"Reasignar «"+act.etapa+"» a otro responsable"}
                onChange={e=>{ const m=TEAM.find(x=>x.id===+e.target.value); onReasignarTicket(act, +e.target.value, m?m.nombre:"Externo / Call Center"); }}
                style={{ background:"var(--card)", color:"var(--tx)", border:`1px solid ${wColor(act.respId)}`, borderRadius:8, padding:"4px 7px", fontSize:12 }}>
                {TEAM.map(m=><option key={m.id} value={m.id}>{m.corto} · {m.rol}</option>)}
                <option value={0}>Externo / Call Center</option>
              </select>}
            {/* Tomar la etapa — trabajador del MISMO rol que no la tiene (self-claim, queda en bitácora) */}
            {act && onTomarTarea && act.respId!==perfil?.resp_id && puedeTomar(perfil?.rol, act.etapa) &&
              perfil?.rol!=="COORDINADOR" && perfil?.rol!=="GERENTE" &&
              <button className="btn sm" title={"Tomar esta etapa — hoy la tiene "+(act.responsable||"sin asignar")}
                onClick={()=>onTomarTarea(act)} style={{fontWeight:700}}>✋ Tomar</button>}
            {sig && <><span style={{color:"var(--mut2)"}}>→</span>
              <span style={{color:"var(--mut)"}}>Sigue: {sig.etapa} · <b style={{color:"var(--tx)"}}>{sig.responsable||"por asignar"}</b></span></>}
            {ladoALado
              ? <span className="muted" style={{marginLeft:"auto",fontSize:12}}>El área de trabajo está abierta a la derecha →</span>
              : <button className="btn" style={{marginLeft:"auto"}} onClick={()=>onTrabajar(exp.id, act?act.etapa:null)}>Trabajar esta etapa</button>}
          </div>

          <div style={{marginTop:12}}><GuiaSielseBox etapa={etapaActual} compacta/></div>

          {/* ===== relojes normativos (SAP + elevación) — mini-calendario interactivo ===== */}
          <div style={S.relojesBox}>
            <div style={{fontSize:13.5,fontWeight:700,color:"var(--titulo)",marginBottom:4}}>⚖ Relojes normativos</div>
            {haySAPVencido && (
              <div style={S.relojBannerSAP}>
                🚨 RIESGO DE SILENCIO POSITIVO — el reclamo puede darse por FUNDADO (penalidad 5.5: S/300 + el monto)
              </div>
            )}
            {relojes.length>0
              ? <CalendarioRelojes relojes={relojes} ladoALado={ladoALado}/>
              : <div className="muted" style={{fontSize:12}}>Sin relojes normativos aplicables a este caso.</div>}
          </div>

          {/* ===== documentos del caso ===== */}
          <div style={S.descargas}>
            {docs.slice(0,8).map((d,i)=>(
              <a key={i} style={S.doc} href={d.url||"#"} target="_blank" rel="noreferrer" title={d.etapa}>⬇ {d.nombre||("documento "+(i+1))}</a>
            ))}
            {!docs.length && <span className="muted" style={{fontSize:12}}>Aún no hay documentos subidos — aparecerán aquí al trabajar las etapas.</span>}
          </div>

          {/* ===== 2ª fuente: los CUADERNOS (Excel) que cruzan este mismo expediente ===== */}
          <div style={{marginTop:14, background:"var(--card2)", border:"1px solid var(--bd)", borderRadius:12, padding:"11px 13px"}}>
            <div style={{fontSize:13.5, fontWeight:700, color:"var(--titulo)"}}>📒 En los cuadernos {cuadRegs!=null && cuadRegs.length>0 ? "("+cuadRegs.length+")" : ""}</div>
            <div className="muted" style={{fontSize:11, margin:"2px 0 8px"}}>Dónde aparece ESTE expediente en los cuadernos de control: cada línea es un paso que se le registró (inspección, resolución, notificación, apelación…). Es su historial en los libros; arriba está la fuente SIELSE.</div>
            {cuadRegs==null && <div className="muted" style={{fontSize:12}}>Cargando cuadernos…</div>}
            {cuadRegs!=null && cuadRegs.length===0 && <div className="muted" style={{fontSize:12}}>Este expediente aún no figura en ningún cuaderno.</div>}
            {cuadRegs!=null && cuadRegs.length>0 && (()=>{
              // LÍNEA DE TIEMPO: pasos registrados en los cuadernos, cronológico, con ETIQUETA de cada dato.
              const detPares=(def,r)=>{
                if(!def) return [];
                const out=[];
                (def.cols||[]).forEach(([lbl,path])=>{
                  if(!path || path==="item" || path==="fecha_evento") return;
                  let v=valCuaderno(r,path); v=String(v==null?"":v).trim();
                  if(!v) return;
                  if(/^\d{4}-\d{2}-\d{2}/.test(v)) v=fmtFecha(v.slice(0,10));
                  out.push({lbl,v});
                });
                return out;
              };
              const orden=[...cuadRegs].map(r=>({r,f:String(r.fecha_evento||"").slice(0,10)}))
                .sort((a,b)=>(a.f||"9999")<(b.f||"9999")?-1:1);
              return <div>
                {orden.map(({r,f},i)=>{
                  const def=CUAD_POR_FUENTE[r.tipo], nombre=def?def.nombre:r.tipo;
                  const pares=detPares(def,r);
                  const queryCaso=r.reclamo||r.suministro||exp.codigo;
                  return <div key={i} style={{display:"flex",gap:10,alignItems:"flex-start",position:"relative",paddingBottom:i<orden.length?12:0}}>
                    <span style={{position:"absolute",left:9,top:19,bottom:0,width:2,background:"var(--bd)"}}/>
                    <span title="Paso registrado" style={{flexShrink:0,width:20,height:20,borderRadius:"50%",background:"#1E8E5A",color:"#fff",fontSize:12,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",zIndex:1}}>✓</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",alignItems:"baseline",gap:8,flexWrap:"wrap"}}>
                        <span onClick={()=>onAbrirCuaderno&&onAbrirCuaderno(r.tipo, queryCaso)}
                          title="Abrir este cuaderno filtrado a este caso" style={{fontSize:12.5,fontWeight:700,color:"var(--linkTx)",cursor:onAbrirCuaderno?"pointer":"default",textDecoration:onAbrirCuaderno?"underline":"none",textUnderlineOffset:2}}>{nombre}</span>
                        <span className="muted" style={{fontSize:11}}>{f?fmtFecha(f):"sin fecha"}</span>
                      </div>
                      {pares.length>0 && <div style={{fontSize:11,marginTop:2,display:"flex",flexWrap:"wrap",gap:"1px 12px"}}>
                        {pares.map((p,j)=><span key={j}><span className="muted">{p.lbl}:</span> <b style={{fontWeight:600,color:"var(--tx)"}}>{p.v}</b></span>)}
                      </div>}
                    </div>
                  </div>;
                })}
                {/* estado actual (SIELSE) — dónde está AHORA: lo que sigue por hacer */}
                <div style={{display:"flex",gap:10,alignItems:"center"}}>
                  <span title="Etapa actual" style={{flexShrink:0,width:20,height:20,borderRadius:"50%",background:"var(--card)",border:"2px solid var(--linkTx)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1}}/>
                  <div style={{fontSize:12,color:"var(--tx)"}}><b>Ahora:</b> {cerrado?"Expediente cerrado":etapaActual} <span className="muted">· etapa actual según SIELSE</span></div>
                </div>
              </div>;
            })()}
          </div>
        </div>

        {/* ===== QR del caso (por suministro) — descargar PNG / imprimir / pegar en el libro ===== */}
        {exp.suministro && (()=>{
          const corr = [...new Set((cuadRegs||[]).map(r=>String(r.correlativo||"").trim()).filter(Boolean))].slice(0,6);
          return <div style={{marginTop:14,display:"flex",gap:14,alignItems:"center",flexWrap:"wrap",background:"var(--card2)",border:"1px solid var(--bd)",borderRadius:12,padding:"12px 14px"}}>
            <div style={{background:"#fff",padding:6,borderRadius:8,flexShrink:0}}>
              {qrImg ? <img src={qrImg} alt="QR del caso" style={{width:112,height:112,display:"block"}}/> : <div style={{width:112,height:112,display:"flex",alignItems:"center",justifyContent:"center",color:"#999",fontSize:11}}>QR…</div>}
            </div>
            <div style={{flex:1,minWidth:180}}>
              <div style={{fontSize:13.5,fontWeight:700,color:"var(--titulo)"}}>📱 QR del caso</div>
              <div className="muted" style={{fontSize:11,margin:"1px 0 6px"}}>Pégalo en el libro físico: al escanearlo, abre este caso en la plataforma para documentar el evento.</div>
              <div style={{fontSize:12,lineHeight:1.7}}>
                <div><span className="muted">Suministro:</span> <b className="mono">{exp.suministro}</b></div>
                <div><span className="muted">Reclamo:</span> <b className="mono">{exp.osinerg||exp.codigo}</b></div>
                {corr.length>0 && <div><span className="muted">Correlativos:</span> <b>{corr.join(" · ")}</b></div>}
              </div>
              <div style={{display:"flex",gap:8,marginTop:9,flexWrap:"wrap"}}>
                <button className="btn sm" onClick={()=>descargarQR(exp.suministro, "QR_"+(exp.suministro))}>⬇ Descargar PNG</button>
                <button className="btn sm" onClick={()=>imprimirQRs([{suministro:exp.suministro,reclamante:exp.solicitante,osinerg:exp.osinerg||exp.codigo}], "QR — "+(exp.osinerg||exp.codigo))}>🖨 Imprimir etiqueta</button>
              </div>
            </div>
          </div>;
        })()}

        {/* ===== las 4 tarjetas (patrón courier) ===== */}
        <div style={S.fichas}>
          <div style={S.ficha}>
            <button style={S.copy} onClick={()=>copiar(exp.solicitante,"reclamante")}>copiar</button>
            <div style={{fontSize:17}}>👤</div><div style={S.fTit}>Reclamante</div>
            <div style={S.fKv}><span style={{color:"var(--tx)",fontWeight:600}}>{exp.solicitante||"—"}</span></div>
          </div>
          <div style={S.ficha}>
            <button style={S.copy} onClick={()=>copiar(exp.suministro,"suministro")}>copiar</button>
            <div style={{fontSize:17}}>⚡</div><div style={S.fTit}>Suministro</div>
            <div style={S.fKv}><span className="mono" style={{color:"var(--tx)",fontWeight:600}}>{exp.suministro||"—"}</span></div>
          </div>
          <div style={S.ficha}>
            <button style={S.copy} onClick={()=>copiar(exp.clase,"materia")}>copiar</button>
            <div style={{fontSize:17}}>📋</div><div style={S.fTit}>Materia</div>
            <div style={S.fKv}>
              <span style={{color:"var(--tx)",fontWeight:600}}>{(exp.clase||"—").replace("RECLAMOS ","")}</span>
              {exp.tipoRes && <span>Resol. histórica: {exp.tipoRes}</span>}
            </div>
          </div>
          <div style={S.ficha}>
            <button style={S.copy} onClick={()=>copiar(exp.osinerg||exp.codigo,"código")}>copiar</button>
            <div style={{fontSize:17}}>⏱️</div><div style={S.fTit}>Plazo y avance</div>
            <div style={S.fKv}>
              <span>Etapas: <b style={{color:"var(--tx)"}}>{hechas}/{propios.length||"?"}</b></span>
              {act && <span>Restan: <b style={{color:plazoPill.cl}}>{act.diasRestantes!=null?act.diasRestantes+" d háb.":"—"}</b></span>}
              <span>Estado: {exp.estado||"—"}</span>
            </div>
          </div>
        </div>

        {/* ===== correos del caso ===== */}
        <div style={S.correos}>
          <div style={{fontSize:13.5,fontWeight:700,color:"var(--titulo)",marginBottom:4}}>Correos del caso</div>
          {correosDelCaso.slice(0,5).map((c,i)=>(
            <div key={c.id||i} style={{...S.correoFila, ...(i===Math.min(correosDelCaso.length,5)-1?{borderBottom:0}:{})}} title="ábrelo desde la pestaña Bandeja">
              <span style={{fontSize:15}}>📧</span>
              <div style={{flex:1,minWidth:0}}>
                <div style={S.correoAsunto}>{c.asunto||"(sin asunto)"}</div>
                <div style={S.correoMeta}>{c.de||"—"} · {c.fecha||""}</div>
              </div>
            </div>
          ))}
          {!correosDelCaso.length && <div className="muted" style={{fontSize:12}}>Sin correos vinculados — vincúlalos desde la Bandeja.</div>}
        </div>

        {/* ===== actividad del equipo ===== */}
        <div style={S.feed}>
          <div style={{fontSize:13.5,fontWeight:700,color:"var(--titulo)",marginBottom:4}}>Actividad del equipo</div>
          {actividad.map((a,i)=>(
            <div key={i} style={{...S.evento, ...(i===actividad.length-1?{borderBottom:0}:{})}}>
              <span style={S.ava("#1E5FAF")}>{iniciales(a.quien)}</span>
              <div style={{flex:1}}>
                <div><b style={{color:"var(--titulo)"}}>{a.quien}</b> <span style={{color:"var(--tx)"}}>{a.que}</span>
                  {a.etapa && <span style={{fontSize:10,padding:"1px 7px",borderRadius:6,background:"#EAF1F9",color:"#1E5FAF",fontWeight:700,marginLeft:7}}>{a.etapa}</span>}
                </div>
              </div>
              <span style={{fontSize:10.5,color:"var(--mut2)",whiteSpace:"nowrap"}}>{a.cuando}</span>
            </div>
          ))}
          {!actividad.length && <div className="muted" style={{fontSize:12}}>Sin actividad registrada todavía.</div>}
          {actividadTodo.length > 5 && (
            <button className="btn-ghost" style={{marginTop:8,fontSize:12,width:"100%"}} onClick={()=>setVerTodaAct(v=>!v)}>
              {verTodaAct ? "▴ Comprimir actividad" : "▾ Ver toda la actividad ("+actividadTodo.length+")"}
            </button>
          )}
          <div style={{display:"flex",gap:8,marginTop:11}}>
            <input className="flt" style={{flex:1}} placeholder="Comentar en este expediente… (todo el equipo del caso lo ve)"
              value={texto} onChange={e=>setTexto(e.target.value)} onKeyDown={e=>{ if(e.key==="Enter") enviarComentario(); }}/>
            <button className="btn sec" onClick={enviarComentario}>Comentar</button>
          </div>
        </div>
      </div>

      {/* ===== Modal: Ficha SIELSE (registro del caso + trabajado por fase + documentos) ===== */}
      {verFicha && (
        <FichaSielse exp={exp} datos={datos} evidencias={evidencias} onClose={()=>setVerFicha(false)} onEditar={onEditar} />
      )}
    </div>
  );
}
