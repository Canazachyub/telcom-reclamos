// Pestaña "Expedientes" (Admin): lista completa + evidencias subidas (extraído de App.jsx en
// F1a; consume useApp() desde F1b — ver AppContext.jsx). `canDelegate` sigue por props: es
// DERIVADO del rol de quien mira (lo calcula Admin), no estado global en sí mismo.
import { useState } from "react";
import { Card, urgColor, estadoColor, toast } from "./ui.jsx";
import { MiniProgreso, EstadoChip } from "./atoms.jsx";
import { TEAM, ETAPAS, wColor, wName, daysLeft, fmtFecha, parseFecha, DRIVE_URL } from "../lib/model.js";
import { urgColorTicket } from "../lib/tickets.js";
import { useApp } from "../AppContext.jsx";
import OficinaPanel from "./OficinaPanel.jsx";

const ESTADOS_APP = ["Pendiente","En proceso","Observado","Notificado","Cerrado"];

// ¿la fecha (ISO o dd/mm/yyyy) es HOY?
function esFechaHoy(v){
  const d = parseFecha(v); if(!d) return false;
  const n = new Date();
  return d.getFullYear()===n.getFullYear() && d.getMonth()===n.getMonth() && d.getDate()===n.getDate();
}

export default function ExpedientesTab({ canDelegate }){
  const {
    data, abrirExp: setSelExp, delegar, updEstado, evidencias, activoByCode, progresoDe, registros, comentarios,
    datos, saveDatos, perfilVista,
  } = useApp();
  const [sub,setSub]=useState("lista");
  return <>
    <div className="tabs">{[["lista","Expedientes"],["evidencias","Evidencias subidas ("+evidencias.length+")"],["oficina","🏢 En oficina"]].map(t=>
      <button key={t[0]} className={sub===t[0]?"on":""} onClick={()=>setSub(t[0])}>{t[1]}</button>)}</div>
    {sub==="lista" && <Expedientes data={data} setSelExp={setSelExp} delegar={delegar} updEstado={updEstado} canDelegate={canDelegate} activoByCode={activoByCode} progresoDe={progresoDe} registros={registros} comentarios={comentarios}/>}
    {sub==="evidencias" && <EvidenciasAdmin evidencias={evidencias}/>}
    {sub==="oficina" && <OficinaPanel data={data} activoByCode={activoByCode} datos={datos} saveDatos={saveDatos} perfil={perfilVista} setSelExp={setSelExp}/>}
  </>;
}

