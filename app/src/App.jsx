import { useEffect, useState } from "react";
import { loadReclamos, loadEvidencias, loadDatos, guardarDatos, loadTickets, updTicket, loadComentarios, comentar, loadRegistros, loadCorreos, postAction, editarReclamo, vincularCorreo, USE_MOCK } from "./lib/api.js";
import { mapTickets, misTickets, activos, abiertos, vencidos, porVencer, exposicionTotal, verMontos, urgColorTicket } from "./lib/tickets.js";
import { getSesionValida, logout, ROL_LABEL, puedeDelegar, puedeVerTodo, esOperativo, USERS } from "./lib/auth.js";
import {
  TEAM, teamById, wName, wColor, ETAPAS, FLUJO, daysLeft, fmtFecha, SHEET_URL, DRIVE_URL, STREAMLIT_URL
} from "./lib/model.js";
import { Kpi, Card, Tag, HBars, Donut, estadoColor, urgColor, toast } from "./components/ui.jsx";
import Drawer from "./components/Drawer.jsx";
import Login from "./components/Login.jsx";
import MiDia from "./components/MiDia.jsx";
import FlujoCards from "./components/FlujoCards.jsx";
import Notificaciones from "./components/Notificaciones.jsx";
import { AtenderPrimero, ResumenEquipo, DineroRiesgo, ResumenDiario } from "./components/Equipo.jsx";
import Calendario from "./components/Calendario.jsx";
import NuevoCaso from "./components/NuevoCaso.jsx";
import Bandeja from "./components/Bandeja.jsx";
import PruebaGuiada from "./components/PruebaGuiada.jsx";
import SalaExpediente from "./components/SalaExpediente.jsx";

const ESTADOS_APP = ["Pendiente","En proceso","Observado","Notificado","Cerrado"];
const iniciales = n => (n||"").split(" ").map(s=>s[0]).slice(0,2).join("").toUpperCase();

// Mini-timeline de puntos (v4, patrón courier): el avance del caso de un vistazo en las tablas.
// rojo = etapa hecha · azul marino con halo = etapa actual · gris = pendiente
function MiniProgreso({ prog }){
  if(!prog || !prog.total) return <span className="muted">—</span>;
  return <div style={{display:"flex",gap:3,alignItems:"center"}} title={"hechas "+prog.hechas+"/"+prog.total}>
    {Array.from({length:prog.total},(_,i)=>{
      const done=i<prog.hechas, act=i===prog.hechas;
      return <i key={i} style={{width:8,height:8,borderRadius:"50%",display:"block",
        background: done?"#E3001B":(act?"#1E3A5F":"#D3DCE8"),
        boxShadow: act?"0 0 0 2px rgba(227,0,27,.25)":"none"}}/>;
    })}
  </div>;
}

// "Ver como": lista de roles que el Gerente puede simular (uno por perfil operativo/coordinación).
// Se arma desde USERS (auth.js) para no duplicar nombres/roles a mano.
const VER_COMO_USUARIOS = ["aaraujo","dmarroquin","amontufar","mleon","mhurtado"];
const VER_COMO_OPCIONES = VER_COMO_USUARIOS.map(u=>USERS.find(x=>x.usuario===u)).filter(Boolean);

export default function App(){
  const [perfil, setPerfil] = useState(getSesionValida());
  if(!perfil) return <Login onLogin={setPerfil}/>;
  return <Shell perfil={perfil} onLogout={()=>{logout();setPerfil(null);}}/>;
}

