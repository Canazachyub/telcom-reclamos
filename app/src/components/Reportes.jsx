// Pestaña "Reportes"/"Cuadernos" (Admin) — extraído de App.jsx en F1a; consume useApp() desde
// F1b (el estado global — data/tickets/registros/datos/evidencias/perfil/deep-link de cuadernos
// — ya NO llega por props, ver AppContext.jsx). Sin props de instancia: Admin la renderiza sin pasarle nada.
import { useEffect, useState, lazy, Suspense } from "react";
import { Kpi, Card, HBars, Donut, SkeletonVista } from "./ui.jsx";
import { TEAM, wName, parseFecha } from "../lib/model.js";
import { loadConfig } from "../lib/api.js";
import ValorizacionMensual from "./ValorizacionMensual.jsx";
import MuestraTrimestral from "./MuestraTrimestral.jsx";
import MejorasTR from "./MejorasTR.jsx";
import { useApp } from "../AppContext.jsx";
// Cuadernos es una sub-pestaña pesada (incluye qrcode) que no se necesita al entrar a Reportes
// (abre en "cartera"): en diferido (F4-B).
const Cuadernos = lazy(() => import("./Cuadernos.jsx"));
// ⚖ Herencia contractual (casos pre-01/07/2026, contratista anterior): mismo patrón diferido.
const HerenciaPanel = lazy(() => import("./HerenciaPanel.jsx"));

// Cartera (antes pestaña "Resumen"): ahora vive dentro de Reportes.
function Cartera({ data, setSelExp }){
  const total=data.length;
  const enAt=data.filter(x=>x.estadoCom==="EN ATENCION").length;
  const cerr=data.filter(x=>x.estado==="Cerrado").length;
  const venc=data.filter(x=>x.vencido).length;
  const apel=data.filter(x=>x.apelacion).length;
  const ext=data.filter(x=>x.resp===0).length;
  const carga=TEAM.map(t=>({nm:t.corto,val:data.filter(x=>x.resp===t.id).length,color:t.color})).filter(x=>x.val>0);
  const estadoSegs=[{name:"En proceso",value:data.filter(x=>x.estado==="En proceso").length,color:"var(--teal)"},{name:"Observado",value:data.filter(x=>x.estado==="Observado").length,color:"var(--amber)"},{name:"Cerrado",value:cerr,color:"var(--green)"}];
  const clases={}; data.forEach(x=>clases[x.clase]=(clases[x.clase]||0)+1);
  const claseSegs=Object.entries(clases).map(([k,v],i)=>({name:k.replace("RECLAMOS ",""),value:v,color:["var(--acc)","var(--purple)","var(--amber)","var(--teal)"][i%4]}));
  const riesgo=data.filter(x=>x.estadoCom==="EN ATENCION" && x.vencido);
  return <>
    <div className="grid g6">
      <Kpi label="Reclamos" value={total} sub="en cartera" s="verde"/>
      <Kpi label="En atención" value={enAt} sub="abiertos" s={enAt?"ambar":"verde"}/>
      <Kpi label="Vencidos" value={venc} sub="fuera de plazo" s={venc?"rojo":"verde"}/>
      <Kpi label="Apelaciones" value={apel} sub="a JARU" s="ambar"/>
      <Kpi label="Cerrados" value={cerr} sub={Math.round(cerr/total*100)+"% del total"} s="verde"/>
      <Kpi label="Externos" value={ext} sub="fuera del equipo" s={ext?"ambar":"verde"}/>
    </div>
    <div className="grid g3" style={{marginTop:14}}>
      <Card span={2}><h3>Carga por responsable</h3><HBars items={carga}/></Card>
      <Card><h3>Cartera por estado</h3><Donut segs={estadoSegs}/></Card>
    </div>
    <div className="grid g2" style={{marginTop:14}}>
      <Card><h3>Por clase de reclamo</h3><Donut segs={claseSegs}/></Card>
      <Card><h3>En atención y vencidos ({riesgo.length})</h3>
        {riesgo.slice(0,8).map(x=>(
          <div className="row" key={x.id} style={{borderLeft:"4px solid var(--red)"}}>
            <div><span className="mono">{x.osinerg}</span> <span className="muted" style={{fontSize:11}}>{x.solicitante} · {wName(x.resp)}</span></div>
            <button className="btn sm" onClick={()=>setSelExp(x.id)}>Ver</button>
          </div>
        ))}
        {!riesgo.length && <div className="muted">Sin vencidos en atención.</div>}
      </Card>
    </div>
  </>;
}