function Expedientes({ data, setSelExp, delegar, updEstado, canDelegate, activoByCode={}, progresoDe, registros=[], comentarios=[] }){
  const [filt,setFilt]=useState({resp:"all",etapa:"all",estado:"all",clase:"all",act:"all",q:"",vence:"all"});
  const [maxFilas,setMaxFilas]=useState(200);
  // catálogo de clases presentes en la cartera (filtro tipo Excel)
  const clases = [...new Set(data.map(x=>String(x.clase||"").trim()).filter(Boolean))].sort();
  // casos que NUESTRO equipo trabajó HOY (bitácora + comentarios de hoy) — los registros del
  // sync (sync_cambio/sync_nuevo) NO cuentan como trabajo del equipo: son movimiento de SIELSE
  const trabajadoHoy = new Set();
  registros.forEach(r=>{ if(r.reclamo && esFechaHoy(r.fecha) && String(r.tipo||"").indexOf("sync_")!==0) trabajadoHoy.add(String(r.reclamo)); });
  comentarios.forEach(c=>{ if(c.reclamo && esFechaHoy(c.fecha)) trabajadoHoy.add(String(c.reclamo)); });
  // QUÉ campos movió SIELSE hoy por caso (rastro sync_cambio que deja el sync diario)
  const camposSielseHoy = {};
  registros.forEach(r=>{
    if(String(r.tipo)!=="sync_cambio" || !esFechaHoy(r.fecha)) return;
    try{ const d = typeof r.detalle==="string" ? JSON.parse(r.detalle) : (r.detalle||{});
      if(d && d.campos) camposSielseHoy[String(r.reclamo)] = d.campos; }catch(e){}
  });
  let list=data.filter(x=>{
    if(filt.resp!=="all" && String(x.resp)!==String(filt.resp)) return false;
    if(filt.etapa!=="all" && x.etapa!==filt.etapa) return false;
    if(filt.estado!=="all" && x.estado!==filt.estado) return false;
    if(filt.clase!=="all" && String(x.clase||"").trim()!==filt.clase) return false;
    if(filt.act!=="all"){
      const sielseHoy = esFechaHoy(x.fechaMod);
      const equipoHoy = trabajadoHoy.has(String(x.codigo));
      if(filt.act==="sielse_hoy" && !sielseHoy) return false;
      if(filt.act==="equipo_hoy" && !equipoHoy) return false;
      if(filt.act==="hoy" && !sielseHoy && !equipoHoy) return false;
      if(filt.act==="sin_hoy" && (sielseHoy || equipoHoy)) return false;
    }
    if(filt.q){ const q=filt.q.toLowerCase(); if(!`${x.osinerg} ${x.codigo} ${x.solicitante} ${x.suministro}`.toLowerCase().includes(q)) return false; }
    return true;
  });
  // días restantes por caso: el ticket activo manda (días hábiles); sin tickets, el límite global SIELSE
  let rows = list.map(x=>{
    const act = activoByCode[String(x.codigo)];
    return { x, act, dl: act ? act.diasRestantes : daysLeft(x.fechaLim) };
  });
  if(filt.vence!=="all"){
    rows = rows.filter(({dl})=>{
      if(dl==null) return false;
      if(filt.vence==="vencido") return dl<0;
      if(filt.vence==="hoy") return dl===0;
      if(filt.vence==="3d") return dl>=0 && dl<=3;
      if(filt.vence==="semana") return dl>=0 && dl<=7;
      if(filt.vence==="quincena") return dl>=0 && dl<=15;
      return true;
    }).sort((a,b)=>(a.dl??9e9)-(b.dl??9e9));  // el más urgente arriba
  }
  return <Card>
    <div style={{display:"flex",flexWrap:"wrap",justifyContent:"space-between",gap:8,alignItems:"center"}}>
      <h3 style={{margin:0}}>Expedientes — clic en una fila para ver su flujo ({rows.length}/{data.length})</h3>
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
        <input className="flt" placeholder="Buscar nº / código SIELSE / solicitante / suministro" value={filt.q} onChange={e=>setFilt({...filt,q:e.target.value})} style={{minWidth:240}}/>
        <select className="flt" value={filt.vence} onChange={e=>setFilt({...filt,vence:e.target.value})} style={filt.vence!=="all"?{borderColor:"var(--acc)",color:"var(--acc)",fontWeight:600}:undefined}>
          <option value="all">⏰ Vencen: todos</option>
          <option value="vencido">🔴 Ya vencidos</option>
          <option value="hoy">⚠ Vencen HOY</option>
          <option value="3d">≤ 3 días</option>
          <option value="semana">≤ 7 días (esta semana)</option>
          <option value="quincena">≤ 15 días</option>
        </select>
        <select className="flt" value={filt.act} onChange={e=>setFilt({...filt,act:e.target.value})} style={filt.act!=="all"?{borderColor:"var(--navy)",color:"var(--navy)",fontWeight:600}:undefined}
          title="Actividad de HOY: lo que ELSE movió en SIELSE (FechaModificacion del export) y lo que nuestro equipo trabajó aquí (bitácora)">
          <option value="all">⚡ Actividad: toda</option>
          <option value="sielse_hoy">📤 Movido en SIELSE HOY</option>
          <option value="equipo_hoy">👥 Trabajado por el equipo HOY</option>
          <option value="hoy">✅ Con actividad HOY (cualquiera)</option>
          <option value="sin_hoy">😴 SIN actividad hoy</option>
        </select>
        <select className="flt" value={filt.clase} onChange={e=>setFilt({...filt,clase:e.target.value})}><option value="all">Todas las clases</option>{clases.map(c=><option key={c} value={c}>{c.replace("RECLAMOS ","")}</option>)}</select>
        <select className="flt" value={filt.resp} onChange={e=>setFilt({...filt,resp:e.target.value})}><option value="all">Resp: todos</option>{TEAM.map(t=><option key={t.id} value={t.id}>{t.corto}</option>)}<option value={0}>Externos</option></select>
        <select className="flt" value={filt.etapa} onChange={e=>setFilt({...filt,etapa:e.target.value})}><option value="all">Todas las etapas</option>{ETAPAS.map(e=><option key={e}>{e}</option>)}</select>
        <select className="flt" value={filt.estado} onChange={e=>setFilt({...filt,estado:e.target.value})}><option value="all">Todos los estados</option>{ESTADOS_APP.map(e=><option key={e}>{e}</option>)}</select>
      </div>
    </div>
    <div style={{overflowX:"auto"}}>
      <table className="tbl"><thead><tr><th>Nº OSINERG</th><th>Solicitante</th><th>Suministro</th><th>Clase</th><th>Progreso</th><th>Etapa</th><th>Responsable</th><th title="Fecha límite de la etapa actual (o límite global SIELSE si aún no tiene flujo)">Límite</th><th title="Días HÁBILES restantes (lun-vie sin feriados) — negativo = vencido">Restan (d háb.)</th><th title="📤 = ELSE lo modificó HOY en SIELSE (según el último export) · 👥 = nuestro equipo lo trabajó HOY en la plataforma">Actividad HOY</th><th title="Tipo de resolución histórico registrado en SIELSE — dato informativo, no refleja el avance actual del ticket">Resolución (histórico SIELSE)</th><th>Estado</th></tr></thead><tbody>
        {rows.slice(0,maxFilas).map(({x,act,dl})=>{
          const prog = progresoDe ? progresoDe(x.codigo) : null;
          const limiteTxt = act ? (act.fechaLimite ? fmtFecha(act.fechaLimite) : "—") : fmtFecha(x.fechaLim);
          const restanTxt = act ? (act.diasRestantes==null ? "—" : (act.vencido ? "vencido "+Math.abs(act.diasRestantes)+"d háb." : act.diasRestantes+"d háb.")) : (dl===null?"—":(dl<0?"vencido "+Math.abs(dl)+"d háb.":dl+"d háb."));
          const restanColor = act ? urgColorTicket(act) : urgColor(dl);
          const etapaTxt = act ? act.etapa : x.etapa;
          // Estado mostrado: si hay ticket activo, deriva de su estado; si no hay ticket pero
          // el caso tiene tickets todos hechos, "Completado"; si no tiene tickets, el select v1 (respaldo).
          const estadoDerivado = act
            ? (act.estado==="en_proceso" ? "En proceso" : "Pendiente")
            : (prog && prog.total>0 && prog.hechas===prog.total ? "Completado" : null);
          return (
          <tr key={x.id} className="clk" onClick={()=>setSelExp(x.id)}
            title={"Registrado: "+fmtFecha(x.fechaReg)+" · Admitido: "+(x.fechaAdm?fmtFecha(x.fechaAdm):"aún no")+" · Límite SIELSE: "+fmtFecha(x.fechaLim)+(x.tipoRes?" · Resolución: "+x.tipoRes:"")}>
            <td className="mono">{x.osinerg}
              <button className="btn-ghost" title={"Copiar código SIELSE para buscarlo allá: "+x.codigo}
                onClick={e=>{ e.stopPropagation(); try{ navigator.clipboard.writeText(String(x.codigo)); toast("Código SIELSE copiado: "+x.codigo); }catch(err){ toast("No se pudo copiar"); } }}
                style={{padding:"1px 6px",fontSize:10,marginLeft:6,lineHeight:1.4}}>⧉ SIELSE</button>
            </td><td>{x.solicitante}</td>
            <td className="mono">{x.suministro}
              {x.suministro && <button className="btn-ghost" title={"Copiar suministro: "+x.suministro}
                onClick={e=>{ e.stopPropagation(); try{ navigator.clipboard.writeText(String(x.suministro)); toast("Suministro copiado: "+x.suministro); }catch(err){ toast("No se pudo copiar"); } }}
                style={{padding:"1px 6px",fontSize:10,marginLeft:6,lineHeight:1.4}}>⧉</button>}
            </td>
            <td style={{maxWidth:150,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{x.clase.replace("RECLAMOS ","")}</td>
            <td><MiniProgreso prog={prog}/></td>
            <td>{etapaTxt}</td>
            <td onClick={e=>e.stopPropagation()}>{canDelegate
              ? <select value={x.resp} onChange={e=>delegar(x.id,e.target.value)} style={{borderLeft:`3px solid ${wColor(x.resp)}`}}>{TEAM.map(t=><option key={t.id} value={t.id}>{t.corto} · {t.rol}</option>)}<option value={0}>Externo / Call Center</option></select>
              : <span><span className="dot" style={{background:wColor(x.resp)}}/>{wName(x.resp)}</span>}</td>
            <td>{limiteTxt}</td>
            <td style={{textAlign:"center"}}><b style={{color:restanColor}}>{restanTxt}</b></td>
            <td style={{whiteSpace:"nowrap"}}>
              {esFechaHoy(x.fechaMod) && <span title={"Modificado HOY en SIELSE"+(x.usuarioModifica?" ("+x.usuarioModifica+")":"")+(parseFecha(x.fechaMod)?" a las "+parseFecha(x.fechaMod).toLocaleTimeString("es-PE",{hour:"2-digit",minute:"2-digit"}):"")+(camposSielseHoy[String(x.codigo)]?"\nQué cambió: "+camposSielseHoy[String(x.codigo)].join(", "):"\n(corre el sync diario para ver QUÉ campos cambiaron)")} style={{fontSize:10.5,fontWeight:700,background:"var(--tint-acc-bg)",color:"var(--tint-acc-tx)",border:"1px solid var(--tint-acc-bd)",borderRadius:6,padding:"2px 6px",marginRight:4}}>📤 SIELSE</span>}
              {trabajadoHoy.has(String(x.codigo)) && <span title="Nuestro equipo trabajó este caso HOY (bitácora)" style={{fontSize:10.5,fontWeight:700,background:"var(--tint-green-bg)",color:"var(--tint-green-tx)",border:"1px solid var(--tint-green-bd)",borderRadius:6,padding:"2px 6px"}}>👥 equipo</span>}
              {!esFechaHoy(x.fechaMod) && !trabajadoHoy.has(String(x.codigo)) && <span className="muted" title={"Última modificación en SIELSE: "+(x.fechaMod?fmtFecha(x.fechaMod):"—")} style={{fontSize:10.5}}>{x.fechaMod?fmtFecha(x.fechaMod):"—"}</span>}
            </td>
            <td title="Tipo de resolución histórico SIELSE — no es el avance actual">{x.tipoRes||"—"}</td>
            <td onClick={e=>e.stopPropagation()}>
              {estadoDerivado
                ? <EstadoChip estado={estadoDerivado} prog={prog}/>
                : <select value={x.estado} onChange={e=>updEstado(x.id,e.target.value)} style={{borderLeft:`3px solid ${estadoColor(x.estado)}`}}>{ESTADOS_APP.map(s=><option key={s}>{s}</option>)}</select>}
            </td>
          </tr>
        );})}
      </tbody></table>
    </div>
    {rows.length>maxFilas && (
      <div style={{display:"flex",alignItems:"center",gap:10,marginTop:8}}>
        <span className="muted" style={{fontSize:12}}>Mostrando {maxFilas} de {rows.length} — usa los filtros (⏰ vencimiento, responsable, buscar) para acotar.</span>
        <button className="btn-ghost" style={{fontSize:12}} onClick={()=>setMaxFilas(m=>m+200)}>Mostrar 200 más</button>
        <button className="btn-ghost" style={{fontSize:12}} onClick={()=>setMaxFilas(rows.length)}>Mostrar todos ({rows.length})</button>
      </div>
    )}
  </Card>;
}

function EvidenciasAdmin({ evidencias }){
  return <Card>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
      <h3 style={{margin:0}}>Evidencias en Drive ({evidencias.length})</h3>
      <a className="link" style={{fontSize:12}} href={DRIVE_URL} target="_blank" rel="noreferrer">Abrir carpeta Drive ↗</a>
    </div>
    <div style={{overflowX:"auto"}}><table className="tbl"><thead><tr><th>Expediente</th><th>Etapa</th><th>Documento</th><th>Resp.</th><th>Fecha</th></tr></thead><tbody>
      {evidencias.map((e,i)=><tr key={i}><td className="mono">{e.exp}</td><td>{e.etapa}</td><td><a className="link" href={e.url||DRIVE_URL} target="_blank" rel="noreferrer">{e.nombre}</a></td><td>{e.usuario||wName(e.resp)}</td><td>{e.fecha}</td></tr>)}
    </tbody></table></div>
  </Card>;
}