function Shell({ perfil, onLogout }){
  const [data, setData] = useState(null);
  const [err, setErr]   = useState(null);
  const [selExp, setSelExpId] = useState(null);
  const [selEtapa, setSelEtapa] = useState(null);
  const [salaExp, setSalaExp] = useState(null);   // Sala del expediente (v4): VER y coordinar
  const [nuevo, setNuevo] = useState(false);
  const [evidencias, setEvi] = useState([]);
  const [datos, setDatos] = useState({});
  const [tickets, setTickets] = useState([]);
  const [comentarios, setComentarios] = useState([]);
  const [registros, setRegistros] = useState([]);
  const [correos, setCorreos] = useState(null);       // null = aún no se sabe si el backend soporta action=correos
  const [correosCargando, setCorreosCargando] = useState(false);
  const [correoOrigen, setCorreoOrigen] = useState(null); // correo elegido para "Convertir en caso" -> prefill NuevoCaso

  // "Ver como" (SOLO Gerente): simula el rol de otro usuario en todo el render (Admin/Operativo,
  // MiDia, Bandeja, PruebaGuiada, etc.). La sesión real (token, usuario) NO cambia — todo lo que
  // se guarda sigue viajando con las credenciales reales del Gerente (auditoría intacta).
  const [verComo, setVerComo] = useState(null); // null = vista propia; si no, uno de VER_COMO_OPCIONES
  const perfilVista = verComo ? { ...perfil, nombre:verComo.nombre, rol:verComo.rol, resp_id:verComo.resp_id } : perfil;
  useEffect(()=>{
    loadReclamos().then(setData).catch(e=>setErr(String(e)));
    loadEvidencias().then(ev=>{ if(ev && ev.length) setEvi(prev=>[...ev, ...prev]); }).catch(()=>{});
    loadDatos().then(d=>{ if(d) setDatos(d); }).catch(()=>{});
    loadTickets().then(rows=>{ if(rows && rows.length) setTickets(mapTickets(rows)); }).catch(()=>{});
    loadComentarios().then(c=>{ if(c && c.length) setComentarios(c); }).catch(()=>{});
    loadRegistros().then(r=>{ if(r && r.length) setRegistros(r); }).catch(()=>{});
    cargarCorreos();
  }, []);
  // correos === null  -> el backend todavía no implementa action=correos (aviso de "próximo redeploy")
  // correos === []    -> backend ok, bandeja vacía
  function cargarCorreos(){
    setCorreosCargando(true);
    loadCorreos().then(rows=>{ setCorreos(rows); }).catch(()=>{ setCorreos([]); }).finally(()=>setCorreosCargando(false));
  }
  function convertirCorreoEnCaso(correo){
    // guardamos el id del correo APARTE del prefill: al crear el caso se vincula solo
    setCorreoOrigen({ correoId: correo.id, prefill: { DescripcionReclamo: [correo.asunto, correo.resumen].filter(Boolean).join(" — ") } });
    setNuevo(true);
  }
  // Ficha SIELSE editable: escribe la columna real en el Sheet y refresca la cartera
  // para que TODAS las vistas (tablas, Sala, Drawer, Ficha) queden sincronizadas.
  function onEditarCampo(codigo, campo, valor){
    return editarReclamo(codigo, campo, valor).then(r=>{
      if(r && r.ok!==false){ toast("Guardado ✓ — sincronizado en todo el caso"); refrescar(); }
      else toast("⚠ No se guardó: "+((r&&r.error)||"error"));
      return r;
    });
  }
  function onComentar(obj){ setComentarios(cs=>[obj,...cs]); comentar(obj); }
  function refrescar(){ loadReclamos().then(setData).catch(()=>{}); loadTickets().then(rows=>{ if(rows&&rows.length) setTickets(mapTickets(rows)); }).catch(()=>{}); }
  function onReasignarTicket(t, respId, respNombre){
    setTickets(ts=>ts.map(x=>x.id===t.id?{...x,respId:+respId,responsable:respNombre}:x));
    updTicket(t.id, undefined, t.reclamo, respId, respNombre)
      .then(r=>{ if(r && r.ok===false) toast("⚠ No se guardó la reasignación: "+(r.error||"error")); });
  }

  // Regla v4 (patrón courier): VER un caso abre la SALA; TRABAJARLO abre el Drawer.
  // - clic en fila (sin etapa) → Sala del expediente (seguimiento + colaboración)
  // - desde un ticket / notificación (con etapa) → Drawer directo en ESA etapa (intención de trabajo)
  function abrirExp(id, etapa){
    if(id==null){ setSelExpId(null); setSelEtapa(null); return; }
    if(etapa){ setSelExpId(id); setSelEtapa(etapa); }
    else setSalaExp(id);
  }
  // desde la Sala: "Trabajar esta etapa" abre el Drawer ENCIMA (al cerrarlo vuelves a la Sala)
  function trabajarDesdeSala(id, etapa){ setSelExpId(id); setSelEtapa(etapa || null); }

  // índice reclamo(codigo) -> datos del reclamo (para mostrar OSINERG/solicitante en el ticket)
  const recByCode = {}; (data||[]).forEach(r=>{ recByCode[String(r.codigo)] = r; });

  // ===== EL TICKET ACTIVO ES LA ÚNICA FUENTE DE VERDAD DEL AVANCE =====
  // activoByCode: reclamo(codigo) -> su ticket activo (la etapa viva del caso). Si el caso
  // no tiene tickets en absoluto (aún no migrado a v2), no aparece aquí y las vistas caen
  // al respaldo v1 (campos derivados de SIELSE en `data`).
  const activoByCode = {};
  activos(tickets).forEach(t => { activoByCode[String(t.reclamo)] = t; });
  // progresoDe(codigo): cuenta TODOS los tickets del caso (no solo el activo) para el mini
  // indicador "hechas X/N". Si el caso no tiene tickets, retorna null (no hay progreso v2 que mostrar).
  function progresoDe(codigo){
    const propios = tickets.filter(t => String(t.reclamo) === String(codigo));
    if(!propios.length) return null;
    return { total: propios.length, hechas: propios.filter(t=>t.hecho).length };
  }

  // El TICKET es la única fuente de verdad del avance. Al marcarlo "hecho" se sincroniza
  // la etapa v1 del reclamo (hoja reclamos) para que Expedientes/Reportes no queden desfasados.
  function onEstadoTicket(t, estado){
    setTickets(ts=>ts.map(x=>x.id===t.id?{...x,estado,abierto:(estado==="pendiente"||estado==="en_proceso"),hecho:estado==="hecho"}:x));
    updTicket(t.id, estado, t.reclamo)
      .then(r=>{ if(r && r.ok===false) toast("⚠ No se guardó el cambio de estado: "+(r.error||"error")); });
    if(estado!=="hecho") return;
    const i = ETAPAS.indexOf(t.etapa);
    const rec = (data||[]).find(r=>String(r.codigo)===String(t.reclamo));
    const cur = rec ? ETAPAS.indexOf(rec.etapa) : -1;
    if(i < cur) return;                       // el reclamo ya iba más adelante
    const cierre = t.etapa==="Cierre" || i===ETAPAS.length-1;
    const next = cierre ? "Cierre" : ETAPAS[i+1];
    setData(d=>d.map(r=>String(r.codigo)===String(t.reclamo)
      ? { ...r, etapa: next, ...(cierre?{estado:"Cerrado"}:{}) } : r));
    postAction("avanzar_etapa",{ codigo:t.reclamo, etapa:next });
    if(cierre) postAction("estado",{ codigo:t.reclamo, estado:"Cerrado" });
  }

  async function saveDatos({ exp, etapa, rol, campos }){
    setDatos(prev=>({ ...prev, [exp+"|"+etapa]: { ...(prev[exp+"|"+etapa]||{}), ...campos } }));
    return guardarDatos({ exp, etapa, rol, campos });
  }
  // el backend identifica el reclamo por CodigoReclamo (no por id de fila)
  function delegar(id,newResp){
    const r=(data||[]).find(x=>x.id===id); if(!r) return;
    const m=teamById(+newResp);
    setData(d=>d.map(x=>x.id===id?{...x,resp:+newResp}:x));
    postAction("delegar",{ codigo:r.codigo, resp_id:+newResp, responsableNombre:(+newResp? m.nombre : "Externo / Call Center") });
  }
  function updEstado(id,estado){
    const r=(data||[]).find(x=>x.id===id); if(!r) return;
    setData(d=>d.map(x=>x.id===id?{...x,estado}:x));
    postAction("estado",{ codigo:r.codigo, estado });
  }

  const color = wColor(perfilVista.resp_id) || "#1F4E8C";

  if(err) return <div className="wrap"><div className="card" style={{color:"#DC2626",border:"1px solid #F3B4B4"}}>Error cargando datos: {err}</div></div>;

  const exp = selExp!=null && data ? data.find(x=>x.id===selExp) : null;

  return (
    <div className="wrap">
      <header>
        <div className="brand">
          <img className="logo-img" src="https://ingeneriatelcom.com/assets/images/logo/logo-horizontal.png" alt="INGENIERIA TELCOM"/>
          <div><h1>Plataforma de Reclamos</h1><div className="sub">CP-026-2026-ELSE · Electro Sur Este {data && <span className="muted">· {data.length} reclamos {USE_MOCK?"(data SIELSE · demo)":""}</span>}</div></div>
        </div>
        <div className="usr">
          {perfil.rol==="GERENTE" && (
            <select className="flt" title="Simular la vista de otro rol (solo Gerencia)" value={verComo?verComo.usuario:""} onChange={e=>{ const u=VER_COMO_OPCIONES.find(x=>x.usuario===e.target.value); setVerComo(u||null); }} style={{fontSize:12}}>
              <option value="">Ver como: Yo (Gerente)</option>
              {VER_COMO_OPCIONES.map(u=><option key={u.usuario} value={u.usuario}>{u.nombre.split(" ")[0]} · {ROL_LABEL[u.rol]}</option>)}
            </select>
          )}
          <button className="btn" onClick={()=>setNuevo(true)} title="Registrar un nuevo expediente" style={{fontWeight:600}}>➕ Nuevo caso</button>
          {puedeVerTodo(perfilVista.rol) && <a className="btn-ghost" href={STREAMLIT_URL} target="_blank" rel="noreferrer" title="Abrir herramientas de análisis (Streamlit) en pestaña nueva">🔧 Herramientas</a>}
          {data && <Notificaciones perfil={perfilVista} activosTk={activos(tickets)} recByCode={recByCode} setSelExp={abrirExp}/>}
          <div className="av" style={{background:color}} title={perfilVista.nombre}>{iniciales(perfilVista.nombre)}</div>
          <div className="meta"><div className="n">{perfilVista.nombre}</div><div className="r">{ROL_LABEL[perfilVista.rol]}</div></div>
          <button className="btn-ghost" onClick={onLogout} title="Cerrar sesión">Salir</button>
        </div>
      </header>

      {verComo && (
        <div className="note" style={{background:"#FEF3DF",border:"1px solid #F0C36D",color:"#B45309",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8,marginBottom:14}}>
          <span>👁 Estás viendo la plataforma como <b>{verComo.nombre}</b> ({ROL_LABEL[verComo.rol]}) — modo simulación</span>
          <button className="btn-ghost" onClick={()=>setVerComo(null)} style={{fontWeight:600}}>← Volver a mi vista</button>
        </div>
      )}

      {/* Las vistas de trabajo reciben SOLO el ticket vivo de cada caso (su etapa actual).
          El Drawer recibe todos (muestra el historial completo de etapas del expediente). */}
      {!data ? <div className="card">Cargando reclamos…</div>
        : esOperativo(perfilVista.rol)
          ? <Operativo key={"op-"+perfilVista.resp_id} perfil={perfilVista} data={data} setSelExp={abrirExp} tickets={activos(tickets)} activoByCode={activoByCode} progresoDe={progresoDe} recByCode={recByCode} onEstadoTicket={onEstadoTicket} correos={correos} correosCargando={correosCargando} onRecargarCorreos={cargarCorreos} onConvertirCorreo={convertirCorreoEnCaso} verExpediente={(codigo)=>{ const r=(data||[]).find(x=>String(x.codigo)===String(codigo)); if(r) abrirExp(r.id); }}/>
          : <Admin key={"ad-"+perfilVista.resp_id} perfil={perfilVista} data={data} evidencias={evidencias} setSelExp={abrirExp} delegar={delegar} updEstado={updEstado} tickets={activos(tickets)} activoByCode={activoByCode} progresoDe={progresoDe} recByCode={recByCode} onEstadoTicket={onEstadoTicket} onReasignarTicket={onReasignarTicket} registros={registros} comentarios={comentarios} correos={correos} correosCargando={correosCargando} onRecargarCorreos={cargarCorreos} onConvertirCorreo={convertirCorreoEnCaso} verExpediente={(codigo)=>{ const r=(data||[]).find(x=>String(x.codigo)===String(codigo)); if(r) abrirExp(r.id); }}/>}

      {salaExp!=null && data && (()=>{ const sx=data.find(x=>x.id===salaExp); return sx ? (
        <SalaExpediente exp={sx} tickets={tickets} evidencias={evidencias} registros={registros} comentarios={comentarios} datos={datos} correos={correos}
          perfil={perfilVista} onComentar={onComentar} onTrabajar={trabajarDesdeSala} onEstadoTicket={onEstadoTicket}
          onEditar={(campo,valor)=>onEditarCampo(sx.codigo,campo,valor)} ladoALado={exp!=null} onClose={()=>setSalaExp(null)}/>
      ) : null; })()}
      {exp && <Drawer exp={exp} etapaInicial={selEtapa} evidencias={evidencias} datos={datos} tickets={tickets} perfil={perfilVista} comentarios={comentarios} onComentar={onComentar} onEstadoTicket={onEstadoTicket} onEditar={(campo,valor)=>onEditarCampo(exp.codigo,campo,valor)} onClose={()=>{ setSelExpId(null); setSelEtapa(null); }} onSaveDatos={saveDatos} onSubido={obj=>setEvi(ev=>[obj,...ev])}/>}
      {nuevo && <NuevoCaso perfil={perfilVista} existentes={data||[]} inicial={correoOrigen ? correoOrigen.prefill : null} onClose={()=>{ setNuevo(false); setCorreoOrigen(null); }} onCreado={(codigoNuevo)=>{
        // si el caso nació de un correo de la Bandeja, se vincula solo (adjuntos incluidos)
        if(correoOrigen && correoOrigen.correoId && codigoNuevo){ vincularCorreo(correoOrigen.correoId, codigoNuevo).then(()=>cargarCorreos()).catch(()=>{}); }
        setNuevo(false); setCorreoOrigen(null); refrescar();
      }}/>}
      <PruebaGuiada perfil={perfilVista} sinCasos={!!data && data.length===0}/>

      <footer>React + Vite · backend Apps Script · data real SIELSE · TELCOM ENERGY 2026</footer>
    </div>
  );
}

