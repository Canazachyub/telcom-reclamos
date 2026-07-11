import { useState, useEffect } from "react";
import { ETAPAS, FLUJO, fmtFecha, wColor, TEAM, puedeTomar, teamById } from "../lib/model.js";
import { esOperativo } from "../lib/auth.js";
import { toast } from "./ui.jsx";
import { GuiaSielseBox } from "../lib/guiaSielse.jsx";
import FichaSielse from "./FichaSielse.jsx";
import { relojesDelCaso } from "../lib/plazosNormativos.js";
import { loadCuadernosPorCaso } from "../lib/api.js";
import { qrDataURL } from "../lib/qr.js";
import CuadernosCaso from "./CuadernosCaso.jsx";
import { ICONO_ETAPA, iniciales, fmtCuando as fmtCuando_, humanizarRegistro as humanizarRegistro_, humanizar, LBL_CAMPO } from "./sala/utils.js";
import { CalendarioRelojes } from "./sala/CalendarioRelojes.jsx";
import { TarjetaQR } from "./sala/TarjetaQR.jsx";
import { FichasCaso } from "./sala/FichasCaso.jsx";
import { CorreosCaso } from "./sala/CorreosCaso.jsx";
import { ActividadFeed } from "./sala/ActividadFeed.jsx";
import SalaSimple from "./sala/SalaSimple.jsx";

// clave de localStorage donde se recuerda la última vista elegida por el usuario (simple/detalles) —
// pedido del gerente: por defecto FÁCIL para roles operativos, DETALLES para Gerencia/Coordinación,
// pero la elección manual del usuario manda desde la 2ª apertura en adelante.
const LS_VISTA = "sala_vista_v1";
function defaultVista(perfil){
  try{
    const guardada = localStorage.getItem(LS_VISTA);
    if(guardada==="simple" || guardada==="detalles") return guardada;
  }catch(e){}
  return esOperativo(perfil?.rol) ? "simple" : "detalles";
}

// ===================== Sala del expediente (v4, patrón courier) =====================
// Vista de SEGUIMIENTO y colaboración de un caso: dónde está, quién lo tiene, cuánto plazo
// queda, sus documentos y todo lo que el equipo hizo. NO reemplaza al Drawer: el botón
// "Trabajar esta etapa" abre el Drawer de siempre (la Sala es para VER, el Drawer para HACER).

// Drawer.jsx importa estos dos símbolos desde "./SalaExpediente.jsx" — se re-exportan tal cual
// (la implementación real vive en ./sala/utils.js, extracción pura sin cambiar el punto de import).
export const fmtCuando = fmtCuando_;
export const humanizarRegistro = humanizarRegistro_;

