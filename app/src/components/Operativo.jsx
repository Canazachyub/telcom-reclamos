// Vista "Operativo" (trabajador): 4 pestañas — extraído de App.jsx en F1a; consume useApp()
// desde F1b (el estado global y los handlers ya NO llegan por props — ver AppContext.jsx).
// Sigue siendo el PUENTE contexto→props para MiDia/TrabajoEquipo/Cuadernos/Bandeja/Calendario
// (fuera de alcance de esta fase): a esos se les sigue pasando por props, tal como antes.
import { useEffect, useState, lazy, Suspense } from "react";
import { Card, urgColor, toast, SkeletonVista } from "./ui.jsx";
import { BienvenidaSinCasos, EstadoChip, MiniProgreso } from "./atoms.jsx";
import MiDia from "./MiDia.jsx";
import FlujoCards from "./FlujoCards.jsx";
import TrabajoEquipo from "./TrabajoEquipo.jsx";
import Calendario from "./Calendario.jsx";
import { postAction } from "../lib/api.js";
import { misTickets, abiertos, vencidos, urgColorTicket, activos } from "../lib/tickets.js";
import { ROL_LABEL } from "../lib/auth.js";
import { teamById, ETAPA_ROL, FLUJO, daysLeft, fmtFecha } from "../lib/model.js";
import { useApp } from "../AppContext.jsx";
// Cuadernos/Bandeja son pestañas pesadas que NO se necesitan en el primer render (Operativo
// abre en "midia"): en diferido (F4-B). qrcode (usado por Cuadernos) queda en su propio chunk.
const Cuadernos = lazy(() => import("./Cuadernos.jsx"));
const Bandeja = lazy(() => import("./Bandeja.jsx"));