/* ===================== GERENTE / COORDINADOR ===================== */
// 6 pestañas (7 el Gerente). Todo lo operativo de un expediente se hace DENTRO del
// expediente (Drawer): evidencia, datos de etapa, generar documento, marcar hecho.
function Admin({ perfil, data, evidencias, setSelExp, delegar, updEstado, tickets, activoByCode, progresoDe, recByCode, onEstadoTicket, onReasignarTicket, registros, comentarios, correos, correosCargando, onRecargarCorreos, onConvertirCorreo, verExpediente }){
  const [tab, setTab] = useState("hoy");
  const canDelegate = puedeDelegar(perfil.rol);
  const esGer = perfil.rol==="GERENTE";
  const tabs = [["hoy","🏠 Hoy"],["equipo","👥 Equipo"],["expedientes","📁 Expedientes"],["bandeja","📧 Bandeja"],["calendario","📅 Calendario"],
    ["reportes","📊 Reportes"],["guia","📖 Guía del flujo"],[esGer?"admin":"_","⚙ Administración"]]
    .filter(t=>t[0]!=="_");
  return <>
    <div className="tabs">{tabs.map(t=><button key={t[0]} className={tab===t[0]?"on":""} onClick={()=>setTab(t[0])}>{t[1]}</button>)}</div>
    {tab==="hoy"         && <Hoy perfil={perfil} tickets={tickets} recByCode={recByCode} onEstadoTicket={onEstadoTicket} onReasignarTicket={onReasignarTicket} setSelExp={setSelExp} sinCasos={data.length===0} setTab={setTab}/>}
    {tab==="equipo"      && <><ResumenEquipo tickets={tickets} perfil={perfil}/><div style={{marginTop:14}}><ResumenDiario registros={registros} tickets={tickets}/></div><MejorasSugeridas comentarios={comentarios}/></>}
    {tab==="expedientes" && <ExpedientesTab data={data} setSelExp={setSelExp} delegar={delegar} updEstado={updEstado} canDelegate={canDelegate} evidencias={evidencias} activoByCode={activoByCode} progresoDe={progresoDe}/>}
    {tab==="bandeja"     && <Bandeja perfil={perfil} correos={correos} cargando={correosCargando} noDisponible={correos===null && !correosCargando} onRecargar={onRecargarCorreos} existentes={data} onConvertir={onConvertirCorreo} verExpediente={verExpediente}/>}
    {tab==="calendario"  && <Calendario tickets={tickets} recByCode={recByCode} perfil={perfil} setSelExp={setSelExp} equipo/>}
    {tab==="reportes"    && <Reportes data={data} setSelExp={setSelExp}/>}
    {tab==="guia"        && <Guia/>}
    {tab==="admin"       && <><Personal data={data}/><div style={{marginTop:14}}><Conexion/></div></>}
  </>;
}

