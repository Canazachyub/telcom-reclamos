// Modal ARCHIVAR CASO (extraído de App.jsx en F1a).
import { useState } from "react";
import { toast } from "./ui.jsx";
import { subirArchivo } from "../lib/api.js";

// Modal ARCHIVAR CASO — 2 formas: (1) archivar directo; (2) archivar adjuntando el foliado y/o la
// constancia de cierre en PDF (se guardan en el Drive del caso y quedan previsualizables en la Sala).
export default function ArchivarCaso({ info, onArchivar, onSubido, onClose }){
  const rec = info.rec, codigo = info.codigo;
  const [motivo, setMotivo] = useState("");
  const [foliado, setFoliado] = useState(null);
  const [cierre, setCierre] = useState(null);
  const [busy, setBusy] = useState(false);
  const subeUno = async (file, etapaNN, etapa) => {
    const r = await subirArchivo(codigo, etapaNN, file);
    if(r && r.url) onSubido && onSubido({ exp:String(codigo), etapa, nombre:r.nombre||file.name, tipo:"PDF", url:r.url, fecha:new Date().toISOString().slice(0,10), usuario:"", resp:0 });
    return r;
  };
  const archivar = async () => {
    setBusy(true);
    try{
      if(foliado) await subeUno(foliado, "09_Foliado", "Foliado");
      if(cierre)  await subeUno(cierre,  "10_Cierre",  "Cierre");
      await onArchivar(codigo, motivo || ((foliado||cierre) ? "archivado con foliado/cierre" : "archivado por coordinación"));
      onClose();
    }catch(e){ toast("Error al archivar: "+e); setBusy(false); }
  };
  const inpFile = (label, file, setFile, hint) => (
    <label style={{fontSize:12,display:"flex",flexDirection:"column",gap:3,background:"var(--card2)",border:"1px solid var(--bd)",borderRadius:8,padding:"8px 10px"}}>
      <span style={{fontWeight:600}}>{label} {file && <span style={{color:"#15803D"}}>· {file.name}</span>}</span>
      <span className="muted" style={{fontSize:10.5}}>{hint}</span>
      <input type="file" accept=".pdf,application/pdf" onChange={e=>setFile(e.target.files && e.target.files[0] || null)} style={{fontSize:11,marginTop:2}}/>
    </label>
  );
  return <div className="modal-bg" onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(22,41,75,.45)",zIndex:95,display:"flex",alignItems:"center",justifyContent:"center"}}>
    <div onClick={e=>e.stopPropagation()} style={{background:"var(--card,#fff)",borderRadius:12,padding:18,width:"min(560px,94vw)",maxHeight:"90vh",overflowY:"auto",boxShadow:"0 12px 40px rgba(0,0,0,.25)"}}>
      <h3 style={{marginTop:0}}>🗄 Archivar caso</h3>
      <div className="muted" style={{fontSize:12,marginBottom:10}}>
        <b>{rec?.osinerg || codigo}</b>{rec?.solicitante ? " · "+rec.solicitante : ""}. Se marca <b>CERRADO</b> y todas sus
        etapas como hechas → sale de la cola, de vencidos y del riesgo SAP. Úsalo para casos que YA están cerrados.
      </div>
      <label style={{fontSize:12,display:"flex",flexDirection:"column",gap:3,marginBottom:10}}>
        <span className="muted">Motivo / observación (opcional)</span>
        <input value={motivo} onChange={e=>setMotivo(e.target.value)} placeholder="p. ej. cerrado en SIELSE / entregado a ELSE"/>
      </label>
      <div className="muted" style={{fontSize:11,margin:"4px 0 6px",fontWeight:600}}>Regularizar el archivo (opcional) — se guarda en el Drive del caso y se previsualiza en la Sala:</div>
      <div style={{display:"grid",gap:8}}>
        {inpFile("📎 Expediente foliado (PDF)", foliado, setFoliado, "Va a la carpeta 09_Foliado del caso")}
        {inpFile("📎 Constancia de cierre (PDF)", cierre, setCierre, "Va a la carpeta 10_Cierre del caso")}
      </div>
      <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:14}}>
        <button className="btn sm" onClick={onClose} disabled={busy}>Cancelar</button>
        <button className="btn sm primary" onClick={archivar} disabled={busy}>{busy ? "Archivando…" : ((foliado||cierre) ? "Subir y archivar" : "Archivar")}</button>
      </div>
    </div>
  </div>;
}
