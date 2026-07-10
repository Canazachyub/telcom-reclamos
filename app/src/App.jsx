import { useEffect, useMemo, useState, lazy, Suspense } from "react";
import { loadReclamos, loadRegistrosBundle, guardarDatos, loadTickets, updTicket, tomarTarea, archivarCaso, archivarCerrados, desarchivarCaso, comentar, loadRegistros, loadCorreos, loadDominio, postAction, editarReclamo, eliminarReclamo, vincularCorreo, USE_MOCK } from "./lib/api.js";
import { mapTickets, activos } from "./lib/tickets.js";
import { getSesionValida, logout, ROL_LABEL, puedeVerTodo, esOperativo, USERS } from "./lib/auth.js";
import {
  TEAM, teamById, wColor, ETAPAS, STREAMLIT_URL
} from "./lib/model.js";
import { toast, SkeletonVista } from "./components/ui.jsx";
import Login from "./components/Login.jsx";
import Notificaciones from "./components/Notificaciones.jsx";
import BuscadorGlobal from "./components/BuscadorGlobal.jsx";
import Admin from "./components/Admin.jsx";
import Operativo from "./components/Operativo.jsx";
import ArchivarCaso from "./components/ArchivarCaso.jsx";
import { AppCtx } from "./AppContext.jsx";
import { useHashRoute } from "./lib/useHashRoute.js";
// Code-split (F4-B): estas 5 son overlays/modales que NUNCA se necesitan en el primer render
// (se montan condicionalmente más abajo) — se cargan en diferido, con Suspense fallback=null
// (no reservan layout: aparecen sobre un overlay/backdrop, un skeleton de página no encaja ahí).
const Drawer = lazy(() => import("./components/Drawer.jsx"));
const NuevoCaso = lazy(() => import("./components/NuevoCaso.jsx"));
const PruebaGuiada = lazy(() => import("./components/PruebaGuiada.jsx"));
const SalaExpediente = lazy(() => import("./components/SalaExpediente.jsx"));
const EscanearQR = lazy(() => import("./components/EscanearQR.jsx"));

const iniciales = n => (n||"").split(" ").map(s=>s[0]).slice(0,2).join("").toUpperCase();

// "Ver como": lista de roles que el Gerente puede simular (uno por perfil operativo/coordinación).
// Se arma desde USERS (auth.js) para no duplicar nombres/roles a mano.
const VER_COMO_USUARIOS = ["aaraujo","dmarroquin","jvargas","amontufar","mleon","jcondori","aramos","mhurtado"];
const VER_COMO_OPCIONES = VER_COMO_USUARIOS.map(u=>USERS.find(x=>x.usuario===u)).filter(Boolean);

// Tema claro/oscuro (§11 SDD): default OSCURO, persistido en localStorage, aplicado como
// data-theme en <html> para que TODA la app (incl. Login, antes de tener sesión) lo respete.
// Presentación pura — cero estado de negocio, cero llamadas al backend.
function useTema(){
  const [tema, setTema] = useState(()=>{ try{ return localStorage.getItem("tema")==="claro" ? "claro" : "oscuro"; }catch(e){ return "oscuro"; } });
  useEffect(()=>{
    try{ document.documentElement.setAttribute("data-theme", tema==="claro"?"light":"dark"); localStorage.setItem("tema", tema); }catch(e){}
  }, [tema]);
  return [tema, setTema];
}

export default function App(){
  const [perfil, setPerfil] = useState(getSesionValida());
  const [tema, setTema] = useTema();
  if(!perfil) return <Login onLogin={setPerfil}/>;
  return <Shell perfil={perfil} onLogout={()=>{logout();setPerfil(null);}} tema={tema} setTema={setTema}/>;
}