// Canal de mejoras: todo comentario que empiece con «MEJORA:» llega aquí para Gerencia/Coordinación.
function MejorasSugeridas({ comentarios }){
  const mejoras=(comentarios||[]).filter(c=>/^\s*MEJORA[:\s]/i.test(c.texto||""));
  return <Card style={{marginTop:14}}>
    <h3>💡 Mejoras sugeridas por el equipo ({mejoras.length})</h3>
    <div className="muted" style={{fontSize:12,marginBottom:8}}>Todo comentario que empiece con «MEJORA:» en las observaciones de un expediente aparece aquí — es el canal del equipo para proponer cómo perfeccionar el sistema.</div>
    {mejoras.map((c,i)=>(
      <div className="row" key={i} style={{borderLeft:"4px solid #7c3aed"}}>
        <div>
          <div style={{fontSize:12.5}}>{String(c.texto).replace(/^\s*MEJORA[:\s]+/i,"")}</div>
          <div className="muted" style={{fontSize:10.5,marginTop:2}}>{c.nombre||c.usuario} · {c.rol} · {c.fecha}{c.reclamo?" · exp …"+String(c.reclamo).slice(-6):""}</div>
        </div>
      </div>
    ))}
    {!mejoras.length && <div className="muted" style={{fontSize:12}}>Aún no hay sugerencias. El equipo puede escribir «MEJORA: …» en las observaciones de cualquier expediente.</div>}
  </Card>;
}

// Card de bienvenida cuando el sistema arranca EN BLANCO (0 reclamos) para operación real:
// guía al líder a registrar el primer caso real desde la Bandeja (75 correos reales de ELSE
// ya sincronizados) o con "Nuevo caso" si tiene el expediente físico escaneado.
function BienvenidaSinCasos({ onIrBandeja }){
  return (
    <Card style={{ marginBottom: 14, border: "1px solid #A9C3E4", background: "#EAF1F9" }}>
      <h3 style={{ margin: "0 0 6px" }}>Sistema en blanco — arranque de operación real</h3>
      <div style={{ fontSize: 13, lineHeight: 1.6, color: "var(--tx)" }}>
        Los reclamos reales están llegando por correo: abre la <b>Bandeja</b> y registra el primero con <b>«Convertir en caso»</b>, o usa <b>«Nuevo caso»</b> si tienes el expediente escaneado.
        Pulsa <b>«Prueba guiada»</b> (abajo a la derecha) para la guía paso a paso.
      </div>
      {onIrBandeja && (
        <div style={{ marginTop: 10 }}>
          <button className="btn sm" style={{ background: "#1F4E8C", color: "#fff", fontWeight: 600 }} onClick={onIrBandeja}>📧 Ir a la Bandeja</button>
        </div>
      )}
    </Card>
  );
}

