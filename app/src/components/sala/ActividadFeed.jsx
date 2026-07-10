import { iniciales } from "./utils.js";

const S = {
  ava:(c)=>({ width:29, height:29, borderRadius:"50%", background:c||"var(--acc)", color:"#fff", display:"inline-flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, flexShrink:0 }),
  feed:{ background:"var(--card)", border:"1px solid var(--bd)", borderRadius:16, padding:15, marginTop:13 },
  evento:{ display:"flex", gap:11, padding:"9px 2px", borderBottom:"1px solid var(--lineaBd)", fontSize:12.5 },
};

// ===== actividad del equipo =====
export function ActividadFeed({ actividad, actividadTodo, verTodaAct, setVerTodaAct, texto, setTexto, onEnviar }){
  return (
    <div style={S.feed}>
      <div style={{fontSize:13.5,fontWeight:700,color:"var(--titulo)",marginBottom:4}}>Actividad del equipo</div>
      {actividad.map((a,i)=>(
        <div key={i} style={{...S.evento, ...(i===actividad.length-1?{borderBottom:0}:{})}}>
          <span style={S.ava("var(--acc)")}>{iniciales(a.quien)}</span>
          <div style={{flex:1}}>
            <div><b style={{color:"var(--titulo)"}}>{a.quien}</b> <span style={{color:"var(--tx)"}}>{a.que}</span>
              {a.etapa && <span style={{fontSize:10,padding:"1px 7px",borderRadius:6,background:"var(--tint-acc-bg)",color:"var(--tint-acc-tx)",fontWeight:700,marginLeft:7}}>{a.etapa}</span>}
            </div>
          </div>
          <span style={{fontSize:10.5,color:"var(--mut2)",whiteSpace:"nowrap"}}>{a.cuando}</span>
        </div>
      ))}
      {!actividad.length && <div className="muted" style={{fontSize:12}}>Sin actividad registrada todavía.</div>}
      {actividadTodo.length > 5 && (
        <button className="btn-ghost" style={{marginTop:8,fontSize:12,width:"100%"}} onClick={()=>setVerTodaAct(v=>!v)}>
          {verTodaAct ? "▴ Comprimir actividad" : "▾ Ver toda la actividad ("+actividadTodo.length+")"}
        </button>
      )}
      <div style={{display:"flex",gap:8,marginTop:11}}>
        <input className="flt" style={{flex:1}} placeholder="Comentar en este expediente… (todo el equipo del caso lo ve)"
          value={texto} onChange={e=>setTexto(e.target.value)} onKeyDown={e=>{ if(e.key==="Enter") onEnviar(); }}/>
        <button className="btn sec" onClick={onEnviar}>Comentar</button>
      </div>
    </div>
  );
}
