const S = {
  correos:{ background:"var(--card)", border:"1px solid var(--bd)", borderRadius:16, padding:15, marginTop:13 },
  correoFila:{ display:"flex", alignItems:"flex-start", gap:9, padding:"8px 2px", borderBottom:"1px solid var(--lineaBd)" },
  correoAsunto:{ fontSize:12.5, fontWeight:700, color:"var(--titulo)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" },
  correoMeta:{ fontSize:11, color:"var(--mut)", marginTop:2 },
};

// ===== correos del caso =====
export function CorreosCaso({ correosDelCaso }){
  return (
    <div style={S.correos}>
      <div style={{fontSize:13.5,fontWeight:700,color:"var(--titulo)",marginBottom:4}}>Correos del caso</div>
      {correosDelCaso.slice(0,5).map((c,i)=>(
        <div key={c.id||i} style={{...S.correoFila, ...(i===Math.min(correosDelCaso.length,5)-1?{borderBottom:0}:{})}} title="ábrelo desde la pestaña Bandeja">
          <span style={{fontSize:15}}>📧</span>
          <div style={{flex:1,minWidth:0}}>
            <div style={S.correoAsunto}>{c.asunto||"(sin asunto)"}</div>
            <div style={S.correoMeta}>{c.de||"—"} · {c.fecha||""}</div>
          </div>
        </div>
      ))}
      {!correosDelCaso.length && <div className="muted" style={{fontSize:12}}>Sin correos vinculados — vincúlalos desde la Bandeja.</div>}
    </div>
  );
}