// "Hoy": lo urgente del equipo en una sola vista — KPIs + cola priorizada (+ dinero en riesgo, solo Gerente).
function Hoy({ perfil, tickets, recByCode, onEstadoTicket, onReasignarTicket, setSelExp, sinCasos, setTab }){
  const ab=abiertos(tickets), v=vencidos(tickets), pv=porVencer(tickets,2);
  const ger=verMontos(perfil.rol);
  const expo=exposicionTotal(tickets);
  return <>
    {sinCasos && <BienvenidaSinCasos onIrBandeja={()=>setTab && setTab("bandeja")}/>}
    <div className={"grid "+(ger?"g4":"g3")}>
      <Kpi label="Casos en curso" value={ab.length} sub="uno por expediente (su etapa actual)" s="verde"/>
      <Kpi label="Por vencer (≤2d háb.)" value={pv.length} sub="atender hoy" s={pv.length?"ambar":"verde"}/>
      <Kpi label="Vencidos" value={v.length} sub="su etapa actual fuera de plazo" s={v.length?"rojo":"verde"}/>
      {ger && <Kpi label="Dinero en riesgo" value={"S/ "+expo.toLocaleString("es-PE")} sub="de las etapas actuales" s={expo?"rojo":"verde"}/>}
    </div>
    <div style={{marginTop:14}}>
      <AtenderPrimero tickets={tickets} perfil={perfil} recByCode={recByCode} onEstado={onEstadoTicket} onReasignar={onReasignarTicket} setSelExp={setSelExp}/>
    </div>
    {ger && <div style={{marginTop:14}}><DineroRiesgo tickets={tickets} perfil={perfil} recByCode={recByCode} setSelExp={setSelExp}/></div>}
  </>;
}

function ExpedientesTab({ data, setSelExp, delegar, updEstado, canDelegate, evidencias, activoByCode, progresoDe }){
  const [sub,setSub]=useState("lista");
  return <>
    <div className="tabs">{[["lista","Expedientes"],["evidencias","Evidencias subidas ("+evidencias.length+")"]].map(t=>
      <button key={t[0]} className={sub===t[0]?"on":""} onClick={()=>setSub(t[0])}>{t[1]}</button>)}</div>
    {sub==="lista" && <Expedientes data={data} setSelExp={setSelExp} delegar={delegar} updEstado={updEstado} canDelegate={canDelegate} activoByCode={activoByCode} progresoDe={progresoDe}/>}
    {sub==="evidencias" && <EvidenciasAdmin evidencias={evidencias}/>}
  </>;
}

// Cartera (antes pestaña "Resumen"): ahora vive dentro de Reportes.
function Cartera({ data, setSelExp }){
  const total=data.length;
  const enAt=data.filter(x=>x.estadoCom==="EN ATENCION").length;
  const cerr=data.filter(x=>x.estado==="Cerrado").length;
  const venc=data.filter(x=>x.vencido).length;
  const apel=data.filter(x=>x.apelacion).length;
  const ext=data.filter(x=>x.resp===0).length;
  const carga=TEAM.map(t=>({nm:t.corto,val:data.filter(x=>x.resp===t.id).length,color:t.color})).filter(x=>x.val>0);
  const estadoSegs=[{name:"En proceso",value:data.filter(x=>x.estado==="En proceso").length,color:"#0e7490"},{name:"Observado",value:data.filter(x=>x.estado==="Observado").length,color:"#C9821B"},{name:"Cerrado",value:cerr,color:"#1E8E5A"}];
  const clases={}; data.forEach(x=>clases[x.clase]=(clases[x.clase]||0)+1);
  const claseSegs=Object.entries(clases).map(([k,v],i)=>({name:k.replace("RECLAMOS ",""),value:v,color:["#1F4E8C","#7c3aed","#b45309","#0e7490"][i%4]}));
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
          <div className="row" key={x.id} style={{borderLeft:"4px solid #C0392B"}}>
            <div><span className="mono">{x.osinerg}</span> <span className="muted" style={{fontSize:11}}>{x.solicitante} · {wName(x.resp)}</span></div>
            <button className="btn sm" onClick={()=>setSelExp(x.id)}>Ver</button>
          </div>
        ))}
        {!riesgo.length && <div className="muted">Sin vencidos en atención.</div>}
      </Card>
    </div>
  </>;
}