// Definición REAL de cada ACT del contrato (qué cuenta como metrado) — ver 20_Actividades.
const ACT_DEFINICION = {
  "ACT-01": "Proyectos de resolución y actas de trato directo elaborados en el mes (incluye resoluciones de reconsideración)",
  "ACT-02": "Expedientes de apelación elevados a JARU en el mes (Formato 6)",
  "ACT-03": "Expedientes tramitados en 1ª instancia — deben estar CERRADOS en SIELSE (salvo apelación); incluye expedientes de otras sedes",
  "ACT-04": "Muestras trimestrales entregadas (metrado 8 en todo el contrato — penalidad S/2,000 por muestra incumplida)",
  "ACT-05": "Resoluciones notificadas notarialmente (solo ciudad de Cusco)",
};
// P.U. placeholder (reemplazar por los de la oferta económica ganadora). La config del backend
// (hoja `config`: PU_ACT01…PU_ACT05) los sobreescribe si existen y son numéricos.
const PU_DEFAULT = { ACT01: 45, ACT02: 60, ACT03: 25, ACT04: 0, ACT05: 18 };

export default function Reportes(){
  const {
    data, tickets, registros, datos, evidencias, perfilVista: perfil,
    abrirCuad, onCuadAbierto, onVolverExp, abrirExp: setSelExp, refrescar,
  } = useApp();
  const [rtab,setR]=useState("cartera");
  const [config,setConfig]=useState({});
  useEffect(()=>{ loadConfig().then(c=>{ if(c) setConfig(c); }).catch(()=>{}); }, []);
  // deep-link desde la Sala: si piden abrir un cuaderno, salta a la sub-pestaña Cuadernos
  useEffect(()=>{ if(abrirCuad) setR("cuadernos"); }, [abrirCuad]);
  const puNum = (k, fallback) => { const v = config && config[k]; const n = typeof v==="string" ? parseFloat(v) : v; return (typeof n==="number" && !isNaN(n)) ? n : fallback; };
  const PU = {
    ACT01: puNum("PU_ACT01", PU_DEFAULT.ACT01), ACT02: puNum("PU_ACT02", PU_DEFAULT.ACT02),
    ACT03: puNum("PU_ACT03", PU_DEFAULT.ACT03), ACT04: puNum("PU_ACT04", PU_DEFAULT.ACT04),
    ACT05: puNum("PU_ACT05", PU_DEFAULT.ACT05),
  };

  const porResp=TEAM.map(t=>({t,list:data.filter(x=>x.resp===t.id)})).filter(o=>o.list.length);
  const clases={}; data.forEach(x=>clases[x.clase]=(clases[x.clase]||0)+1);
  const cerr=data.filter(x=>x.estado==="Cerrado").length, apel=data.filter(x=>x.apelacion).length;

  // Mes en curso: filtra por la fecha disponible más confiable de cada ACT. Si no hay una
  // fecha confiable para esa actividad, se deja el total histórico (con nota visible).
  const HOY=new Date(), mesAct=HOY.getMonth(), anioAct=HOY.getFullYear();
  const esMesActual = iso => { const d=parseFecha(iso); return d && d.getMonth()===mesAct && d.getFullYear()===anioAct; };
  const cerrMes = data.filter(x=>x.estado==="Cerrado" && esMesActual(x.fechaSol)).length;
  const cerrMesHayFecha = data.some(x=>x.estado==="Cerrado" && x.fechaSol);

  const rows=[
    { act:"ACT-01", nombre:"Resoluciones / trato directo", cant: cerrMesHayFecha?cerrMes:cerr, puK:"ACT01", historico: !cerrMesHayFecha, notaCant:null },
    { act:"ACT-02", nombre:"Elevación apelación", cant: apel, puK:"ACT02", historico:true, notaCant:null },
    { act:"ACT-03", nombre:"Tramitación", cant: data.length, puK:"ACT03", historico:true, notaCant:null },
    { act:"ACT-04", nombre:"Muestra trimestral OSINERGMIN", cant: 0, puK:"ACT04", historico:false, notaCant:"se registra al entregar cada muestra" },
    { act:"ACT-05", nombre:"Notif. notarial", cant: cerrMesHayFecha?cerrMes:cerr, puK:"ACT05", historico: !cerrMesHayFecha, notaCant:null },
  ];
  let tot=0;

  // Gerencia ve todo; el Coordinador solo Cartera + Cuadernos (lo demás lo consolida Gerencia).
  const esGer = perfil?.rol==="GERENTE";
  const subTabs = esGer
    ? [["cartera","Cartera"],["diario","Diario"],["semanal","Semanal"],["mensual","Valorización (estimada)"],["mensualoficial","Valorización oficial"],["muestra","Muestra ACT-04"],["mejoras","Mejoras TR"],["cuadernos","📒 Cuadernos"],["herencia","⚖ Herencia"]]
    : [["cartera","Cartera"],["cuadernos","📒 Cuadernos"],["herencia","⚖ Herencia"]];
  // si el rol actual no puede ver la sub-pestaña seleccionada, cae a Cartera
  const rtabOk = subTabs.some(x=>x[0]===rtab) ? rtab : "cartera";
  return <>
    <div className="tabs">{subTabs.map(x=><button key={x[0]} className={rtabOk===x[0]?"on":""} onClick={()=>setR(x[0])}>{x[1]}</button>)}</div>
    {!esGer && <div className="note" style={{background:"var(--hoverBg)",border:"1px solid var(--acc)",color:"var(--tx)",fontSize:12,marginBottom:12}}>
      📊 Las valorizaciones, informes diario/semanal, Muestra ACT-04 y Mejoras TR los consolida y revisa <b>Gerencia</b>. Aquí trabajas tu <b>Cartera</b>, los <b>Cuadernos</b> del equipo y la <b>⚖ Herencia</b> contractual.
    </div>}
    {rtabOk==="cartera" && <Cartera data={data} setSelExp={setSelExp}/>}
    {rtabOk==="diario" && <Card><h3>Reporte diario por trabajador</h3><div style={{overflowX:"auto"}}><table className="tbl"><thead><tr><th>Trabajador</th><th>Asignados</th><th>En atención</th><th>Cerrados</th><th>Vencidos</th></tr></thead><tbody>
      {porResp.map(o=><tr key={o.t.id}><td><span className="dot" style={{background:o.t.color}}/>{o.t.nombre}</td><td>{o.list.length}</td><td>{o.list.filter(x=>x.estadoCom==="EN ATENCION").length}</td><td>{o.list.filter(x=>x.estado==="Cerrado").length}</td><td style={{color:"var(--red)"}}>{o.list.filter(x=>x.vencido).length||0}</td></tr>)}
    </tbody></table></div></Card>}
    {rtabOk==="semanal" && <Card><h3>Reporte semanal (cartera)</h3>
      <div className="kv"><b>Total</b><span>{data.length}</span></div><div className="kv"><b>Cerrados</b><span>{cerr}</span></div>
      <div className="kv"><b>En atención</b><span>{data.filter(x=>x.estadoCom==="EN ATENCION").length}</span></div><div className="kv"><b>Vencidos</b><span>{data.filter(x=>x.vencido).length}</span></div>
      {Object.entries(clases).map(([k,v])=><div className="kv" key={k}><b>{k}</b><span>{v}</span></div>)}</Card>}
    {rtabOk==="mensual" && <>
      <div className="note" style={{background:"var(--tint-amber-bg)",border:"1px solid var(--tint-amber-bd)",color:"var(--tint-amber-tx)",marginBottom:12}}>
        ⚠ Estimación referencial para seguimiento interno — la valorización oficial exige las 7 relaciones mensuales + acta de capacitación (se genera en la Ola 7).
      </div>
      <Card>
        <h3>Valorización mensual estimada (precios unitarios)</h3>
        <div className="muted" style={{fontSize:11.5,marginBottom:8}}>P.U. referenciales — reemplazar por los de la oferta económica (hoja config: PU_ACT01…PU_ACT05)</div>
        <div style={{overflowX:"auto"}}>
          <table className="tbl"><thead><tr><th>ACT</th><th>Actividad</th><th>¿Qué cuenta?</th><th>Cantidad</th><th>P.U. (S/)</th><th>Subtotal</th></tr></thead><tbody>
            {rows.map((r,i)=>{
              const pu=PU[r.puK]; const st=r.cant*pu; tot+=st;
              return <tr key={i}>
                <td><b>{r.act}</b></td>
                <td>{r.nombre}</td>
                <td style={{fontSize:11.5,color:"var(--mut)",maxWidth:320}}>{ACT_DEFINICION[r.act]}</td>
                <td>
                  {r.cant}
                  {r.notaCant && <div className="muted" style={{fontSize:10}}>({r.notaCant})</div>}
                  {r.historico && !r.notaCant && <div className="muted" style={{fontSize:10}}>(total histórico)</div>}
                </td>
                <td>{pu}</td>
                <td>S/ {st.toLocaleString()}</td>
              </tr>;
            })}
            <tr><td colSpan={5} style={{textAlign:"right"}}><b>Total estimado</b></td><td><b style={{color:"var(--green)"}}>S/ {tot.toLocaleString()}</b></td></tr>
          </tbody></table>
        </div>
      </Card>
    </>}
    {rtabOk==="mensualoficial" && <ValorizacionMensual data={data} tickets={tickets} evidencias={evidencias} registros={registros} datos={datos} config={config} perfil={perfil}/>}
    {rtabOk==="muestra" && <MuestraTrimestral data={data} tickets={tickets} evidencias={evidencias} registros={registros} perfil={perfil} setSelExp={setSelExp}/>}
    {rtabOk==="mejoras" && <MejorasTR data={data} tickets={tickets} datos={datos} registros={registros} perfil={perfil}/>}
    {rtabOk==="cuadernos" && <Suspense fallback={<SkeletonVista/>}><Cuadernos data={data} setSelExp={setSelExp} perfil={perfil} abrir={abrirCuad} onAbierto={onCuadAbierto} onVolver={onVolverExp}/></Suspense>}
    {rtabOk==="herencia" && <Suspense fallback={<SkeletonVista/>}><HerenciaPanel data={data} tickets={tickets} perfil={perfil} refrescar={refrescar}/></Suspense>}
  </>;
}
