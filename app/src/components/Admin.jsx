// Vista "Admin" (Gerente/Coordinador) — extraído de App.jsx en F1a; consume useApp() desde F1b
// (el estado global y los handlers ya NO llegan por props — ver AppContext.jsx). Sigue siendo
// el PUENTE contexto→props para los hijos que aún no migraron (Equipo, Bandeja, Calendario,
// PenalidadesTope, Personal, Conexion): a esos se les sigue pasando por props, tal como antes.
import { useEffect, useState, lazy, Suspense } from "react";
import { AtenderPrimero, ResumenEquipo, DineroRiesgo, ResumenDiario, VerificacionDiaria } from "./Equipo.jsx";
import Calendario from "./Calendario.jsx";
import PenalidadesTope from "./PenalidadesTope.jsx";
import Hoy from "./Hoy.jsx";
import ExpedientesTab from "./Expedientes.jsx";
import Guia from "./Guia.jsx";
import Personal from "./Personal.jsx";
import Conexion from "./Conexion.jsx";
import { MejorasSugeridas } from "./atoms.jsx";
import { SkeletonVista } from "./ui.jsx";
import { loadConfig } from "../lib/api.js";
import { puedeDelegar } from "../lib/auth.js";
import { useApp } from "../AppContext.jsx";
import { activos } from "../lib/tickets.js";
// Bandeja/Reportes son pestañas pesadas que NO se necesitan en el primer render (Admin abre en
// "hoy"): en diferido (F4-B). Cada una llega a su propio chunk.
const Bandeja = lazy(() => import("./Bandeja.jsx"));
const Reportes = lazy(() => import("./Reportes.jsx"));

/* ===================== GERENTE / COORDINADOR ===================== */
// 6 pestañas (7 el Gerente). Todo lo operativo de un expediente se hace DENTRO del
// expediente (Drawer): evidencia, datos de etapa, generar documento, marcar hecho.
export default function Admin(){
  const {
    perfilVista: perfil, data, tickets: todosTickets, recByCode,
    abrirCuad, registros, comentarios, evidencias,
    correos, correosCargando, onRecargarCorreos, onConvertirCorreo, verExpediente,
    abrirExp: setSelExp,
  } = useApp();
  // `tickets` (prop histórica de Admin) = solo la etapa ACTIVA de cada caso; `todosTickets` (del
  // contexto, crudo) = el histórico completo — igual que antes (Shell pasaba ambas variantes).
  const tickets = activos(todosTickets);
  const [tab, setTab] = useState("hoy");
  const canDelegate = puedeDelegar(perfil.rol);
  const esGer = perfil.rol==="GERENTE";
  // deep-link desde la Sala: abrir un cuaderno → salta a la pestaña Reportes (→ sub-pestaña Cuadernos)
  useEffect(()=>{ if(abrirCuad) setTab("reportes"); }, [abrirCuad]);
  // config del backend (hoja `config`: PU_ACT01…, topes de penalidad, etc.) — la necesita
  // PenalidadesTope en la pestaña Equipo; Admin es quien la carga (Reportes ya la carga aparte
  // para la valorización — aquí es una carga propia, más simple que subir el estado más arriba).
  const [configEquipo, setConfigEquipo] = useState({});
  useEffect(()=>{ loadConfig().then(c=>{ if(c) setConfigEquipo(c); }).catch(()=>{}); }, []);
  // El Coordinador ve Cartera + Cuadernos (su operación); las valorizaciones/informes/muestra/Mejoras TR
  // los consolida Gerencia → para el Coordinador la pestaña se llama «Cuadernos», para el Gerente «Reportes».
  const tabs = [["hoy","🏠 Hoy"],["equipo","👥 Equipo"],["expedientes","📁 Expedientes"],["bandeja","📧 Bandeja"],["calendario","📅 Calendario"],
    ["reportes",esGer?"📊 Reportes":"📒 Cuadernos"],["guia","📖 Guía del flujo"],[esGer?"admin":"_","⚙ Administración"]]
    .filter(t=>t[0]!=="_");
  return <>
    <div className="tabs">{tabs.map(t=><button key={t[0]} className={tab===t[0]?"on":""} onClick={()=>setTab(t[0])}>{t[1]}</button>)}</div>
    {/* Hoy/ExpedientesTab/Reportes migraron a useApp() (F1b): ya no repetimos aquí el estado
        global — solo lo que es de instancia (sinCasos/setTab propios de Admin, canDelegate
        derivado del rol). Equipo/Bandeja/Calendario/PenalidadesTope/Personal/Conexion NO
        migraron (fuera de alcance): seguimos siendo su puente contexto→props, igual que antes. */}
    {tab==="hoy"         && <Hoy sinCasos={data.length===0} setTab={setTab}/>}
    {tab==="equipo"      && <><ResumenEquipo tickets={tickets} perfil={perfil}/><div style={{marginTop:14}}><ResumenDiario registros={registros} tickets={tickets}/></div><div style={{marginTop:14}}><VerificacionDiaria tickets={tickets} registros={registros} perfil={perfil}/></div><MejorasSugeridas comentarios={comentarios}/><div style={{marginTop:14}}><PenalidadesTope registros={registros} config={configEquipo} perfil={perfil}/></div></>}
    {tab==="expedientes" && <ExpedientesTab canDelegate={canDelegate}/>}
    {tab==="bandeja"     && <Suspense fallback={<SkeletonVista/>}><Bandeja perfil={perfil} correos={correos} cargando={correosCargando} noDisponible={correos===null && !correosCargando} onRecargar={onRecargarCorreos} existentes={data} onConvertir={onConvertirCorreo} verExpediente={verExpediente}/></Suspense>}
    {tab==="calendario"  && <Calendario tickets={tickets} recByCode={recByCode} perfil={perfil} setSelExp={setSelExp} equipo/>}
    {tab==="reportes"    && <Suspense fallback={<SkeletonVista/>}><Reportes/></Suspense>}
    {tab==="guia"        && <Guia/>}
    {tab==="admin"       && <><Personal data={data}/><div style={{marginTop:14}}><Conexion/></div></>}
  </>;
}