export default function SalaExpediente({ exp, tickets, evidencias, registros, comentarios, perfil, datos, correos, onComentar, onTrabajar, onClose, onEditar, onEstadoTicket, onReasignarTicket, onTomarTarea, onAbrirCuaderno, onEliminar, ladoALado }){
  const [texto, setTexto] = useState("");
  const [verFicha, setVerFicha] = useState(false);
  const [vista, setVista] = useState(()=>defaultVista(perfil));  // "simple" (fácil, default operativos) | "detalles" (Sala clásica)
  // atajo de navegación (p.ej. "último paso en cuadernos" en la vista simple): solo cambia la
  // vista de ESTA apertura, NO reescribe la preferencia guardada — esa solo la toca toggleVista.
  const irADetalles = () => setVista("detalles");
  const toggleVista = () => {
    const nueva = vista==="simple" ? "detalles" : "simple";
    setVista(nueva);
    try{ localStorage.setItem(LS_VISTA, nueva); }catch(e){}
  };
  const [etapaSel, setEtapaSel] = useState(null);   // etapa clickeada en la línea de tiempo
  const [verTodaAct, setVerTodaAct] = useState(false); // feed comprimido (5) vs completo
  const [cuadRegs, setCuadRegs] = useState(null);   // registros de CUADERNOS de este caso (2ª fuente)
  const [qrImg, setQrImg] = useState("");           // PNG (data-URL) del QR del caso (por suministro)
  const [vw, setVw] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
  useEffect(() => { const f = () => setVw(window.innerWidth); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); }, []);
  const mobile = vw < 640;                            // teléfono: la Sala pasa a hoja a pantalla completa
  const lado = ladoALado && !mobile;                  // sin lado-a-lado en móvil
  const puedeCorregir = ["GERENTE","COORDINADOR"].includes(perfil?.rol);

  // QR del caso (codifica ?sum=<suministro>) — para verlo/descargar/pegar en el libro físico
  useEffect(() => {
    let vivo = true; setQrImg("");
    if (exp.suministro) qrDataURL(exp.suministro, 220).then(u => { if (vivo) setQrImg(u); }).catch(() => {});
    return () => { vivo = false; };
  }, [exp.suministro]);

  // 2ª fuente: los registros de los cuadernos (Excel) que cruzan con ESTE expediente
  const recargarCuad = () => loadCuadernosPorCaso(exp.codigo, exp.osinerg).then(r => setCuadRegs(r || []));
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
      ? { tx:"Expediente completado", bg:"var(--tint-green-bg)", cl:"var(--tint-green-tx)" }
      : { tx:"Sin tickets aún (respaldo v1: "+(exp.etapa||"—")+")", bg:"var(--card2)", cl:"var(--mut)" })
    : act.vencido
      ? { tx:"VENCIDO hace "+Math.abs(act.diasRestantes||0)+" d háb. — "+(act.fechaLimite?fmtFecha(act.fechaLimite):""), bg:"var(--tint-red-bg)", cl:"var(--tint-red-tx)" }
      : (act.diasRestantes!=null && act.diasRestantes<=2)
        ? { tx:"Vence en "+act.diasRestantes+" d háb. — "+(act.fechaLimite?fmtFecha(act.fechaLimite):""), bg:"var(--tint-amber-bg)", cl:"var(--tint-amber-tx)" }
        : { tx: act.diasRestantes!=null ? ("Vence en "+act.diasRestantes+" d háb. — "+(act.fechaLimite?fmtFecha(act.fechaLimite):"")) : "Sin plazo registrado", bg:"var(--tint-green-bg)", cl:"var(--tint-green-tx)" };

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
    overlay:{ position:"fixed", inset:0, background:"var(--scrim)", zIndex:95, display:"flex", justifyContent: lado ? "flex-start" : "center", alignItems:"flex-start", padding: mobile ? 0 : "3vh 12px", overflowY:"auto" },
    panel:{ width: lado ? "clamp(380px, calc(100vw - 760px), 640px)" : (mobile ? "100%" : "min(1080px,100%)"), background:"var(--bg)", border: mobile ? "none" : "1px solid var(--bd)", borderRadius: mobile ? 0 : 16, padding: mobile ? "12px 12px 28px" : 18, maxHeight: mobile ? "none" : "94vh", minHeight: mobile ? "100vh" : "auto", overflowY:"auto", boxShadow: mobile ? "none" : "var(--shadow-modal)" },
    head:{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:10, marginBottom:12 },
    hero:{ background:"var(--card)", border:"1px solid var(--bd)", borderRadius:16, padding:"18px 20px" },
    icono:{ width:52, height:52, borderRadius:13, background:"linear-gradient(135deg,var(--acc),var(--accLight))", display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, flexShrink:0 },
    estadoTit:{ margin:0, fontSize:23, color:"var(--titulo)", lineHeight:1.1 },
    pill:(p)=>({ display:"inline-block", fontSize:11.5, fontWeight:700, padding:"3px 11px", borderRadius:999, background:p.bg, color:p.cl, marginTop:8 }),
    tl:{ marginTop:20, overflowX:"auto", paddingBottom:4 },
    tlInner:{ display:"flex", minWidth:830 },
    hito:{ flex:1, position:"relative", textAlign:"center" },
    barra:(estado)=>({ position:"absolute", top:12, left:0, right:0, height:4, background: estado==="done" ? "var(--green)" : estado==="actual" ? "linear-gradient(90deg,var(--acc) 0 50%,var(--bd) 50%)" : "var(--bd)" }),
    nodo:(estado, cond)=>({ position:"relative", zIndex:1, width:26, height:26, margin:"0 auto", borderRadius:"50%",
      background: estado==="done" ? "var(--green)" : estado==="actual" ? "var(--acc)" : (cond ? "transparent" : "var(--bd)"),
      border: "2px solid "+(estado==="done" ? "var(--green)" : estado==="actual" ? "var(--accHover)" : "var(--bd)"),
      borderStyle: cond && estado==="pend" ? "dashed" : "solid",
      display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700,
      color: estado==="done" || estado==="actual" ? "#fff" : "var(--mut2)",
      boxShadow: estado==="actual" ? "0 0 0 5px var(--tint-acc-bg)" : "none" }),
    lb:(estado)=>({ fontSize:10.5, marginTop:6, lineHeight:1.25, color: estado==="actual" ? "var(--titulo)" : estado==="done" ? "var(--tint-green-tx)" : "var(--mut)", fontWeight: estado==="actual" ? 700 : 400 }),
    fecha:{ fontSize:9.5, color:"var(--mut2)", marginTop:1 },
    resp:{ display:"flex", flexWrap:"wrap", alignItems:"center", gap:11, marginTop:16, background:"var(--card2)", border:"1px solid var(--bd)", borderRadius:12, padding:"10px 13px", fontSize:13 },
    ava:(c)=>({ width:29, height:29, borderRadius:"50%", background:c||"var(--acc)", color:"#fff", display:"inline-flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, flexShrink:0 }),
    descargas:{ display:"flex", flexWrap:"wrap", gap:7, marginTop:13 },
    doc:{ display:"inline-flex", alignItems:"center", gap:6, border:"1px solid var(--bd)", borderRadius:999, padding:"5px 13px", fontSize:12, color:"var(--tx)", background:"var(--card2)", textDecoration:"none" },
    relojesBox:{ background:"var(--card)", border:"1px solid var(--bd)", borderRadius:16, padding:15, marginTop:13 },
    relojBannerSAP:{ display:"flex", alignItems:"center", gap:8, background:"var(--tint-red-bg)", border:"1px solid var(--tint-red-bd)", color:"var(--tint-red-tx)", borderRadius:10, padding:"9px 13px", marginBottom:11, fontSize:12.5, fontWeight:700 },
  };

  return (
    <div style={S.overlay} onClick={e=>{ if(lado) return; if(e.target===e.currentTarget) onClose(); }}>
      <div style={S.panel}>
        <div style={S.head}>
          <div>
            <h2 style={{margin:0,fontSize:17,color:"var(--titulo)"}}>Sala del expediente</h2>
            <div className="muted" style={{fontSize:11.5}}>seguimiento y colaboración — para trabajar la etapa usa el botón rojo</div>
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <button className="btn-ghost" onClick={()=>setVerFicha(true)} title="Ver el registro SIELSE completo del caso, lo trabajado por fase y sus documentos">📋 Ficha SIELSE</button>
            <button className="btn-ghost" onClick={toggleVista}
              title={vista==="simple" ? "Ver toda la información de la Sala (relojes, correos, feed, ficha SIELSE completa)" : "Volver a la vista fácil"}>
              {vista==="simple" ? "🔍 Detalles" : "← Vista simple"}
            </button>
            {perfil?.rol==="GERENTE" && onEliminar && (
              <button className="btn-ghost" style={{color:"var(--tint-red-tx)",borderColor:"var(--tint-red-bd)"}}
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

        {/* ===== vista FÁCIL (default operativos/celular) — pedido gerencia: reclamante, dónde está,
             qué sigue, botón grande de trabajar, progreso simple, último cuaderno, QR chico ===== */}
        {vista==="simple" && (
          <SalaSimple exp={exp} act={act} etapaActual={etapaActual} flujoInfo={flujoInfo}
            cerrado={cerrado} hechas={hechas} totalEtapas={ETAPAS.length} cuadRegs={cuadRegs} qrImg={qrImg}
            onTrabajar={onTrabajar} onIrADetalles={irADetalles} />
        )}

        {/* ===== vista DETALLES — Sala clásica completa, sin cambios de contenido ===== */}
        {vista==="detalles" && (<>
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
                    <div style={{...S.nodo(estado, cond||ghost), ...(sel?{boxShadow:"0 0 0 4px var(--tint-acc-bg)"}:{})}}>
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
                      background: t.hecho?"var(--tint-green-bg)":(t.vencido?"var(--tint-red-bg)":"var(--tint-amber-bg)"),
                      color: t.hecho?"var(--tint-green-tx)":(t.vencido?"var(--tint-red-tx)":"var(--tint-amber-tx)")}}>
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
                                <span key={k} title={String(dEt[k])} style={{fontSize:11.5,background:"var(--tint-green-bg)",border:"1px solid var(--tint-green-bd)",borderRadius:8,padding:"3px 9px",color:"var(--tx)",maxWidth:340,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                                  <b style={{color:"var(--tint-green-tx)"}}>✓ {LBL_CAMPO[k]||k}:</b> {String(dEt[k])}
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
                    : <button className="btn-ghost" style={{fontSize:12,color:"var(--tint-green-tx)",borderColor:"var(--tint-green-bd)"}} title="Marca la etapa como terminada (queda en bitácora)"
                        onClick={()=>{ if(confirm("¿Marcar "+etapaSel+" como hecha?")){ onEstadoTicket(t,"hecho"); toast("Etapa marcada como hecha ✓"); } }}>✓ Marcar hecha</button>)}
                  {t && !puedeCorregir && <span className="muted" style={{fontSize:11,alignSelf:"center"}}>Corregir etapas: solo Coordinación/Gerencia</span>}
                </div>
              </div>
            );
          })()}

          {/* ===== responsable actual y siguiente ===== */}
          <div style={S.resp}>
            <span style={S.ava(act?wColor(act.respId):"var(--mut2)")}>{iniciales(act?act.responsable:"—")}</span>
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
            {lado
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
              ? <CalendarioRelojes relojes={relojes} ladoALado={lado || mobile}/>
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
          <div style={{marginTop:14}}>
            <CuadernosCaso exp={exp} registros={cuadRegs} onAbrirCuaderno={onAbrirCuaderno} onRegistrado={recargarCuad}
              perfil={perfil} etapaActual={etapaActual} cerrado={cerrado} />
          </div>
        </div>

        {exp.suministro && <TarjetaQR exp={exp} qrImg={qrImg} cuadRegs={cuadRegs} />}

        <FichasCaso exp={exp} act={act} hechas={hechas} propios={propios} plazoPill={plazoPill} />

        <CorreosCaso correosDelCaso={correosDelCaso} />

        <ActividadFeed actividad={actividad} actividadTodo={actividadTodo} verTodaAct={verTodaAct} setVerTodaAct={setVerTodaAct}
          texto={texto} setTexto={setTexto} onEnviar={enviarComentario} />
        </>)}
      </div>

      {/* ===== Modal: Ficha SIELSE (registro del caso + trabajado por fase + documentos) ===== */}
      {verFicha && (
        <FichaSielse exp={exp} datos={datos} evidencias={evidencias} onClose={()=>setVerFicha(false)} onEditar={onEditar} />
      )}
    </div>
  );
}
