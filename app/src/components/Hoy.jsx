// "Hoy": lo urgente del equipo en una sola vista (extraído de App.jsx en F1a; consume useApp()
// desde F1b — ver AppContext.jsx). `sinCasos`/`setTab` siguen por props: son de INSTANCIA
// (el `tab` activo es estado propio de Admin, no estado global).
import { useState } from "react";
import { Kpi, Card } from "./ui.jsx";
import { AtenderPrimero, DineroRiesgo } from "./Equipo.jsx";
import { BienvenidaSinCasos } from "./atoms.jsx";
import { riesgoSAPGlobal } from "../lib/plazosNormativos.js";
import { abiertos, vencidos, porVencer, exposicionTotal, verMontos, activos } from "../lib/tickets.js";
import { puedeDelegar } from "../lib/auth.js";
import { useApp } from "../AppContext.jsx";

// "Hoy": lo urgente del equipo en una sola vista — KPIs + cola priorizada (+ dinero en riesgo, solo Gerente).
export default function Hoy({ sinCasos, setTab }){
  const {
    perfilVista: perfil, data, datos, tickets: allTickets, recByCode,
    onEstadoTicket, onReasignarTicket, onArchivarCaso, onDesarchivar, onArchivarCerrados,
    abrirExp: setSelExp,
  } = useApp();
  // mismo dato que Admin le pasaba antes: la etapa ACTIVA de cada caso (no el histórico crudo)
  const tickets = activos(allTickets);
  const ab=abiertos(tickets), v=vencidos(tickets), pv=porVencer(tickets,2);
  const ger=verMontos(perfil.rol);
  const expo=exposicionTotal(tickets);
  // Riesgo SAP (silencio administrativo positivo, art. 21.1): motor puro en lib/plazosNormativos.js.
  // Necesita TODOS los tickets del caso (no solo el activo) para leer, p.ej., cuándo se abrió
  // Apelación; `tickets` aquí ya viene filtrado a activos desde Shell — es la mejor señal disponible.
  const riesgoSAP = (data && datos) ? riesgoSAPGlobal(data, datos, tickets) : { total:0, casos:[] };
  return <>
    {sinCasos && <BienvenidaSinCasos onIrBandeja={()=>setTab && setTab("bandeja")}/>}
    {/* Grid ÚNICO de KPIs (§F2): auto-fit/minmax — 1 fila en desktop, 2×2 en móvil, sin media
        queries frágiles. Los 5 KPI del Gerente (4 + silencio SAP) viven en la MISMA grilla. */}
    <div className="kpigrid">
      <Kpi label="Casos en curso" value={ab.length} sub="uno por expediente (su etapa actual)"/>
      <Kpi label="Por vencer (≤2d háb.)" value={pv.length} sub="atender hoy" s={pv.length?"ambar":null}/>
      <Kpi label="Vencidos" value={v.length} sub="su etapa actual fuera de plazo" s={v.length?"rojo":null}/>
      {ger && <Kpi label="Dinero en riesgo" value={"S/ "+expo.toLocaleString("es-PE")} sub="de las etapas actuales" s={expo?"rojo":null}/>}
      <Kpi label="Riesgo de silencio +" value={riesgoSAP.total} sub="casos que OSINERGMIN puede dar por GANADOS al usuario (silencio positivo · pen. 5.5)" s={riesgoSAP.total>0?"rojo":null}/>
    </div>
    <div style={{marginTop:14}}>
      <AtenderPrimero tickets={tickets} perfil={perfil} recByCode={recByCode} onEstado={onEstadoTicket} onReasignar={onReasignarTicket} onArchivar={onArchivarCaso} setSelExp={setSelExp}/>
    </div>
    <div style={{marginTop:14}}><ArchivadosPanel data={data} setSelExp={setSelExp} onDesarchivar={onDesarchivar} onArchivarCerrados={puedeDelegar(perfil.rol)||perfil.rol==="GERENTE"?onArchivarCerrados:null}/></div>
    {ger && <div style={{marginTop:14}}><DineroRiesgo tickets={tickets} perfil={perfil} recByCode={recByCode} setSelExp={setSelExp}/></div>}
  </>;
}

// 🗄 Cerrados / Archivados — los casos con estado Cerrado (salieron de la cola y de las alarmas).
function ArchivadosPanel({ data, setSelExp, onDesarchivar, onArchivarCerrados }){
  const [open,setOpen]=useState(false);
  const [q,setQ]=useState("");
  const cerrados=(data||[]).filter(x=>x.estado==="Cerrado" || x.estadoCom==="CERRADO");
  const filtrados=q.trim()? cerrados.filter(x=>(x.osinerg+" "+x.solicitante+" "+x.suministro+" "+x.codigo).toUpperCase().includes(q.trim().toUpperCase())) : cerrados;
  return <Card style={{padding:0}}>
    <div style={{display:"flex",alignItems:"center",gap:8,padding:"11px 14px",borderLeft:"4px solid var(--green)"}}>
      <div onClick={()=>setOpen(o=>!o)} style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",flex:1}}>
        <span style={{color:"var(--mut)",width:14}}>{open?"▾":"▸"}</span>
        <b style={{color:"var(--titulo)",fontSize:13}}>🗄 Cerrados / Archivados</b>
        <span className="muted" style={{fontSize:11}}>{cerrados.length} caso(s) — fuera de la cola y de las alarmas</span>
      </div>
      {onArchivarCerrados && <button className="btn sm" title="Archiva de golpe los que figuran como cerrados en el cuaderno «20 Reclamos Cerrados»" onClick={onArchivarCerrados}>🗄 Archivar cerrados del cuaderno 20</button>}
    </div>
    {open && <div style={{padding:"0 14px 14px"}}>
      <input placeholder="🔎 buscar en archivados (OSINERG · suministro · nombre)…" value={q} onChange={e=>setQ(e.target.value)} style={{width:"100%",maxWidth:420,marginBottom:10,boxSizing:"border-box"}}/>
      {!filtrados.length && <div className="muted" style={{fontSize:12}}>{cerrados.length? "Nada coincide con la búsqueda." : "Aún no hay casos archivados. Usa el 🗄 en la cola para archivar los que ya están cerrados."}</div>}
      <div style={{overflowX:"auto"}}>
        {filtrados.length>0 && <table className="tbl"><thead><tr><th>Nº OSINERG</th><th>Solicitante</th><th>Suministro</th><th>Clase</th><th></th></tr></thead><tbody>
          {filtrados.slice(0,200).map(x=><tr key={x.id} className="clk" onClick={()=>setSelExp(x.id)}>
            <td className="mono">{x.osinerg}</td><td>{x.solicitante}</td><td className="mono">{x.suministro}</td>
            <td>{(x.clase||"").replace("RECLAMOS ","")}</td>
            <td onClick={e=>e.stopPropagation()}>{onDesarchivar && <button className="btn sm" title="Reabrir (vuelve a la cola)" onClick={()=>onDesarchivar(x.codigo)}>↩ Reabrir</button>}</td>
          </tr>)}
        </tbody></table>}
      </div>
      {filtrados.length>200 && <div className="muted" style={{fontSize:11,marginTop:6}}>Mostrando 200 de {filtrados.length}. Afina la búsqueda.</div>}
    </div>}
  </Card>;
}
