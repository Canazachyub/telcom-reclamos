// Pestaña "Conexión" (Admin, solo Gerente) — extraído de App.jsx en F1a.
import { Card } from "./ui.jsx";
import { SHEET_URL, DRIVE_URL } from "../lib/model.js";

export default function Conexion(){
  const tabs=[["usuarios","id, usuario, pin_hash, nombre, rol, resp_id, activo"],["reclamos","45 columnas SIELSE + resp_id, etapa, estado_app, carpeta_drive"],["registros","fecha, tipo, reclamo, usuario, detalle (log único append-only)"],["tickets","ticket_id, reclamo, etapa, responsable, estado, fecha_limite, vencido, exposicion (v2)"],["etapas / penalidades / feriados","catálogos v2 (sembrados por setupV2)"],["datos_etapa / archivos / calendario","operativas v2"]];
  return <Card><h3>Conexión a Google Sheets + Drive (Apps Script)</h3>
    <div className="row"><span>Google Sheets (base de datos)</span><a className="link" href={SHEET_URL} target="_blank" rel="noreferrer">abrir hoja ↗</a></div>
    <div className="row"><span>Google Drive (evidencias)</span><a className="link" href={DRIVE_URL} target="_blank" rel="noreferrer">abrir carpeta ↗</a></div>
    <div style={{fontSize:12,color:"var(--tx2)",margin:"12px 0 4px"}}><b>Hojas del libro:</b></div>
    <div style={{overflowX:"auto"}}><table className="tbl"><thead><tr><th>Hoja</th><th>Columnas</th></tr></thead><tbody>{tabs.map(t=><tr key={t[0]}><td><b className="mono">{t[0]}</b></td><td className="muted">{t[1]}</td></tr>)}</tbody></table></div>
    <div className="note" style={{background:"#EAF1F9",border:"1px solid #A9C3E4",color:"var(--tx2)"}}><b>Activación:</b> 1) setup() y setupV2() en Apps Script · 2) generarTickets() + trigger horario recalcularPlazos() · 3) publicar Web App (redeploy) · 4) api.js: APPS_SCRIPT_URL actualizada.</div>
  </Card>;
}