/* ===================== OPERATIVO ===================== */
// 4 pestañas. El trabajo real (evidencia + datos + documento + marcar hecho) se hace
// dentro del expediente: Mi día → "Abrir y trabajar" → Drawer en la etapa del ticket.
export default function Operativo({ onEscanear }){
  const {
    perfilVista: perfil, data, tickets: allTickets, activoByCode={}, progresoDe, recByCode,
    onEstadoTicket, onTomarTarea, abrirCuad, onCuadAbierto, onVolverExp,
    correos, correosCargando, onRecargarCorreos, onConvertirCorreo, verExpediente,
    abrirExp: setSelExp,
  } = useApp();
  // igual que antes: Shell le pasaba a Operativo los tickets YA filtrados a la etapa activa
  // de cada caso (`activos(tickets)`) — aquí se recalcula del `tickets` crudo del contexto.
  const tickets = activos(allTickets);
  const [tab,setTab]=useState("midia");
  // deep-link desde la Sala: abrir un cuaderno → salta a la pestaña Cuadernos
  useEffect(()=>{ if(abrirCuad) setTab("cuadernos"); }, [abrirCuad]);
  const mine=data.filter(x=>x.resp===perfil.resp_id);
  const misTk=misTickets(tickets||[], perfil);
  // nº de tareas de MIS PARES por tomar (mismo rol, no mías) → badge en la pestaña colaborativa
  const nPozo = abiertos(tickets||[]).filter(t=>ETAPA_ROL[t.etapa]===perfil.rol && t.respId!==perfil.resp_id).length;
  // A4: 4 secciones de primer nivel. «Mi día» es un HUB con sub-vistas (Hoy · Mis expedientes · Equipo · Calendario),
  // para que el trabajador no se pierda entre 7 pestañas. Los bloques de render siguen filtrando por `tab`.
  const MIDIA_GROUP=["midia","expedientes","equipo","calendario"];
  const tabs=[["midia","🏠 Mi día"],["cuadernos","📒 Cuadernos"],["bandeja","📧 Bandeja"],["guia","📖 Mi guía"]];
  const subtabs=[["midia","Hoy"],["expedientes","📁 Mis expedientes"+(mine.length?" ("+mine.length+")":"")],
    ["equipo","🌐 Equipo"+(nPozo?" ("+nPozo+")":"")],["calendario","📅 Calendario"]];
  return <>
    <div className="tabs">{tabs.map(t=><button key={t[0]} className={(t[0]==="midia"?MIDIA_GROUP.includes(tab):tab===t[0])?"on":""} onClick={()=>setTab(t[0])}>{t[1]}{t[0]==="midia"&&nPozo?" ("+nPozo+")":""}</button>)}</div>
    {MIDIA_GROUP.includes(tab) && <div className="tabs" style={{marginTop:-6,marginBottom:10,opacity:.95}}>{subtabs.map(t=><button key={t[0]} className={tab===t[0]?"on":""} onClick={()=>setTab(t[0])} style={{fontSize:12.5,padding:"5px 11px"}}>{t[1]}</button>)}</div>}
    {tab==="midia" && data.length===0 && <BienvenidaSinCasos onIrBandeja={()=>setTab("bandeja")}/>}
    {tab==="midia" && <MiDia perfil={perfil} misReclamos={mine} data={data} tickets={misTk} recByCode={recByCode} onEstadoTicket={onEstadoTicket} setSelExp={setSelExp} onEscanear={onEscanear}
      onCerrarDia={()=>postAction("reporte",{rol:perfil.rol, asignados:mine.length, en_atencion:abiertos(misTk).length, cerrados:misTk.filter(t=>t.hecho).length, vencidos:vencidos(misTk).length})}/>}
    {tab==="equipo" && <TrabajoEquipo perfil={perfil} tickets={tickets} recByCode={recByCode} onTomar={onTomarTarea} onEstado={onEstadoTicket} setSelExp={setSelExp}/>}
    {tab==="cuadernos" && <Suspense fallback={<SkeletonVista/>}><Cuadernos data={data} setSelExp={setSelExp} perfil={perfil} abrir={abrirCuad} onAbierto={onCuadAbierto} onVolver={onVolverExp}/></Suspense>}
    {tab==="bandeja" && <Suspense fallback={<SkeletonVista/>}><Bandeja perfil={perfil} correos={correos} cargando={correosCargando} noDisponible={correos===null && !correosCargando} onRecargar={onRecargarCorreos} existentes={data} onConvertir={onConvertirCorreo} verExpediente={verExpediente}/></Suspense>}
    {tab==="calendario" && <Calendario tickets={misTk} recByCode={recByCode} perfil={perfil} setSelExp={setSelExp}/>}
    {tab==="expedientes" && <Card><h3>Mis expedientes ({mine.length}) — clic para ver su seguimiento</h3><div style={{overflowX:"auto"}}><table className="tbl"><thead><tr><th>Nº OSINERG</th><th>Solicitante</th><th>Suministro</th><th>Clase</th><th>Progreso</th><th>Etapa</th><th>Límite</th><th>Restan</th><th>Estado</th></tr></thead><tbody>
      {mine.slice(0,200).map(x=>{
        const act = activoByCode[String(x.codigo)];
        const prog = progresoDe ? progresoDe(x.codigo) : null;
        const dl = act ? act.diasRestantes : daysLeft(x.fechaLim);
        const limiteTxt = act ? (act.fechaLimite ? fmtFecha(act.fechaLimite) : "—") : fmtFecha(x.fechaLim);
        const restanTxt = act ? (act.diasRestantes==null ? "—" : (act.vencido ? "vencido "+Math.abs(act.diasRestantes)+"d háb." : act.diasRestantes+"d háb.")) : (dl===null?"—":(dl<0?"vencido "+Math.abs(dl)+"d háb.":dl+"d háb."));
        const restanColor = act ? urgColorTicket(act) : urgColor(dl);
        const etapaTxt = act ? act.etapa : x.etapa;
        const estadoDerivado = act
          ? (act.estado==="en_proceso" ? "En proceso" : "Pendiente")
          : (prog && prog.total>0 && prog.hechas===prog.total ? "Completado" : null);
        return <tr key={x.id} className="clk" onClick={()=>setSelExp(x.id)}>
          <td className="mono">{x.osinerg}</td><td>{x.solicitante}</td>
          <td className="mono">{x.suministro}
            {x.suministro && <button className="btn-ghost" title={"Copiar suministro: "+x.suministro}
              onClick={e=>{ e.stopPropagation(); try{ navigator.clipboard.writeText(String(x.suministro)); toast("Suministro copiado: "+x.suministro); }catch(err){ toast("No se pudo copiar"); } }}
              style={{padding:"1px 6px",fontSize:10,marginLeft:6,lineHeight:1.4}}>⧉</button>}
          </td><td>{x.clase.replace("RECLAMOS ","")}</td>
          <td><MiniProgreso prog={prog}/></td>
          <td>{etapaTxt}</td><td>{limiteTxt}</td>
          <td style={{textAlign:"center",color:restanColor}}><b>{restanTxt}</b></td>
          <td><EstadoChip estado={estadoDerivado||x.estado} prog={prog}/></td>
        </tr>;})}
      {!mine.length && <tr><td colSpan={9} className="muted" style={{textAlign:"center",padding:14}}>Sin reclamos asignados. El Coordinador puede delegarte.</td></tr>}
    </tbody></table></div></Card>}
    {tab==="guia" && <Card><h3>Mi guía — {ROL_LABEL[perfil.rol]}</h3>
      <div className="muted" style={{fontSize:12,marginBottom:12}}>Estas son las etapas del flujo a tu cargo. Para cada una: qué hacer, en qué plazo, qué documento entregar como evidencia y qué penalidad evitar.</div>
      <FlujoCards etapas={FLUJO.filter(f=>f.rol.includes((teamById(perfil.resp_id).rol||"").split(" ")[0]))}/>
    </Card>}
  </>;
}