function Expedientes({ data, setSelExp, delegar, updEstado, canDelegate, activoByCode={}, progresoDe }){
  const [filt,setFilt]=useState({resp:"all",etapa:"all",estado:"all",q:""});
  let list=data.filter(x=>{
    if(filt.resp!=="all" && String(x.resp)!==String(filt.resp)) return false;
    if(filt.etapa!=="all" && x.etapa!==filt.etapa) return false;
    if(filt.estado!=="all" && x.estado!==filt.estado) return false;
    if(filt.q){ const q=filt.q.toLowerCase(); if(!`${x.osinerg} ${x.codigo} ${x.solicitante} ${x.suministro}`.toLowerCase().includes(q)) return false; }
    return true;
  });
  return <Card>
    <div style={{display:"flex",flexWrap:"wrap",justifyContent:"space-between",gap:8,alignItems:"center"}}>
      <h3 style={{margin:0}}>Expedientes — clic en una fila para ver su flujo ({list.length}/{data.length})</h3>
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
        <input className="flt" placeholder="Buscar nº / solicitante / suministro" value={filt.q} onChange={e=>setFilt({...filt,q:e.target.value})} style={{minWidth:220}}/>
        <select className="flt" value={filt.resp} onChange={e=>setFilt({...filt,resp:e.target.value})}><option value="all">Resp: todos</option>{TEAM.map(t=><option key={t.id} value={t.id}>{t.corto}</option>)}<option value={0}>Externos</option></select>
        <select className="flt" value={filt.etapa} onChange={e=>setFilt({...filt,etapa:e.target.value})}><option value="all">Todas las etapas</option>{ETAPAS.map(e=><option key={e}>{e}</option>)}</select>
        <select className="flt" value={filt.estado} onChange={e=>setFilt({...filt,estado:e.target.value})}><option value="all">Todos los estados</option>{ESTADOS_APP.map(e=><option key={e}>{e}</option>)}</select>
      </div>
    </div>
    <div style={{overflowX:"auto"}}>
      <table className="tbl"><thead><tr><th>Nº OSINERG</th><th>Solicitante</th><th>Suministro</th><th>Clase</th><th>Progreso</th><th>Etapa</th><th>Responsable</th><th>Límite</th><th>Restan</th><th title="Tipo de resolución histórico registrado en SIELSE — dato informativo, no refleja el avance actual del ticket">Resolución (histórico SIELSE)</th><th>Estado</th></tr></thead><tbody>
        {list.slice(0,200).map(x=>{
          const act = activoByCode[String(x.codigo)];
          const prog = progresoDe ? progresoDe(x.codigo) : null;
          const dl = act ? act.diasRestantes : daysLeft(x.fechaLim);
          const limiteTxt = act ? (act.fechaLimite ? fmtFecha(act.fechaLimite) : "—") : fmtFecha(x.fechaLim);
          const restanTxt = act ? (act.diasRestantes==null ? "—" : (act.vencido ? "vencido "+Math.abs(act.diasRestantes)+"d háb." : act.diasRestantes+"d háb.")) : (dl===null?"—":dl+"d");
          const restanColor = act ? urgColorTicket(act) : urgColor(dl);
          const etapaTxt = act ? act.etapa : x.etapa;
          // Estado mostrado: si hay ticket activo, deriva de su estado; si no hay ticket pero
          // el caso tiene tickets todos hechos, "Completado"; si no tiene tickets, el select v1 (respaldo).
          const tieneTickets = act || prog;
          const estadoDerivado = act
            ? (act.estado==="en_proceso" ? "En proceso" : "Pendiente")
            : (prog && prog.total>0 && prog.hechas===prog.total ? "Completado" : null);
          return (
          <tr key={x.id} className="clk" onClick={()=>setSelExp(x.id)}>
            <td className="mono">{x.osinerg}</td><td>{x.solicitante}</td><td>{x.suministro}</td>
            <td style={{maxWidth:150,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{x.clase.replace("RECLAMOS ","")}</td>
            <td><MiniProgreso prog={prog}/></td>
            <td>{etapaTxt}</td>
            <td onClick={e=>e.stopPropagation()}>{canDelegate
              ? <select value={x.resp} onChange={e=>delegar(x.id,e.target.value)} style={{borderLeft:`3px solid ${wColor(x.resp)}`}}>{TEAM.map(t=><option key={t.id} value={t.id}>{t.corto} · {t.rol}</option>)}<option value={0}>Externo / Call Center</option></select>
              : <span><span className="dot" style={{background:wColor(x.resp)}}/>{wName(x.resp)}</span>}</td>
            <td>{limiteTxt}</td>
            <td style={{textAlign:"center"}}><b style={{color:restanColor}}>{restanTxt}</b></td>
            <td title="Tipo de resolución histórico SIELSE — no es el avance actual">{x.tipoRes||"—"}</td>
            <td onClick={e=>e.stopPropagation()}>
              {estadoDerivado
                ? <>
                    <Tag bg={estadoColor(estadoDerivado)} color="#fff">{estadoDerivado}</Tag>
                    {prog && <div className="muted" style={{fontSize:10,marginTop:3}}>hechas {prog.hechas}/{prog.total}</div>}
                  </>
                : <select value={x.estado} onChange={e=>updEstado(x.id,e.target.value)} style={{borderLeft:`3px solid ${estadoColor(x.estado)}`}}>{ESTADOS_APP.map(s=><option key={s}>{s}</option>)}</select>}
            </td>
          </tr>
        );})}
      </tbody></table>
    </div>
    {list.length>200 && <div className="muted" style={{marginTop:8,fontSize:12}}>Mostrando 200 de {list.length}.</div>}
  </Card>;
}

function Reportes({ data, setSelExp }){
  const [rtab,setR]=useState("cartera");
  const porResp=TEAM.map(t=>({t,list:data.filter(x=>x.resp===t.id)})).filter(o=>o.list.length);
  const clases={}; data.forEach(x=>clases[x.clase]=(clases[x.clase]||0)+1);
  const cerr=data.filter(x=>x.estado==="Cerrado").length, apel=data.filter(x=>x.apelacion).length;
  const rows=[["ACT-01","Resoluciones / trato directo",cerr,45],["ACT-02","Elevación apelación",apel,60],["ACT-03","Tramitación",data.length,25],["ACT-05","Notif. notarial",cerr,18]];
  let tot=0;
  return <>
    <div className="tabs">{[["cartera","Cartera"],["diario","Diario"],["semanal","Semanal"],["mensual","Valorización"]].map(x=><button key={x[0]} className={rtab===x[0]?"on":""} onClick={()=>setR(x[0])}>{x[1]}</button>)}</div>
    {rtab==="cartera" && <Cartera data={data} setSelExp={setSelExp}/>}
    {rtab==="diario" && <Card><h3>Reporte diario por trabajador</h3><div style={{overflowX:"auto"}}><table className="tbl"><thead><tr><th>Trabajador</th><th>Asignados</th><th>En atención</th><th>Cerrados</th><th>Vencidos</th></tr></thead><tbody>
      {porResp.map(o=><tr key={o.t.id}><td><span className="dot" style={{background:o.t.color}}/>{o.t.nombre}</td><td>{o.list.length}</td><td>{o.list.filter(x=>x.estadoCom==="EN ATENCION").length}</td><td>{o.list.filter(x=>x.estado==="Cerrado").length}</td><td style={{color:"#C9821B"}}>{o.list.filter(x=>x.vencido).length||0}</td></tr>)}
    </tbody></table></div></Card>}
    {rtab==="semanal" && <Card><h3>Reporte semanal (cartera)</h3>
      <div className="kv"><b>Total</b><span>{data.length}</span></div><div className="kv"><b>Cerrados</b><span>{cerr}</span></div>
      <div className="kv"><b>En atención</b><span>{data.filter(x=>x.estadoCom==="EN ATENCION").length}</span></div><div className="kv"><b>Vencidos</b><span>{data.filter(x=>x.vencido).length}</span></div>
      {Object.entries(clases).map(([k,v])=><div className="kv" key={k}><b>{k}</b><span>{v}</span></div>)}</Card>}
    {rtab==="mensual" && <Card><h3>Valorización mensual estimada (precios unitarios)</h3><div style={{overflowX:"auto"}}><table className="tbl"><thead><tr><th>ACT</th><th>Actividad</th><th>Cantidad</th><th>P.U. (S/)</th><th>Subtotal</th></tr></thead><tbody>
      {rows.map((r,i)=>{const st=r[2]*r[3];tot+=st;return <tr key={i}><td><b>{r[0]}</b></td><td>{r[1]}</td><td>{r[2]}</td><td>{r[3]}</td><td>S/ {st.toLocaleString()}</td></tr>;})}
      <tr><td colSpan={4} style={{textAlign:"right"}}><b>Total estimado</b></td><td><b style={{color:"#1E8E5A"}}>S/ {tot.toLocaleString()}</b></td></tr>
    </tbody></table></div></Card>}
  </>;
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

// Guía del flujo: las 10 etapas (qué, quién, plazo, evidencia) + normativa y penalidades. Solo consulta.
function Guia(){
  return <>
    <Card><h3>Áreas de trabajo — qué hace cada rol, su plazo y su evidencia</h3>
      <div className="muted" style={{fontSize:12,marginBottom:12}}>Flujo completo del expediente (10 etapas). Cada tarjeta indica el rol responsable, qué hace, el plazo, la evidencia que sube a Drive y la penalidad que se evita.</div>
      <FlujoCards etapas={FLUJO} showRol/></Card>
    <div style={{marginTop:14}}><Norma/></div>
  </>;
}

function Norma(){
  return <>
    <Card><h3>Flujo · plazos · penalidades</h3><div style={{overflowX:"auto"}}><table className="tbl"><thead><tr><th>Etapa</th><th>Responsable</th><th>ACT</th><th>Plazo</th><th>Penalidad</th></tr></thead><tbody>
      {FLUJO.map(f=><tr key={f.etapa}><td><b>{f.etapa}</b></td><td>{f.rol}</td><td>{f.act}</td><td>{f.plazo}</td><td>{f.pen==="—"?<span className="muted">—</span>:<Tag>{f.pen}</Tag>}</td></tr>)}
    </tbody></table></div></Card>
    <div className="grid g2" style={{marginTop:14}}>
      <Card><h3>Normativa</h3><div style={{lineHeight:2}}><a className="link" href="../../60_Normativa/Indice-Normativa.md" target="_blank" rel="noreferrer">Índice de normativa</a> · <a className="link" href="../../00_MOC/MOC-Plazos.md" target="_blank" rel="noreferrer">Plazos</a> · <a className="link" href="../../40_Penalidades/Escala-Penalidades.md" target="_blank" rel="noreferrer">Escala de penalidades</a></div></Card>
      <Card><h3>Penalidades clave</h3>
        <div className="kv"><b>5.5</b><span>Silencio positivo JARU — S/300 + monto</span></div>
        <div className="kv"><b>5.9</b><span>Resolución mal motivada — S/100 + monto</span></div>
        <div className="kv"><b>5.10</b><span>Apelación fuera de plazo — S/300 + monto</span></div>
        <div className="kv"><b>5.12</b><span>Notif. notarial tardía — S/300 + monto</span></div>
        <div className="note" style={{background:"var(--card2)",color:"var(--tx2)"}}>Tope: 10% del contrato → ELSE puede resolver.</div></Card>
    </div>
  </>;
}

function Personal({ data }){
  const cvm={1:"Araujo",2:"Marroquin",3:"Vargas",4:"Montufar",5:"Leon",6:"Condori",7:"Jara",8:"Hurtado"};
  return <Card><h3>Personal — carga y CV</h3><div style={{overflowX:"auto"}}><table className="tbl"><thead><tr><th>Nombre</th><th>Rol</th><th>Reclamos</th><th>En atención</th><th>CV</th></tr></thead><tbody>
    {TEAM.map(t=>{const l=data.filter(x=>x.resp===t.id);return <tr key={t.id}><td><span className="dot" style={{background:t.color}}/>{t.nombre}</td><td>{t.rol}</td><td>{l.length}</td><td>{l.filter(x=>x.estadoCom==="EN ATENCION").length}</td><td><a className="link" href={"../../70_Personal/CV-"+cvm[t.id]+".md"} target="_blank" rel="noreferrer">ver CV ↗</a></td></tr>;})}
    <tr><td className="muted">Externos / Call Center</td><td className="muted">No es del equipo</td><td>{data.filter(x=>x.resp===0).length}</td><td>{data.filter(x=>x.resp===0&&x.estadoCom==="EN ATENCION").length}</td><td>—</td></tr>
  </tbody></table></div></Card>;
}

function Conexion(){
  const tabs=[["usuarios","id, usuario, pin_hash, nombre, rol, resp_id, activo"],["reclamos","45 columnas SIELSE + resp_id, etapa, estado_app, carpeta_drive"],["registros","fecha, tipo, reclamo, usuario, detalle (log único append-only)"],["tickets","ticket_id, reclamo, etapa, responsable, estado, fecha_limite, vencido, exposicion (v2)"],["etapas / penalidades / feriados","catálogos v2 (sembrados por setupV2)"],["datos_etapa / archivos / calendario","operativas v2"]];
  return <Card><h3>Conexión a Google Sheets + Drive (Apps Script)</h3>
    <div className="row"><span>Google Sheets (base de datos)</span><a className="link" href={SHEET_URL} target="_blank" rel="noreferrer">abrir hoja ↗</a></div>
    <div className="row"><span>Google Drive (evidencias)</span><a className="link" href={DRIVE_URL} target="_blank" rel="noreferrer">abrir carpeta ↗</a></div>
    <div style={{fontSize:12,color:"var(--tx2)",margin:"12px 0 4px"}}><b>Hojas del libro:</b></div>
    <div style={{overflowX:"auto"}}><table className="tbl"><thead><tr><th>Hoja</th><th>Columnas</th></tr></thead><tbody>{tabs.map(t=><tr key={t[0]}><td><b className="mono">{t[0]}</b></td><td className="muted">{t[1]}</td></tr>)}</tbody></table></div>
    <div className="note" style={{background:"#EAF1F9",border:"1px solid #A9C3E4",color:"var(--tx2)"}}><b>Activación:</b> 1) setup() y setupV2() en Apps Script · 2) generarTickets() + trigger horario recalcularPlazos() · 3) publicar Web App (redeploy) · 4) api.js: APPS_SCRIPT_URL actualizada.</div>
  </Card>;
}

