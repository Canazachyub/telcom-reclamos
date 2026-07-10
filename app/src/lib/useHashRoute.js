// Router hash MÍNIMO (F4) — sin dependencia nueva. Da URL a dos entidades ya existentes:
//   #/exp/<CodigoReclamo>        -> abre la Sala de ese expediente (misma acción que abrirExp(id))
//   #/cuaderno/<fuente>?q=<...>  -> abre ese cuaderno filtrado (misma acción que irACuaderno)
// Cero lógica de apertura duplicada: solo parsea el hash y llama a los MISMOS
// setters/handlers que ya usa Shell (App.jsx) para el deep-link ?sum= y los clics de la UI.
//
// Diseño:
//  1) UN listener de "hashchange" (montado una sola vez) resuelve tanto la URL escrita a mano /
//     compartida como el "atrás" del navegador (al quitar el hash de la Sala, hashchange dispara
//     igual que popstate) — así "atrás" con la Sala abierta la CIERRA en vez de salir de la app.
//  2) Sincronización inversa (UI -> hash): al abrir la Sala se hace pushState (para que "atrás"
//     tenga algo que deshacer); al cerrarla se limpia con replaceState. Abrir un cuaderno usa
//     SIEMPRE replaceState (no ensucia el historial en cada clic).
//  3) `skip` es un ref que se marca al aplicar un hash ENTRANTE para que la sync de abajo no
//     lo reescriba en el mismo ciclo; además cada escritura es idempotente (compara con el hash
//     actual antes de tocar el historial), así que un `skip` no consumido a tiempo es inofensivo.
import { useEffect, useRef } from "react";

function parseHash(){
  const h = (typeof window!=="undefined" && window.location.hash) || "";
  const m = h.match(/^#\/(exp|cuaderno)\/([^?]+)(?:\?(.*))?$/);
  if(!m) return null;
  const q = new URLSearchParams(m[3]||"").get("q") || "";
  return { tipo: m[1], val: decodeURIComponent(m[2]), q };
}

export function useHashRoute({ data, salaExp, setSalaExp, abrirExp, irACuaderno, abrirCuad }){
  const dataRef = useRef(data); dataRef.current = data;
  const salaExpRef = useRef(salaExp); salaExpRef.current = salaExp;
  const skip = useRef(false);
  const parseadoInicial = useRef(false);

  function aplicar(){
    const r = parseHash();
    skip.current = true;
    queueMicrotask(() => { skip.current = false; });
    if(!r){
      if(salaExpRef.current != null) setSalaExp(null);          // "atrás" quitó el hash -> cierra la Sala
    } else if(r.tipo === "exp"){
      const rec = (dataRef.current||[]).find(x=>String(x.codigo)===r.val);
      if(rec) abrirExp(rec.id);
    } else if(r.tipo === "cuaderno"){
      irACuaderno(r.val, r.q, null);
    }
  }

  // 1) Hash -> UI: listener único (montaje) + parseo inicial en cuanto `data` ya cargó (igual
  //    que el resolver de ?sum=). abrirExp/irACuaderno/setSalaExp solo llaman setters estables:
  //    aunque el listener quede con la versión de esta ejecución del efecto, sigue funcionando.
  useEffect(() => {
    window.addEventListener("hashchange", aplicar);
    if(dataRef.current && !parseadoInicial.current){ parseadoInicial.current = true; aplicar(); }
    return () => window.removeEventListener("hashchange", aplicar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!data]);

  // 2) Sala -> hash: pushState SOLO al abrir (para que "atrás" la cierre); limpia con
  //    replaceState al cerrar. Idempotente: si el hash ya refleja el estado, no toca el historial.
  useEffect(() => {
    if(skip.current) return;
    const codigo = salaExp!=null && data ? (data.find(x=>x.id===salaExp)||{}).codigo : null;
    const cur = parseHash();
    if(codigo != null){
      if(!(cur && cur.tipo==="exp" && cur.val===String(codigo)))
        window.history.pushState({}, "", "#/exp/"+encodeURIComponent(codigo));
    } else if(cur && cur.tipo==="exp"){
      window.history.replaceState({}, "", window.location.pathname + window.location.search);
    }
  }, [salaExp, data]);

  // 3) Cuaderno -> hash: SIEMPRE replaceState (no ensucia el historial en cada clic).
  useEffect(() => {
    if(skip.current || !abrirCuad) return;
    const cur = parseHash();
    const q = abrirCuad.q || "";
    if(!(cur && cur.tipo==="cuaderno" && cur.val===abrirCuad.fuente && (cur.q||"")===q))
      window.history.replaceState({}, "", "#/cuaderno/"+encodeURIComponent(abrirCuad.fuente)+(q?("?q="+encodeURIComponent(q)):""));
  }, [abrirCuad]);
}
