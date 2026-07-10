// Guía del flujo (extraído de App.jsx en F1a).
import { Card, Tag } from "./ui.jsx";
import FlujoCards from "./FlujoCards.jsx";
import { FLUJO } from "../lib/model.js";

// Guía del flujo: las 10 etapas (qué, quién, plazo, evidencia) + normativa y penalidades. Solo consulta.
export default function Guia(){
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