/* ===================== OPERATIVO ===================== */
// 4 pestañas. El trabajo real (evidencia + datos + documento + marcar hecho) se hace
// dentro del expediente: Mi día → "Abrir y trabajar" → Drawer en la etapa del ticket.
function Operativo({ perfil, data, setSelExp, tickets, activoByCode={}, progresoDe, recByCode, onEstadoTicket, correos, correosCargando, onRecargarCorreos, onConvertirCorreo, verExpediente }){
  const [tab,setTab]=useState("midia");
  const mine=data.filter(x=>x.resp===perfil.resp_id);
  const misTk=misTickets(tickets||[], perfil);
  const tabs=[["midia","🏠 Mi día"],["expedientes","📁 Mis expedientes"],["bandeja","📧 Bandeja"],["calendario","📅 Mi calendario"],["guia","📖 Mi guía"]];
  return <>
    <div className="tabs">{tabs.map(t=><button key={t[0]} className={tab===t[0]?"on":""} onClick={()=>setTab(t[0])}>{t[1]}</button>)}</div>
    {tab==="midia" && data.length===0 && <BienvenidaSinCasos onIrBandeja={()=>setTab("bandeja")}/>}
    {tab==="midia" && <MiDia perfil={perfil} misReclamos={mine} tickets={misTk} recByCode={recByCode} onEstadoTicket={onEstadoTicket} setSelExp={setSelExp}
      onCerrarDia={()=>postAction("reporte",{rol:perfil.rol, asignados:mine.length, en_atencion:abiertos(misTk).length, cerrados:misTk.filter(t=>t.hecho).length, vencidos:vencidos(misTk).length})}/>}
    {tab==="bandeja" && <Bandeja perfil={perfil} correos={correos} cargando={correosCargando} noDisponible={correos===null && !correosCargando} onRecargar={onRecargarCorreos} existentes={data} onConvertir={onConvertirCorreo} verExpediente={verExpediente}/>}
    {tab==="calendario" && <Calendario tickets={misTk} recByCode={recByCode} perfil={perfil} setSelExp={setSelExp}/>}
    {tab==="expedientes" && <Card><h3>Mis expedientes ({mine.length}) — clic para ver su seguimiento</h3><div style={{overflowX:"auto"}}><table className="tbl"><thead><tr><th>Nº OSINERG</th><th>Solicitante</th><th>Suministro</th><th>Clase</th><th>Progreso</th><th>Etapa</th><th>Límite</th><th>Restan</th><th>Estado</th></tr></thead><tbody>
      {mine.slice(0,200).map(x=>{
        const act = activoByCode[String(x.codigo)];
        const prog = progresoDe ? progresoDe(x.codigo) : null;
        const dl = act ? act.diasRestantes : daysLeft(x.fechaLim);
        const limiteTxt = act ? (act.fechaLimite ? fmtFecha(act.fechaLimite) : "—") : fmtFecha(x.fechaLim);
        const restanTxt = act ? (act.diasRestantes==null ? "—" : (act.vencido ? "vencido "+Math.abs(act.diasRestantes)+"d háb." : act.diasRestantes+"d háb.")) : (dl===null?"—":dl+"d");
        const restanColor = act ? urgColorTicket(act) : urgColor(dl);
        const etapaTxt = act ? act.etapa : x.etapa;
        const estadoDerivado = act
          ? (act.estado==="en_proceso" ? "En proceso" : "Pendiente")
          : (prog && prog.total>0 && prog.hechas===prog.total ? "Completado" : null);
        return <tr key={x.id} className="clk" onClick={()=>setSelExp(x.id)}>
          <td className="mono">{x.osinerg}</td><td>{x.solicitante}</td><td>{x.suministro}</td><td>{x.clase.replace("RECLAMOS ","")}</td>
          <td><MiniProgreso prog={prog}/></td>
          <td>{etapaTxt}</td><td>{limiteTxt}</td>
          <td style={{textAlign:"center",color:restanColor}}><b>{restanTxt}</b></td>
          <td>
            <Tag bg={estadoColor(estadoDerivado||x.estado)} color="#fff">{estadoDerivado||x.estado}</Tag>
            {prog && <div className="muted" style={{fontSize:10,marginTop:3}}>hechas {prog.hechas}/{prog.total}</div>}
          </td>
        </tr>;})}
      {!mine.length && <tr><td colSpan={9} className="muted" style={{textAlign:"center",padding:14}}>Sin reclamos asignados. El Coordinador puede delegarte.</td></tr>}
    </tbody></table></div></Card>}
    {tab==="guia" && <Card><h3>Mi guía — {ROL_LABEL[perfil.rol]}</h3>
      <div className="muted" style={{fontSize:12,marginBottom:12}}>Estas son las etapas del flujo a tu cargo. Para cada una: qué hacer, en qué plazo, qué documento entregar como evidencia y qué penalidad evitar.</div>
      <FlujoCards etapas={FLUJO.filter(f=>f.rol.includes((teamById(perfil.resp_id).rol||"").split(" ")[0]))}/>
    </Card>}
  </>;
}
