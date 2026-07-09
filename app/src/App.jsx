import { useEffect, useState } from "react";
import { loadReclamos, loadRegistrosBundle, guardarDatos, loadTickets, updTicket, tomarTarea, archivarCaso, archivarCerrados, desarchivarCaso, subirArchivo, comentar, loadRegistros, loadCorreos, postAction, editarReclamo, eliminarReclamo, vincularCorreo, loadConfig, USE_MOCK } from "./lib/api.js";
import { mapTickets, misTickets, activos, abiertos, vencidos, porVencer, exposicionTotal, verMontos, urgColorTicket } from "./lib/tickets.js";
import { getSesionValida, logout, ROL_LABEL, puedeDelegar, puedeVerTodo, esOperativo, USERS } from "./lib/auth.js";
import {
  TEAM, teamById, wName, wColor, ETAPAS, ETAPA_ROL, FLUJO, daysLeft, fmtFecha, parseFecha, SHEET_URL, DRIVE_URL, STREAMLIT_URL
} from "./lib/model.js";
import { Kpi, Card, Tag, HBars, Donut, estadoColor, urgColor, toast } from "./components/ui.jsx";
import Drawer from "./components/Drawer.jsx";
import Login from "./components/Login.jsx";
import MiDia from "./components/MiDia.jsx";
import FlujoCards from "./components/FlujoCards.jsx";
import Notificaciones from "./components/Notificaciones.jsx";
import { AtenderPrimero, ResumenEquipo, DineroRiesgo, ResumenDiario, VerificacionDiaria } from "./components/Equipo.jsx";
import Calendario from "./components/Calendario.jsx";
import NuevoCaso from "./components/NuevoCaso.jsx";
import Bandeja from "./components/Bandeja.jsx";
import PruebaGuiada from "./components/PruebaGuiada.jsx";
import SalaExpediente from "./components/SalaExpediente.jsx";
import ValorizacionMensual from "./components/ValorizacionMensual.jsx";
import MuestraTrimestral from "./components/MuestraTrimestral.jsx";
import MejorasTR from "./components/MejorasTR.jsx";
import Cuadernos from "./components/Cuadernos.jsx";
import TrabajoEquipo from "./components/TrabajoEquipo.jsx";
import BuscadorGlobal from "./components/BuscadorGlobal.jsx";
import EscanearQR from "./components/EscanearQR.jsx";
import PenalidadesTope from "./components/PenalidadesTope.jsx";
import { riesgoSAPGlobal } from "./lib/plazosNormativos.js";

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
const VER_COMO_USUARIOS = ["aaraujo","dmarroquin","jvargas","amontufar","mleon","jcondori","aramos","mhurtado"];
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
  const [archivar, setArchivar] = useState(null);     // {codigo, rec} → modal de archivar caso (con foliado opcional)
  const [sumPend, setSumPend] = useState(()=>{ try{ return new URLSearchParams(window.location.search).get("sum")||""; }catch(e){ return ""; } }); // deep-link QR
  const [sumPicker, setSumPicker] = useState(null);   // {sum, matches} — el suministro tiene >1 reclamo, elegir
  const [buscarOpen, setBuscarOpen] = useState(false); // 🔎 buscador global (Ctrl+K)
  const [escanearOpen, setEscanearOpen] = useState(false); // 📷 escáner de QR (cámara)
  const [abrirCuad, setAbrirCuad] = useState(null);   // deep-link: {fuente, q} para abrir un cuaderno FILTRADO (desde la Sala)
  const [volverExp, setVolverExp] = useState(null);   // id del expediente al que "← Volver" desde el cuaderno
  function irACuaderno(fuente, q, expId){ setSalaExp(null); setSelExpId(null); setSelEtapa(null); setVolverExp(expId); setAbrirCuad({ fuente, q }); }
  function volverAlExp(){ const id=volverExp; setAbrirCuad(null); setVolverExp(null); if(id!=null) setSalaExp(id); }
  const [correoOrigen, setCorreoOrigen] = useState(null); // correo elegido para "Convertir en caso" -> prefill NuevoCaso

  // "Ver como" (SOLO Gerente): simula el rol de otro usuario en todo el render (Admin/Operativo,
  // MiDia, Bandeja, PruebaGuiada, etc.). La sesión real (token, usuario) NO cambia — todo lo que
  // se guarda sigue viajando con las credenciales reales del Gerente (auditoría intacta).
  const [verComo, setVerComo] = useState(null); // null = vista propia; si no, uno de VER_COMO_OPCIONES
  const perfilVista = verComo ? { ...perfil, nombre:verComo.nombre, rol:verComo.rol, resp_id:verComo.resp_id } : perfil;
  useEffect(()=>{
    loadReclamos().then(setData).catch(e=>setErr(String(e)));
    loadTickets().then(rows=>{ if(rows && rows.length) setTickets(mapTickets(rows)); }).catch(()=>{});
    // bitácora UNA sola descarga → evidencias + datos_etapa + comentarios + registros (antes eran 4 fetches)
    loadRegistrosBundle().then(b=>{
      if(b.evidencias && b.evidencias.length) setEvi(prev=>[...b.evidencias, ...prev]);
      if(b.datos) setDatos(b.datos);
      if(b.comentarios && b.comentarios.length) setComentarios(b.comentarios);
      if(b.registros && b.registros.length) setRegistros(b.registros);
    }).catch(()=>{});
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
  // Eliminar expediente (SOLO Gerencia, motivo obligatorio). El backend borra caso+tickets+
  // calendario y firma el rastro en la bitácora; aquí cerramos la Sala y refrescamos todo.
  function onEliminarExp(codigo, motivo){
    return eliminarReclamo(codigo, motivo).then(r=>{
      if(r && r.ok!==false){
        toast("🗑 Expediente "+codigo+" eliminado — el rastro quedó en la bitácora");
        setSalaExp(null); setSelExpId(null); setSelEtapa(null);
        refrescar(); loadRegistros().then(setRegistros).catch(()=>{});
      } else toast("⚠ No se eliminó: "+((r&&r.error)||"error"));
      return r;
    });
  }
  function refrescar(){ loadReclamos().then(setData).catch(()=>{}); loadTickets().then(rows=>{ if(rows&&rows.length) setTickets(mapTickets(rows)); }).catch(()=>{}); }
  function onReasignarTicket(t, respId, respNombre){
    setTickets(ts=>ts.map(x=>x.id===t.id?{...x,respId:+respId,responsable:respNombre}:x));
    updTicket(t.id, undefined, t.reclamo, respId, respNombre)
      .then(r=>{ if(r && r.ok===false) toast("⚠ No se guardó la reasignación: "+(r.error||"error")); });
  }
  // ARCHIVAR un caso — abre el modal (2 formas: archivar directo, o adjuntando el foliado/cierre en PDF).
  function onArchivarCaso(t){
    const rec = (data||[]).find(r=>String(r.codigo)===String(t.reclamo));
    setArchivar({ codigo:t.reclamo, rec });
  }
  // ejecuta el archivado: marca CERRADO + etapas hechas (optimista) y firma en bitácora.
  function doArchivar(codigo, motivo){
    setTickets(ts=>ts.map(x=> String(x.reclamo)===String(codigo) ? {...x, estado:"hecho", abierto:false, hecho:true, vencido:false, riesgo:false} : x));
    return archivarCaso(codigo, motivo).then(r=>{
      if(r && r.ok===false){ toast("⚠ No se archivó: "+(r.error||"error")); refrescar(); }
      else { toast("🗄 Caso archivado — fuera de las alarmas"); refrescar(); loadRegistros().then(setRegistros).catch(()=>{}); }
      return r;
    });
  }
  // ARCHIVAR EN MASA los cerrados del cuaderno 20 (baja muchas alarmas de golpe).
  function onArchivarCerrados(){
    if(!confirm("🗄 Archivar TODOS los casos que figuran como cerrados en el cuaderno «20 Reclamos Cerrados».\n\nSe cierran y salen de la cola, de vencidos y del riesgo SAP. Los que ya estén cerrados se saltan (no duplica).\n\n¿Continuar?")) return;
    toast("Archivando cerrados… (unos segundos)");
    archivarCerrados().then(r=>{
      if(r && r.ok){ toast("🗄 Archivados "+r.archivados+" caso(s) · "+r.tickets+" etapas cerradas"); refrescar(); loadTickets().then(rows=>{ if(rows&&rows.length) setTickets(mapTickets(rows)); }).catch(()=>{}); loadRegistros().then(setRegistros).catch(()=>{}); }
      else toast("⚠ No se pudo: "+((r&&r.error)||"error"));
    });
  }
  // DES-archivar (reabrir) un caso archivado por error.
  function onDesarchivar(codigo){
    if(!confirm("↩ Reabrir el caso "+String(codigo).slice(-6)+"? Vuelve a la cola de trabajo.")) return;
    desarchivarCaso(codigo).then(r=>{
      if(r && r.ok===false) toast("⚠ No se pudo reabrir: "+(r.error||"error"));
      else { toast("↩ Caso reabierto"); refrescar(); }
    });
  }
  // TOMAR (auto-asignarse) una tarea del pozo del equipo — el nuevo responsable es SIEMPRE
  // quien tiene la sesión activa (perfilVista). Optimista; si el backend rechaza, avisa y refresca.
  function onTomarTarea(t){
    const respId = perfilVista.resp_id;
    const m = TEAM.find(x=>x.id===respId);
    const nombre = m ? m.nombre : "";
    setTickets(ts=>ts.map(x=>x.id===t.id?{...x,respId:+respId,responsable:nombre}:x));
    tomarTarea(t.id, t.reclamo).then(r=>{
      if(r && r.ok===false){ toast("⚠ No se pudo tomar: "+(r.error||"error")); refrescar(); }
      else toast("✋ Tomaste "+t.etapa+" · …"+String(t.reclamo).slice(-6)+" — está en tu «Mi día»");
    });
  }

  // Regla v4 (patrón courier): VER un caso abre la SALA; TRABAJARLO abre el Drawer.
  // - clic en fila (sin etapa) → Sala del expediente (seguimiento + colaboración)
  // - desde un ticket / notificación (con etapa) → Drawer directo en ESA etapa (intención de trabajo)
  function abrirExp(id, etapa){
    if(id==null){ setSelExpId(null); setSelEtapa(null); return; }
    if(etapa){ setSelExpId(id); setSelEtapa(etapa); }
    else setSalaExp(id);
  }
  // 🔎 Buscador global: atajo Ctrl/Cmd+K desde cualquier pantalla.
  useEffect(()=>{
    const h = e => { if((e.ctrlKey||e.metaKey) && (e.key==="k"||e.key==="K")){ e.preventDefault(); setBuscarOpen(true); } };
    window.addEventListener("keydown", h);
    return ()=>window.removeEventListener("keydown", h);
  }, []);
  // DEEP-LINK del QR (?sum=): al cargar los reclamos, resuelve el suministro escaneado.
  //  1 reclamo → abre su Sala · varios → elegir · ninguno → ofrecer crear el caso con ese suministro.
  useEffect(()=>{
    if(!sumPend || !data) return;
    const s = sumPend.trim();
    const matches = (data||[]).filter(x=>String(x.suministro||"").trim()===s);
    if(matches.length===1) abrirExp(matches[0].id);
    else if(matches.length>1) setSumPicker({ sum:s, matches });
    else if(confirm("El suministro "+s+" no tiene reclamos registrados.\n\n¿Crear un caso nuevo con este suministro?")){
      setCorreoOrigen({ prefill:{ CodigoSuministro:s } }); setNuevo(true);
    }
    setSumPend("");
    try{ window.history.replaceState({}, "", window.location.pathname); }catch(e){}
  }, [sumPend, data]);
  // 📷 QR escaneado con la cámara: el texto es la URL del suministro (…?sum=NNN). Extrae el
  // suministro y lo manda al MISMO resolver del deep-link (setSumPend → abre Sala / picker / crear).
  function onEscaneado(text){
    setEscanearOpen(false);
    let sum = "";
    try{ sum = new URL(text).searchParams.get("sum") || ""; }catch(e){}
    if(!sum){ const m = String(text||"").match(/(\d{5,})/); sum = m ? m[1] : String(text||"").trim(); }
    if(sum) setSumPend(sum); else toast("QR no reconocido — no contiene un suministro.");
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
          <button className="btn-ghost" onClick={()=>setBuscarOpen(true)} title="Buscar un caso (Ctrl+K)" style={{fontWeight:600}}>🔎 Buscar</button>
          <button className="btn-ghost" onClick={()=>setEscanearOpen(true)} title="Escanear el QR de un reclamo con la cámara" style={{fontWeight:600}}>📷 Escanear</button>
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
          ? <Operativo key={"op-"+perfilVista.resp_id} perfil={perfilVista} data={data} setSelExp={abrirExp} tickets={activos(tickets)} activoByCode={activoByCode} progresoDe={progresoDe} recByCode={recByCode} onEstadoTicket={onEstadoTicket} onTomarTarea={onTomarTarea} onEscanear={()=>setEscanearOpen(true)} abrirCuad={abrirCuad} onCuadAbierto={()=>setAbrirCuad(null)} onVolverExp={volverExp!=null?volverAlExp:null} correos={correos} correosCargando={correosCargando} onRecargarCorreos={cargarCorreos} onConvertirCorreo={convertirCorreoEnCaso} verExpediente={(codigo)=>{ const r=(data||[]).find(x=>String(x.codigo)===String(codigo)); if(r) abrirExp(r.id); }}/>
          : <Admin key={"ad-"+perfilVista.resp_id} perfil={perfilVista} data={data} evidencias={evidencias} setSelExp={abrirExp} delegar={delegar} updEstado={updEstado} tickets={activos(tickets)} todosTickets={tickets} datos={datos} activoByCode={activoByCode} progresoDe={progresoDe} recByCode={recByCode} onEstadoTicket={onEstadoTicket} onReasignarTicket={onReasignarTicket} onArchivarCaso={onArchivarCaso} onDesarchivar={onDesarchivar} onArchivarCerrados={onArchivarCerrados} abrirCuad={abrirCuad} onCuadAbierto={()=>setAbrirCuad(null)} onVolverExp={volverExp!=null?volverAlExp:null} registros={registros} comentarios={comentarios} correos={correos} correosCargando={correosCargando} onRecargarCorreos={cargarCorreos} onConvertirCorreo={convertirCorreoEnCaso} verExpediente={(codigo)=>{ const r=(data||[]).find(x=>String(x.codigo)===String(codigo)); if(r) abrirExp(r.id); }}/>}

      {salaExp!=null && data && (()=>{ const sx=data.find(x=>x.id===salaExp); return sx ? (
        <SalaExpediente exp={sx} tickets={tickets} evidencias={evidencias} registros={registros} comentarios={comentarios} datos={datos} correos={correos}
          perfil={perfilVista} onComentar={onComentar} onTrabajar={trabajarDesdeSala} onEstadoTicket={onEstadoTicket} onReasignarTicket={onReasignarTicket} onTomarTarea={onTomarTarea}
          onAbrirCuaderno={(fuente,q)=>irACuaderno(fuente,q,sx.id)}
          onEditar={(campo,valor)=>onEditarCampo(sx.codigo,campo,valor)} onEliminar={onEliminarExp} ladoALado={exp!=null} onClose={()=>setSalaExp(null)}/>
      ) : null; })()}
      {exp && <Drawer exp={exp} etapaInicial={selEtapa} evidencias={evidencias} datos={datos} tickets={tickets} perfil={perfilVista} comentarios={comentarios} registros={registros} onComentar={onComentar} onEstadoTicket={onEstadoTicket} onEditar={(campo,valor)=>onEditarCampo(exp.codigo,campo,valor)} onClose={()=>{ setSelExpId(null); setSelEtapa(null); }} onSaveDatos={saveDatos} onSubido={obj=>setEvi(ev=>[obj,...ev])}/>}
      {buscarOpen && data && <BuscadorGlobal data={data} onAbrir={abrirExp} onClose={()=>setBuscarOpen(false)}/>}
      {escanearOpen && <EscanearQR onDetect={onEscaneado} onClose={()=>setEscanearOpen(false)}/>}
      {archivar && <ArchivarCaso info={archivar} onArchivar={doArchivar} onSubido={obj=>setEvi(ev=>[obj,...ev])} onClose={()=>setArchivar(null)}/>}
      {sumPicker && <div className="modal-bg" onClick={()=>setSumPicker(null)} style={{position:"fixed",inset:0,background:"rgba(22,41,75,.45)",zIndex:96,display:"flex",alignItems:"center",justifyContent:"center"}}>
        <div onClick={e=>e.stopPropagation()} style={{background:"var(--card,#fff)",borderRadius:12,padding:18,width:"min(520px,94vw)",maxHeight:"85vh",overflowY:"auto",boxShadow:"0 12px 40px rgba(0,0,0,.25)"}}>
          <h3 style={{marginTop:0}}>Suministro {sumPicker.sum}</h3>
          <div className="muted" style={{fontSize:12,marginBottom:10}}>Este suministro tiene {sumPicker.matches.length} reclamos. Elige cuál documentar:</div>
          <div style={{display:"grid",gap:6}}>
            {sumPicker.matches.map(m=><button key={m.id} className="btn" style={{textAlign:"left",justifyContent:"flex-start"}}
              onClick={()=>{ setSumPicker(null); abrirExp(m.id); }}>
              <span className="mono">{m.osinerg}</span> · {m.solicitante} <span className="muted">· {m.etapa||m.estado}</span></button>)}
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",marginTop:12}}><button className="btn sm" onClick={()=>setSumPicker(null)}>Cerrar</button></div>
        </div>
      </div>}
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
function Admin({ perfil, data, evidencias, setSelExp, delegar, updEstado, tickets, todosTickets, datos, activoByCode, progresoDe, recByCode, onEstadoTicket, onReasignarTicket, onArchivarCaso, onDesarchivar, onArchivarCerrados, abrirCuad, onCuadAbierto, onVolverExp, registros, comentarios, correos, correosCargando, onRecargarCorreos, onConvertirCorreo, verExpediente }){
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
  const tabs = [["hoy","🏠 Hoy"],["equipo","👥 Equipo"],["expedientes","📁 Expedientes"],["bandeja","📧 Bandeja"],["calendario","📅 Calendario"],
    ["reportes","📊 Reportes"],["guia","📖 Guía del flujo"],[esGer?"admin":"_","⚙ Administración"]]
    .filter(t=>t[0]!=="_");
  return <>
    <div className="tabs">{tabs.map(t=><button key={t[0]} className={tab===t[0]?"on":""} onClick={()=>setTab(t[0])}>{t[1]}</button>)}</div>
    {tab==="hoy"         && <Hoy perfil={perfil} data={data} datos={datos} tickets={tickets} recByCode={recByCode} onEstadoTicket={onEstadoTicket} onReasignarTicket={onReasignarTicket} onArchivarCaso={onArchivarCaso} onDesarchivar={onDesarchivar} onArchivarCerrados={onArchivarCerrados} setSelExp={setSelExp} sinCasos={data.length===0} setTab={setTab}/>}
    {tab==="equipo"      && <><ResumenEquipo tickets={tickets} perfil={perfil}/><div style={{marginTop:14}}><ResumenDiario registros={registros} tickets={tickets}/></div><div style={{marginTop:14}}><VerificacionDiaria tickets={tickets} registros={registros} perfil={perfil}/></div><MejorasSugeridas comentarios={comentarios}/><div style={{marginTop:14}}><PenalidadesTope registros={registros} config={configEquipo} perfil={perfil}/></div></>}
    {tab==="expedientes" && <ExpedientesTab data={data} setSelExp={setSelExp} delegar={delegar} updEstado={updEstado} canDelegate={canDelegate} evidencias={evidencias} activoByCode={activoByCode} progresoDe={progresoDe} registros={registros} comentarios={comentarios}/>}
    {tab==="bandeja"     && <Bandeja perfil={perfil} correos={correos} cargando={correosCargando} noDisponible={correos===null && !correosCargando} onRecargar={onRecargarCorreos} existentes={data} onConvertir={onConvertirCorreo} verExpediente={verExpediente}/>}
    {tab==="calendario"  && <Calendario tickets={tickets} recByCode={recByCode} perfil={perfil} setSelExp={setSelExp} equipo/>}
    {tab==="reportes"    && <Reportes data={data} setSelExp={setSelExp} tickets={todosTickets} registros={registros} datos={datos} evidencias={evidencias} perfil={perfil} abrirCuad={abrirCuad} onCuadAbierto={onCuadAbierto} onVolverExp={onVolverExp}/>}
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
function Hoy({ perfil, data, datos, tickets, recByCode, onEstadoTicket, onReasignarTicket, onArchivarCaso, onDesarchivar, onArchivarCerrados, setSelExp, sinCasos, setTab }){
  const ab=abiertos(tickets), v=vencidos(tickets), pv=porVencer(tickets,2);
  const ger=verMontos(perfil.rol);
  const expo=exposicionTotal(tickets);
  // Riesgo SAP (silencio administrativo positivo, art. 21.1): motor puro en lib/plazosNormativos.js.
  // Necesita TODOS los tickets del caso (no solo el activo) para leer, p.ej., cuándo se abrió
  // Apelación; `tickets` aquí ya viene filtrado a activos desde Shell — es la mejor señal disponible.
  const riesgoSAP = (data && datos) ? riesgoSAPGlobal(data, datos, tickets) : { total:0, casos:[] };
  return <>
    {sinCasos && <BienvenidaSinCasos onIrBandeja={()=>setTab && setTab("bandeja")}/>}
    <div className={"grid "+(ger?"g4":"g3")}>
      <Kpi label="Casos en curso" value={ab.length} sub="uno por expediente (su etapa actual)" s="verde"/>
      <Kpi label="Por vencer (≤2d háb.)" value={pv.length} sub="atender hoy" s={pv.length?"ambar":"verde"}/>
      <Kpi label="Vencidos" value={v.length} sub="su etapa actual fuera de plazo" s={v.length?"rojo":"verde"}/>
      {ger && <Kpi label="Dinero en riesgo" value={"S/ "+expo.toLocaleString("es-PE")} sub="de las etapas actuales" s={expo?"rojo":"verde"}/>}
    </div>
    <div className={"grid "+(ger?"g4":"g3")} style={{marginTop:10}}>
      <Kpi label="Riesgo de silencio +" value={riesgoSAP.total} sub="casos que OSINERGMIN puede dar por GANADOS al usuario (silencio positivo · pen. 5.5)" s={riesgoSAP.total>0?"rojo":"verde"}/>
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
    <div style={{display:"flex",alignItems:"center",gap:8,padding:"11px 14px",borderLeft:"4px solid #1E8E5A"}}>
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

// Modal ARCHIVAR CASO — 2 formas: (1) archivar directo; (2) archivar adjuntando el foliado y/o la
// constancia de cierre en PDF (se guardan en el Drive del caso y quedan previsualizables en la Sala).
function ArchivarCaso({ info, onArchivar, onSubido, onClose }){
  const rec = info.rec, codigo = info.codigo;
  const [motivo, setMotivo] = useState("");
  const [foliado, setFoliado] = useState(null);
  const [cierre, setCierre] = useState(null);
  const [busy, setBusy] = useState(false);
  const subeUno = async (file, etapaNN, etapa) => {
    const r = await subirArchivo(codigo, etapaNN, file);
    if(r && r.url) onSubido && onSubido({ exp:String(codigo), etapa, nombre:r.nombre||file.name, tipo:"PDF", url:r.url, fecha:new Date().toISOString().slice(0,10), usuario:"", resp:0 });
    return r;
  };
  const archivar = async () => {
    setBusy(true);
    try{
      if(foliado) await subeUno(foliado, "09_Foliado", "Foliado");
      if(cierre)  await subeUno(cierre,  "10_Cierre",  "Cierre");
      await onArchivar(codigo, motivo || ((foliado||cierre) ? "archivado con foliado/cierre" : "archivado por coordinación"));
      onClose();
    }catch(e){ toast("Error al archivar: "+e); setBusy(false); }
  };
  const inpFile = (label, file, setFile, hint) => (
    <label style={{fontSize:12,display:"flex",flexDirection:"column",gap:3,background:"var(--card2)",border:"1px solid var(--bd)",borderRadius:8,padding:"8px 10px"}}>
      <span style={{fontWeight:600}}>{label} {file && <span style={{color:"#15803D"}}>· {file.name}</span>}</span>
      <span className="muted" style={{fontSize:10.5}}>{hint}</span>
      <input type="file" accept=".pdf,application/pdf" onChange={e=>setFile(e.target.files && e.target.files[0] || null)} style={{fontSize:11,marginTop:2}}/>
    </label>
  );
  return <div className="modal-bg" onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(22,41,75,.45)",zIndex:95,display:"flex",alignItems:"center",justifyContent:"center"}}>
    <div onClick={e=>e.stopPropagation()} style={{background:"var(--card,#fff)",borderRadius:12,padding:18,width:"min(560px,94vw)",maxHeight:"90vh",overflowY:"auto",boxShadow:"0 12px 40px rgba(0,0,0,.25)"}}>
      <h3 style={{marginTop:0}}>🗄 Archivar caso</h3>
      <div className="muted" style={{fontSize:12,marginBottom:10}}>
        <b>{rec?.osinerg || codigo}</b>{rec?.solicitante ? " · "+rec.solicitante : ""}. Se marca <b>CERRADO</b> y todas sus
        etapas como hechas → sale de la cola, de vencidos y del riesgo SAP. Úsalo para casos que YA están cerrados.
      </div>
      <label style={{fontSize:12,display:"flex",flexDirection:"column",gap:3,marginBottom:10}}>
        <span className="muted">Motivo / observación (opcional)</span>
        <input value={motivo} onChange={e=>setMotivo(e.target.value)} placeholder="p. ej. cerrado en SIELSE / entregado a ELSE"/>
      </label>
      <div className="muted" style={{fontSize:11,margin:"4px 0 6px",fontWeight:600}}>Regularizar el archivo (opcional) — se guarda en el Drive del caso y se previsualiza en la Sala:</div>
      <div style={{display:"grid",gap:8}}>
        {inpFile("📎 Expediente foliado (PDF)", foliado, setFoliado, "Va a la carpeta 09_Foliado del caso")}
        {inpFile("📎 Constancia de cierre (PDF)", cierre, setCierre, "Va a la carpeta 10_Cierre del caso")}
      </div>
      <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:14}}>
        <button className="btn sm" onClick={onClose} disabled={busy}>Cancelar</button>
        <button className="btn sm primary" onClick={archivar} disabled={busy}>{busy ? "Archivando…" : ((foliado||cierre) ? "Subir y archivar" : "Archivar")}</button>
      </div>
    </div>
  </div>;
}

function ExpedientesTab({ data, setSelExp, delegar, updEstado, canDelegate, evidencias, activoByCode, progresoDe, registros, comentarios }){
  const [sub,setSub]=useState("lista");
  return <>
    <div className="tabs">{[["lista","Expedientes"],["evidencias","Evidencias subidas ("+evidencias.length+")"]].map(t=>
      <button key={t[0]} className={sub===t[0]?"on":""} onClick={()=>setSub(t[0])}>{t[1]}</button>)}</div>
    {sub==="lista" && <Expedientes data={data} setSelExp={setSelExp} delegar={delegar} updEstado={updEstado} canDelegate={canDelegate} activoByCode={activoByCode} progresoDe={progresoDe} registros={registros} comentarios={comentarios}/>}
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

// Estado derivado del flujo: pill suave estilo courier (el estado real lo dicta el avance de
// etapas — no se edita a mano; así nadie "maquilla" un caso sin trabajarlo).
const CHIP_ESTADO = {
  "En proceso": { bg:"#EAF1FB", tx:"#1E3A5F", bd:"#C9DAF0" },
  "Completado": { bg:"#E8F6EC", tx:"#1E7A38", bd:"#BFE5CB" },
  "Cerrado":    { bg:"#E8F6EC", tx:"#1E7A38", bd:"#BFE5CB" },
  "Observado":  { bg:"#FEF3E2", tx:"#B45309", bd:"#FBE0B5" },
  "Pendiente":  { bg:"#F3F4F6", tx:"#4B5563", bd:"#E5E7EB" },
};
function EstadoChip({ estado, prog }){
  const c = CHIP_ESTADO[estado] || CHIP_ESTADO["Pendiente"];
  return <div title="Estado real del flujo — avanza solo cuando se trabajan las etapas (no se edita a mano: evita que un caso se 'maquille' sin trabajarlo)">
    <span style={{display:"inline-block",whiteSpace:"nowrap",padding:"3px 10px",borderRadius:999,fontSize:11.5,fontWeight:700,background:c.bg,color:c.tx,border:"1px solid "+c.bd}}>{estado}</span>
    {prog && prog.total>0 && <div className="muted" style={{fontSize:10,marginTop:3,whiteSpace:"nowrap"}}>etapas {prog.hechas}/{prog.total}</div>}
  </div>;
}

// ¿la fecha (ISO o dd/mm/yyyy) es HOY?
function esFechaHoy(v){
  const d = parseFecha(v); if(!d) return false;
  const n = new Date();
  return d.getFullYear()===n.getFullYear() && d.getMonth()===n.getMonth() && d.getDate()===n.getDate();
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
              {esFechaHoy(x.fechaMod) && <span title={"Modificado HOY en SIELSE"+(x.usuarioModifica?" ("+x.usuarioModifica+")":"")+(parseFecha(x.fechaMod)?" a las "+parseFecha(x.fechaMod).toLocaleTimeString("es-PE",{hour:"2-digit",minute:"2-digit"}):"")+(camposSielseHoy[String(x.codigo)]?"\nQué cambió: "+camposSielseHoy[String(x.codigo)].join(", "):"\n(corre el sync diario para ver QUÉ campos cambiaron)")} style={{fontSize:10.5,fontWeight:700,background:"#EAF1FB",color:"#1E3A5F",border:"1px solid #C9DAF0",borderRadius:6,padding:"2px 6px",marginRight:4}}>📤 SIELSE</span>}
              {trabajadoHoy.has(String(x.codigo)) && <span title="Nuestro equipo trabajó este caso HOY (bitácora)" style={{fontSize:10.5,fontWeight:700,background:"#E8F6EC",color:"#1E7A38",border:"1px solid #BFE5CB",borderRadius:6,padding:"2px 6px"}}>👥 equipo</span>}
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

function Reportes({ data, setSelExp, tickets, registros, datos, evidencias, perfil, abrirCuad, onCuadAbierto, onVolverExp }){
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

  return <>
    <div className="tabs">{[["cartera","Cartera"],["diario","Diario"],["semanal","Semanal"],["mensual","Valorización (estimada)"],["mensualoficial","Valorización oficial"],["muestra","Muestra ACT-04"],["mejoras","Mejoras TR"],["cuadernos","📒 Cuadernos"]].map(x=><button key={x[0]} className={rtab===x[0]?"on":""} onClick={()=>setR(x[0])}>{x[1]}</button>)}</div>
    {rtab==="cartera" && <Cartera data={data} setSelExp={setSelExp}/>}
    {rtab==="diario" && <Card><h3>Reporte diario por trabajador</h3><div style={{overflowX:"auto"}}><table className="tbl"><thead><tr><th>Trabajador</th><th>Asignados</th><th>En atención</th><th>Cerrados</th><th>Vencidos</th></tr></thead><tbody>
      {porResp.map(o=><tr key={o.t.id}><td><span className="dot" style={{background:o.t.color}}/>{o.t.nombre}</td><td>{o.list.length}</td><td>{o.list.filter(x=>x.estadoCom==="EN ATENCION").length}</td><td>{o.list.filter(x=>x.estado==="Cerrado").length}</td><td style={{color:"#C9821B"}}>{o.list.filter(x=>x.vencido).length||0}</td></tr>)}
    </tbody></table></div></Card>}
    {rtab==="semanal" && <Card><h3>Reporte semanal (cartera)</h3>
      <div className="kv"><b>Total</b><span>{data.length}</span></div><div className="kv"><b>Cerrados</b><span>{cerr}</span></div>
      <div className="kv"><b>En atención</b><span>{data.filter(x=>x.estadoCom==="EN ATENCION").length}</span></div><div className="kv"><b>Vencidos</b><span>{data.filter(x=>x.vencido).length}</span></div>
      {Object.entries(clases).map(([k,v])=><div className="kv" key={k}><b>{k}</b><span>{v}</span></div>)}</Card>}
    {rtab==="mensual" && <>
      <div className="note" style={{background:"#FEF3DF",border:"1px solid #F0C36D",color:"#B45309",marginBottom:12}}>
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
            <tr><td colSpan={5} style={{textAlign:"right"}}><b>Total estimado</b></td><td><b style={{color:"#1E8E5A"}}>S/ {tot.toLocaleString()}</b></td></tr>
          </tbody></table>
        </div>
      </Card>
    </>}
    {rtab==="mensualoficial" && <ValorizacionMensual data={data} tickets={tickets} evidencias={evidencias} registros={registros} datos={datos} config={config} perfil={perfil}/>}
    {rtab==="muestra" && <MuestraTrimestral data={data} tickets={tickets} evidencias={evidencias} registros={registros} perfil={perfil} setSelExp={setSelExp}/>}
    {rtab==="mejoras" && <MejorasTR data={data} tickets={tickets} datos={datos} registros={registros} perfil={perfil}/>}
    {rtab==="cuadernos" && <Cuadernos data={data} setSelExp={setSelExp} perfil={perfil} abrir={abrirCuad} onAbierto={onCuadAbierto} onVolver={onVolverExp}/>}
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
  const cvm={1:"Araujo",2:"Marroquin",3:"Vargas",4:"Montufar",5:"Leon",6:"Condori",7:"Ramos",8:"Hurtado"};
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
function Operativo({ perfil, data, setSelExp, tickets, activoByCode={}, progresoDe, recByCode, onEstadoTicket, onTomarTarea, onEscanear, abrirCuad, onCuadAbierto, onVolverExp, correos, correosCargando, onRecargarCorreos, onConvertirCorreo, verExpediente }){
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
    {tab==="cuadernos" && <Cuadernos data={data} setSelExp={setSelExp} perfil={perfil} abrir={abrirCuad} onAbierto={onCuadAbierto} onVolver={onVolverExp}/>}
    {tab==="bandeja" && <Bandeja perfil={perfil} correos={correos} cargando={correosCargando} noDisponible={correos===null && !correosCargando} onRecargar={onRecargarCorreos} existentes={data} onConvertir={onConvertirCorreo} verExpediente={verExpediente}/>}
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
