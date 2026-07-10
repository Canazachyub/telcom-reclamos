// Pestaña "Personal" (Admin, solo Gerente) — extraído de App.jsx en F1a.
import { Card } from "./ui.jsx";
import { TEAM } from "../lib/model.js";

export default function Personal({ data }){
  const cvm={1:"Araujo",2:"Marroquin",3:"Vargas",4:"Montufar",5:"Leon",6:"Condori",7:"Ramos",8:"Hurtado"};
  return <Card><h3>Personal — carga y CV</h3><div style={{overflowX:"auto"}}><table className="tbl"><thead><tr><th>Nombre</th><th>Rol</th><th>Reclamos</th><th>En atención</th><th>CV</th></tr></thead><tbody>
    {TEAM.map(t=>{const l=data.filter(x=>x.resp===t.id);return <tr key={t.id}><td><span className="dot" style={{background:t.color}}/>{t.nombre}</td><td>{t.rol}</td><td>{l.length}</td><td>{l.filter(x=>x.estadoCom==="EN ATENCION").length}</td><td><a className="link" href={"../../70_Personal/CV-"+cvm[t.id]+".md"} target="_blank" rel="noreferrer">ver CV ↗</a></td></tr>;})}
    <tr><td className="muted">Externos / Call Center</td><td className="muted">No es del equipo</td><td>{data.filter(x=>x.resp===0).length}</td><td>{data.filter(x=>x.resp===0&&x.estadoCom==="EN ATENCION").length}</td><td>—</td></tr>
  </tbody></table></div></Card>;
}
