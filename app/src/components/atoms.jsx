// Piezas chicas y compartidas entre varias vistas (extraídas de App.jsx en F1a).
import { Card } from "./ui.jsx";

// Mini-timeline de puntos: el avance del caso de un vistazo en las tablas.
// éxito (verde) = etapa hecha · acento con halo = etapa actual · neutro = pendiente
// (el rojo NO aparece aquí: completar una etapa es una acción positiva, nunca riesgo)
export function MiniProgreso({ prog }){
  if(!prog || !prog.total) return <span className="muted">—</span>;
  return <div style={{display:"flex",gap:3,alignItems:"center"}} title={"hechas "+prog.hechas+"/"+prog.total}>
    {Array.from({length:prog.total},(_,i)=>{
      const done=i<prog.hechas, act=i===prog.hechas;
      return <i key={i} style={{width:8,height:8,borderRadius:"50%",display:"block",
        background: done?"var(--green)":(act?"var(--acc)":"var(--bd)"),
        boxShadow: act?"0 0 0 2px var(--tint-acc-bd)":"none"}}/>;
    })}
  </div>;
}

// Estado derivado del flujo: pill suave (el estado real lo dicta el avance de etapas — no se
// edita a mano; así nadie "maquilla" un caso sin trabajarlo). "Observado" es advertencia
// (ámbar) — no está vencido todavía, así que NO lleva rojo.
const CHIP_ESTADO = {
  "En proceso": { bg:"var(--tint-acc-bg)", tx:"var(--tint-acc-tx)", bd:"var(--tint-acc-bd)" },
  "Completado": { bg:"var(--tint-green-bg)", tx:"var(--tint-green-tx)", bd:"var(--tint-green-bd)" },
  "Cerrado":    { bg:"var(--tint-green-bg)", tx:"var(--tint-green-tx)", bd:"var(--tint-green-bd)" },
  "Observado":  { bg:"var(--tint-amber-bg)", tx:"var(--tint-amber-tx)", bd:"var(--tint-amber-bd)" },
  "Pendiente":  { bg:"var(--card2)", tx:"var(--mut)", bd:"var(--bd)" },
};
export function EstadoChip({ estado, prog }){
  const c = CHIP_ESTADO[estado] || CHIP_ESTADO["Pendiente"];
  return <div title="Estado real del flujo — avanza solo cuando se trabajan las etapas (no se edita a mano: evita que un caso se 'maquille' sin trabajarlo)">
    <span style={{display:"inline-block",whiteSpace:"nowrap",padding:"3px 10px",borderRadius:999,fontSize:11.5,fontWeight:700,background:c.bg,color:c.tx,border:"1px solid "+c.bd}}>{estado}</span>
    {prog && prog.total>0 && <div className="muted" style={{fontSize:10,marginTop:3,whiteSpace:"nowrap"}}>etapas {prog.hechas}/{prog.total}</div>}
  </div>;
}

// Card de bienvenida cuando el sistema arranca EN BLANCO (0 reclamos) para operación real:
// guía al líder a registrar el primer caso real desde la Bandeja (75 correos reales de ELSE
// ya sincronizados) o con "Nuevo caso" si tiene el expediente físico escaneado.
export function BienvenidaSinCasos({ onIrBandeja }){
  return (
    <Card style={{ marginBottom: 14, border: "1px solid var(--tint-acc-bd)", background: "var(--tint-acc-bg)" }}>
      <h3 style={{ margin: "0 0 6px" }}>Sistema en blanco — arranque de operación real</h3>
      <div style={{ fontSize: 13, lineHeight: 1.6, color: "var(--tx)" }}>
        Los reclamos reales están llegando por correo: abre la <b>Bandeja</b> y registra el primero con <b>«Convertir en caso»</b>, o usa <b>«Nuevo caso»</b> si tienes el expediente escaneado.
        Pulsa <b>«Prueba guiada»</b> (abajo a la derecha) para la guía paso a paso.
      </div>
      {onIrBandeja && (
        <div style={{ marginTop: 10 }}>
          <button className="btn sm" onClick={onIrBandeja}>📧 Ir a la Bandeja</button>
        </div>
      )}
    </Card>
  );
}

// Canal de mejoras: todo comentario que empiece con «MEJORA:» llega aquí para Gerencia/Coordinación.
export function MejorasSugeridas({ comentarios }){
  const mejoras=(comentarios||[]).filter(c=>/^\s*MEJORA[:\s]/i.test(c.texto||""));
  return <Card style={{marginTop:14}}>
    <h3>💡 Mejoras sugeridas por el equipo ({mejoras.length})</h3>
    <div className="muted" style={{fontSize:12,marginBottom:8}}>Todo comentario que empiece con «MEJORA:» en las observaciones de un expediente aparece aquí — es el canal del equipo para proponer cómo perfeccionar el sistema.</div>
    {mejoras.map((c,i)=>(
      <div className="row" key={i} style={{borderLeft:"4px solid var(--purple)"}}>
        <div>
          <div style={{fontSize:12.5}}>{String(c.texto).replace(/^\s*MEJORA[:\s]+/i,"")}</div>
          <div className="muted" style={{fontSize:10.5,marginTop:2}}>{c.nombre||c.usuario} · {c.rol} · {c.fecha}{c.reclamo?" · exp …"+String(c.reclamo).slice(-6):""}</div>
        </div>
      </div>
    ))}
    {!mejoras.length && <div className="muted" style={{fontSize:12}}>Aún no hay sugerencias. El equipo puede escribir «MEJORA: …» en las observaciones de cualquier expediente.</div>}
  </Card>;
}
