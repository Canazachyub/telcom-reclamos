import { useState } from "react";
import { ETAPAS, FLUJO, fmtFecha, wColor } from "../lib/model.js";
import { toast } from "./ui.jsx";
import { GuiaSielseBox } from "../lib/guiaSielse.jsx";
import FichaSielse from "./FichaSielse.jsx";

// ===================== Sala del expediente (v4, patrón courier) =====================
// Vista de SEGUIMIENTO y colaboración de un caso: dónde está, quién lo tiene, cuánto plazo
// queda, sus documentos y todo lo que el equipo hizo. NO reemplaza al Drawer: el botón
// "Trabajar esta etapa" abre el Drawer de siempre (la Sala es para VER, el Drawer para HACER).

const ICONO_ETAPA = { "Recepción":"📥","Evaluación":"🔍","Campo":"🚙","SIELSE":"💻","Resolución":"⚖️","Firmas":"✍️","Notificación":"📨","Apelación (JARU)":"🏛️","Foliado":"📚","Cierre":"✅" };
const iniciales = n => (n||"").split(" ").map(s=>s[0]).slice(0,2).join("").toUpperCase();

function copiar(txt, etiqueta){
  try{ navigator.clipboard.writeText(String(txt)); toast("Copiado: "+etiqueta); }catch(e){ toast("No se pudo copiar"); }
}

export default function SalaExpediente({ exp, tickets, evidencias, registros, comentarios, perfil, datos, correos, onComentar, onTrabajar, onClose }){
  const [texto, setTexto] = useState("");
  const [verFicha, setVerFicha] = useState(false);

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

  // actividad: registros del caso + comentarios, lo más nuevo primero (append-only → invertimos)
  const evRegs = (registros||[]).filter(r=>String(r.reclamo||"")===String(exp.codigo))
    .map(r=>({ quien:r.usuario||"—", que:(r.tipo?("["+r.tipo+"] "):"")+(r.detalle||""), cuando:r.fecha||"", etapa:r.etapa||"" }));
  const evComs = (comentarios||[]).filter(c=>String(c.reclamo||"")===String(exp.codigo))
    .map(c=>({ quien:c.nombre||c.usuario||"—", que:"💬 "+(c.texto||""), cuando:c.fecha||"", etapa:c.etapa||"" }));
  const actividad = [...evRegs.reverse(), ...evComs].slice(0,14);

  const docs = (evidencias||[]).filter(e=>String(e.exp||"")===String(exp.codigo));

  // correos vinculados a este caso — el campo real de vínculo es `reclamo_vinculado` (ver Bandeja.jsx)
  const correosDelCaso = (correos||[]).filter(c=>String(c.reclamo_vinculado||"")===String(exp.codigo));

  function enviarComentario(){
    const t = texto.trim(); if(!t) return;
    onComentar && onComentar({ reclamo: exp.codigo, etapa: etapaActual, texto: t, nombre: perfil?.nombre });
    setTexto(""); toast("Comentario registrado ✓");
  }

  const S = {
    overlay:{ position:"fixed", inset:0, background:"rgba(22,41,75,.45)", zIndex:95, display:"flex", justifyContent:"center", alignItems:"flex-start", padding:"3vh 12px", overflowY:"auto" },
    panel:{ width:"min(1080px,100%)", background:"var(--bg)", border:"1px solid var(--bd)", borderRadius:16, padding:18, maxHeight:"94vh", overflowY:"auto", boxShadow:"0 24px 70px rgba(22,41,75,.28)" },
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
  };

  return (
    <div style={S.overlay} onClick={e=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div style={S.panel}>
        <div style={S.head}>
          <div>
            <h2 style={{margin:0,fontSize:17,color:"var(--titulo)"}}>Sala del expediente</h2>
            <div className="muted" style={{fontSize:11.5}}>seguimiento y colaboración — para trabajar la etapa usa el botón rojo</div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button className="btn-ghost" onClick={()=>setVerFicha(true)} title="Ver el registro SIELSE completo del caso, lo trabajado por fase y sus documentos">📋 Ficha SIELSE</button>
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

          {/* ===== timeline 10 etapas ===== */}
          {propios.length>0 && (
            <div style={S.tl}><div style={S.tlInner}>
              {propios.map((t,i)=>{
                const estado = t.hecho ? "done" : (i===idxAct ? "actual" : "pend");
                const cond = t.etapa==="Apelación (JARU)";
                return (
                  <div key={t.id||i} style={S.hito}>
                    <div style={{...S.barra(estado), ...(i===0?{left:"50%"}:{}), ...(i===propios.length-1?{right:"50%"}:{})}}/>
                    <div style={S.nodo(estado, cond)}>{t.hecho ? "✓" : (cond && estado==="pend" ? "·" : i+1)}</div>
                    <div style={S.lb(estado)}>{t.etapa==="Apelación (JARU)" ? "Apelación" : t.etapa}{cond && estado==="pend" ? <><br/>(si ocurre)</> : null}</div>
                    <div style={S.fecha}>{estado==="actual" ? "en curso" : (t.hecho && t.fechaLimite ? fmtFecha(t.fechaLimite) : "")}</div>
                  </div>
                );
              })}
            </div></div>
          )}
          {!propios.length && <div className="muted" style={{marginTop:14,fontSize:12}}>Este caso aún no tiene flujo de etapas (v1). Ábrelo con "Trabajar esta etapa" para verlo en el detalle clásico.</div>}

          {/* ===== responsable actual y siguiente ===== */}
          <div style={S.resp}>
            <span style={S.ava(act?wColor(act.respId):"#8B9BB1")}>{iniciales(act?act.responsable:"—")}</span>
            <span>Encargado ahora: <b style={{color:"var(--titulo)"}}>{act?act.responsable:(cerrado?"— (cerrado)":"—")}</b></span>
            {sig && <><span style={{color:"var(--mut2)"}}>→</span>
              <span style={{color:"var(--mut)"}}>Sigue: {sig.etapa} · <b style={{color:"var(--tx)"}}>{sig.responsable||"por asignar"}</b></span></>}
            <button className="btn" style={{marginLeft:"auto"}} onClick={()=>onTrabajar(exp.id, act?act.etapa:null)}>Trabajar esta etapa</button>
          </div>

          <div style={{marginTop:12}}><GuiaSielseBox etapa={etapaActual} compacta/></div>

          {/* ===== documentos del caso ===== */}
          <div style={S.descargas}>
            {docs.slice(0,8).map((d,i)=>(
              <a key={i} style={S.doc} href={d.url||"#"} target="_blank" rel="noreferrer" title={d.etapa}>⬇ {d.nombre||("documento "+(i+1))}</a>
            ))}
            {!docs.length && <span className="muted" style={{fontSize:12}}>Aún no hay documentos subidos — aparecerán aquí al trabajar las etapas.</span>}
          </div>
        </div>

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
          <div style={{display:"flex",gap:8,marginTop:11}}>
            <input className="flt" style={{flex:1}} placeholder="Comentar en este expediente… (todo el equipo del caso lo ve)"
              value={texto} onChange={e=>setTexto(e.target.value)} onKeyDown={e=>{ if(e.key==="Enter") enviarComentario(); }}/>
            <button className="btn sec" onClick={enviarComentario}>Comentar</button>
          </div>
        </div>
      </div>

      {/* ===== Modal: Ficha SIELSE (registro del caso + trabajado por fase + documentos) ===== */}
      {verFicha && (
        <FichaSielse exp={exp} datos={datos} evidencias={evidencias} onClose={()=>setVerFicha(false)} />
      )}
    </div>
  );
}