function Shell({ perfil, onLogout, tema, setTema }){
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
    // dominio del backend (equipo/etapas/feriados): actualiza model.js en sitio; el fallback
    // local mantiene la app operativa si falla — no bloquea el primer render.
    loadDominio();
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
  // Router hash mínimo (F4): #/exp/<codigo> y #/cuaderno/<fuente>?q=<...>. Usa los MISMOS
  // handlers de arriba (abrirExp/irACuaderno/setSalaExp) — ver lib/useHashRoute.js. El ?sum=
  // de arriba no cambia: si abre una Sala, este hook refleja el hash igual que un clic normal.
  useHashRoute({ data, salaExp, setSalaExp, abrirExp, irACuaderno, abrirCuad });
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

  // Ir directo a la Sala de un expediente A PARTIR de su código SIELSE (p.ej. desde la Bandeja
  // de correos: "ver el caso ya vinculado"). Antes se definía inline en CADA render de
  // Admin/Operativo (2 copias idénticas) — ahora vive una sola vez aquí y viaja por el contexto.
  function verExpediente(codigo){ const r=(data||[]).find(x=>String(x.codigo)===String(codigo)); if(r) abrirExp(r.id); }

  // ===== CONTEXTO GLOBAL (F1b) =====
  // Agrupa el estado/handlers que hoy bajan Shell→Admin/Operativo→Reportes/Hoy→hijo por props.
  // Ningún dato/llamada nueva: son las MISMAS referencias que ya arma Shell arriba. `tickets` va
  // CRUDO (sin `activos()`) — igual que el estado de Shell — porque cada consumidor lo usa
  // distinto hoy (Admin/Operativo lo filtran con `activos()`, Reportes usa el crudo, tal como
  // antes recibía `todosTickets`); así ningún componente pierde información al leerlo.
  // `recByCode`/`activoByCode`/`progresoDe` NO entran en las dependencias del useMemo (se
  // recalculan SIEMPRE, gratis, en cada render de Shell, con referencia nueva cada vez) — solo
  // se recalcula el VALOR del contexto cuando cambia lo que realmente los determina (data/tickets).
  // NOTA: este hook debe ejecutarse SIEMPRE (antes del `if(err) return` de abajo) — las Rules of
  // Hooks de React exigen el MISMO orden de hooks en cada render de este componente.
  const ctxValue = useMemo(() => ({
    // estado global (mismo shape que en Shell)
    perfilVista, data, tickets, datos, registros, comentarios, evidencias,
    correos, correosCargando, recByCode, activoByCode, progresoDe,
    // handlers (mismo nombre/firma/efecto de siempre)
    onEstadoTicket, onReasignarTicket, onTomarTarea,
    onArchivarCaso, onDesarchivar, onArchivarCerrados,
    onEditarCampo, onComentar, onEliminarExp, refrescar,
    abrirExp, verExpediente,
    abrirCuad, onCuadAbierto: () => setAbrirCuad(null), onVolverExp: volverExp!=null ? volverAlExp : null,
    onRecargarCorreos: cargarCorreos, onConvertirCorreo: convertirCorreoEnCaso,
    delegar, updEstado,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [perfilVista, data, tickets, datos, registros, comentarios, evidencias, correos, correosCargando, abrirCuad, volverExp]);

  if(err) return <div className="wrap"><div className="card" style={{color:"#DC2626",border:"1px solid #F3B4B4"}}>Error cargando datos: {err}</div></div>;

  const exp = selExp!=null && data ? data.find(x=>x.id===selExp) : null;

  return (
    <AppCtx.Provider value={ctxValue}>
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
          {/* Acción primaria de la cabecera: acento institucional, NUNCA riesgo (el rojo se gana). */}
          <button className="btn" onClick={()=>setNuevo(true)} title="Registrar un nuevo expediente" style={{fontWeight:600}}>➕ Nuevo caso</button>
          {puedeVerTodo(perfilVista.rol) && <a className="btn-ghost" href={STREAMLIT_URL} target="_blank" rel="noreferrer" title="Abrir herramientas de análisis (Streamlit) en pestaña nueva">🔧 Herramientas</a>}
          {data && <Notificaciones perfil={perfilVista} activosTk={activos(tickets)} recByCode={recByCode} setSelExp={abrirExp}/>}
          <div className="av" style={{background:color}} title={perfilVista.nombre}>{iniciales(perfilVista.nombre)}</div>
          <div className="meta"><div className="n">{perfilVista.nombre}</div><div className="r">{ROL_LABEL[perfilVista.rol]}</div></div>
          <button className="btn-ghost" onClick={()=>setTema(t=>t==="claro"?"oscuro":"claro")} title="Cambiar el tema de la plataforma">
            {tema==="claro" ? "Modo oscuro" : "Modo claro"}
          </button>
          <button className="btn-ghost" onClick={onLogout} title="Cerrar sesión">Salir</button>
        </div>
      </header>

      {/* Fix de contraste (F2, 2º addendum): tokens de tinte ámbar — el texto/botón se leen en
          los dos temas porque --tint-amber-tx se recalcula junto con el tema. Presentación pura,
          no toca el estado de "ver como" ni su lógica. */}
      {verComo && (
        <div className="note st-amber" style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8,marginBottom:14}}>
          <span>👁 Estás viendo la plataforma como <b>{verComo.nombre}</b> ({ROL_LABEL[verComo.rol]}) — modo simulación</span>
          <button className="btn-ghost" onClick={()=>setVerComo(null)} style={{fontWeight:600,color:"var(--tint-amber-tx)",borderColor:"var(--tint-amber-bd)"}}>← Volver a mi vista</button>
        </div>
      )}

      {/* Las vistas de trabajo reciben SOLO el ticket vivo de cada caso (su etapa actual).
          El Drawer recibe todos (muestra el historial completo de etapas del expediente). */}
      {/* Admin/Operativo ya NO reciben el estado/handlers globales por props (F1b): los toman de
          useApp() (AppContext.jsx). Solo quedan por props las cosas de instancia/UI local de Shell
          que NO son estado global: `key` (fuerza remount al cambiar de perfil simulado) y, en
          Operativo, `onEscanear` (abre el modal de cámara — estado 100% local de Shell). */}
      {!data ? <SkeletonVista/>
        : esOperativo(perfilVista.rol)
          ? <Operativo key={"op-"+perfilVista.resp_id} onEscanear={()=>setEscanearOpen(true)}/>
          : <Admin key={"ad-"+perfilVista.resp_id}/>}

      {salaExp!=null && data && (()=>{ const sx=data.find(x=>x.id===salaExp); return sx ? (
        <Suspense fallback={null}>
        <SalaExpediente exp={sx} tickets={tickets} evidencias={evidencias} registros={registros} comentarios={comentarios} datos={datos} correos={correos}
          perfil={perfilVista} onComentar={onComentar} onTrabajar={trabajarDesdeSala} onEstadoTicket={onEstadoTicket} onReasignarTicket={onReasignarTicket} onTomarTarea={onTomarTarea}
          onAbrirCuaderno={(fuente,q)=>irACuaderno(fuente,q,sx.id)}
          onEditar={(campo,valor)=>onEditarCampo(sx.codigo,campo,valor)} onEliminar={onEliminarExp} ladoALado={exp!=null} onClose={()=>setSalaExp(null)}/>
        </Suspense>
      ) : null; })()}
      {exp && <Suspense fallback={null}><Drawer exp={exp} etapaInicial={selEtapa} evidencias={evidencias} datos={datos} tickets={tickets} perfil={perfilVista} comentarios={comentarios} registros={registros} onComentar={onComentar} onEstadoTicket={onEstadoTicket} onEditar={(campo,valor)=>onEditarCampo(exp.codigo,campo,valor)} onAbrirCuaderno={(fuente,q)=>irACuaderno(fuente,q,exp.id)} onClose={()=>{ setSelExpId(null); setSelEtapa(null); }} onSaveDatos={saveDatos} onSubido={obj=>setEvi(ev=>[obj,...ev])}/></Suspense>}
      {buscarOpen && data && <BuscadorGlobal data={data} onAbrir={abrirExp} onClose={()=>setBuscarOpen(false)}/>}
      {escanearOpen && <Suspense fallback={null}><EscanearQR onDetect={onEscaneado} onClose={()=>setEscanearOpen(false)}/></Suspense>}
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
      {nuevo && <Suspense fallback={null}><NuevoCaso perfil={perfilVista} existentes={data||[]} inicial={correoOrigen ? correoOrigen.prefill : null} onClose={()=>{ setNuevo(false); setCorreoOrigen(null); }} onCreado={(codigoNuevo)=>{
        // si el caso nació de un correo de la Bandeja, se vincula solo (adjuntos incluidos)
        if(correoOrigen && correoOrigen.correoId && codigoNuevo){ vincularCorreo(correoOrigen.correoId, codigoNuevo).then(()=>cargarCorreos()).catch(()=>{}); }
        setNuevo(false); setCorreoOrigen(null); refrescar();
      }}/></Suspense>}
      <Suspense fallback={null}><PruebaGuiada perfil={perfilVista} sinCasos={!!data && data.length===0}/></Suspense>

      <footer>React + Vite · backend Apps Script · data real SIELSE · TELCOM ENERGY 2026</footer>
    </div>
    </AppCtx.Provider>
  );
}
