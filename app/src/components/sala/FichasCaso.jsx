import { copiar } from "./utils.js";

const S = {
  fichas:{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:11, marginTop:13 },
  ficha:{ background:"var(--card)", border:"1px solid var(--bd)", borderRadius:13, padding:13 },
  fTit:{ margin:"5px 0 7px", fontSize:12.5, color:"var(--titulo)", fontWeight:700 },
  fKv:{ fontSize:12, color:"var(--mut)", display:"grid", gap:3 },
  copy:{ float:"right", background:"transparent", border:"1px solid var(--bd)", color:"var(--mut)", borderRadius:7, fontSize:10.5, padding:"2px 8px", cursor:"pointer", fontFamily:"inherit" },
};

// ===== las 4 tarjetas (patrón courier) =====
export function FichasCaso({ exp, act, hechas, propios, plazoPill }){
  return (
    <div style={S.fichas}>
      <div style={S.ficha}>
        <button style={S.copy} onClick={()=>copiar(exp.solicitante,"reclamante")}>copiar</button>
        <div style={{fontSize:17}}>👤</div><div style={S.fTit}>Reclamante</div>
        <div style={S.fKv}><span style={{color:"var(--tx)",fontWeight:600}}>{exp.solicitante||"—"}</span></div>
      </div>
      <div style={S.ficha}>
        <button style={S.copy} onClick={()=>copiar(exp.suministro,"suministro")}>copiar</button>
        <div style={{fontSize:17}}>⚡</div><div style={S.fTit}>Suministro</div>
        <div style={S.fKv}><span className="mono" style={{color:"var(--tx)",fontWeight:600}}>{exp.suministro||"—"}</span></div>
      </div>
      <div style={S.ficha}>
        <button style={S.copy} onClick={()=>copiar(exp.clase,"materia")}>copiar</button>
        <div style={{fontSize:17}}>📋</div><div style={S.fTit}>Materia</div>
        <div style={S.fKv}>
          <span style={{color:"var(--tx)",fontWeight:600}}>{(exp.clase||"—").replace("RECLAMOS ","")}</span>
          {exp.tipoRes && <span>Resol. histórica: {exp.tipoRes}</span>}
        </div>
      </div>
      <div style={S.ficha}>
        <button style={S.copy} onClick={()=>copiar(exp.osinerg||exp.codigo,"código")}>copiar</button>
        <div style={{fontSize:17}}>⏱️</div><div style={S.fTit}>Plazo y avance</div>
        <div style={S.fKv}>
          <span>Etapas: <b style={{color:"var(--tx)"}}>{hechas}/{propios.length||"?"}</b></span>
          {act && <span>Restan: <b style={{color:plazoPill.cl}}>{act.diasRestantes!=null?act.diasRestantes+" d háb.":"—"}</b></span>}
          <span>Estado: {exp.estado||"—"}</span>
        </div>
      </div>
    </div>
  );
}
