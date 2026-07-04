import { Tag } from "./ui.jsx";
import { wColor } from "../lib/model.js";

// Tarjetas de flujo con contexto: descripción, pasos, evidencia y consecuencia de penalidad.
// showRol = muestra el rol responsable (vista del Coordinador / Gerente).
export default function FlujoCards({ etapas, showRol }){
  return <>
    {etapas.map(f => (
      <div key={f.etapa} className="card" style={{marginBottom:10}}>
        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
          <b style={{fontSize:15}}>{f.etapa}</b>
          {showRol && <Tag bg="#1e2a44" color="#cbd5e1">{f.rol}</Tag>}
          <Tag>{f.act}</Tag>
          <Tag>plazo: {f.plazo}</Tag>
          {f.pen!=="—" && <Tag bg="#78350f" color="#fff">penalidad {f.pen}</Tag>}
        </div>
        {f.desc && <div style={{fontSize:12.5,color:"#cbd5e1",margin:"9px 0",lineHeight:1.55}}>{f.desc}</div>}
        <div style={{fontWeight:600,fontSize:10.5,textTransform:"uppercase",letterSpacing:".04em",color:"var(--mut)",margin:"10px 0 4px"}}>Qué se hace</div>
        {f.pasos.map((p,k)=><div className="chk" key={k}><span style={{color:"#64748b"}}>○</span> {p}</div>)}
        <div style={{fontWeight:600,fontSize:10.5,textTransform:"uppercase",letterSpacing:".04em",color:"var(--mut)",margin:"10px 0 4px"}}>Evidencia que sube a Drive</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:5}}>{f.evi.map((e,k)=><Tag key={k}>{e}</Tag>)}</div>
        {f.guia && <div className="note" style={{background:"rgba(31,78,140,.12)",border:"1px solid #25406b",color:"#cbd5e1",marginTop:8,fontSize:12,lineHeight:1.5}}>
          <div><b style={{color:"var(--mut)"}}>Formato admitido:</b> {f.guia.formatos} <span style={{color:"#7c93b3"}}>— PDF de preferencia</span></div>
          <div style={{marginTop:3}}><b style={{color:"var(--mut)"}}>Qué se espera:</b> {f.guia.espera}</div>
        </div>}
        {f.penDesc && <div className="note" style={{background:"rgba(120,53,15,.18)",border:"1px solid #78350f",color:"#fcd34d",marginTop:10}}>Si falla: {f.penDesc}</div>}
      </div>
    ))}
  </>;
}
