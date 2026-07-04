import { useState, useRef, useEffect } from "react";
import { FLUJO, ETAPAS, DRIVE_URL, wName } from "../lib/model.js";
import { CAMPOS_ETAPA, CAMPOS_POR_FALLO, rolPuedeEtapa, INFO_ETAPA, AYUDA_CAMPO } from "../lib/camposEtapa.js";
import { Card, Tag, toast } from "./ui.jsx";

const tipoDe = name => {
  const e = (name.split(".").pop()||"").toLowerCase();
  if(["jpg","jpeg","png","gif","webp"].includes(e)) return "IMG";
  if(["xls","xlsx","csv"].includes(e)) return "XLSX";
  if(["doc","docx"].includes(e)) return "DOCX";
  return "PDF";
};
const icoTipo = t => t==="IMG"?"IMG":t==="XLSX"?"XLS":t==="DOCX"?"DOC":"PDF";

export default function Evidencias({ misReclamos, evidencias, onAdd, respId, perfil, onSaveDatos, datosPrev }){
  const [reclamo, setReclamo] = useState(misReclamos[0]?.codigo || "");
  const [etapa, setEtapa] = useState(ETAPAS[0]);
  const [over, setOver] = useState(false);
  const [datos, setDatos] = useState({});
  const [savingDatos, setSavingDatos] = useState(false);
  const [verInfo, setVerInfo] = useState(false);
  const inputRef = useRef();

  const rol = perfil?.rol;
  const esGerente = rol === "GERENTE";
  const especEtapaBase = CAMPOS_ETAPA[etapa];
  // En "Resolución" los campos se amplían según el sentido del fallo elegido (reactivo a SENTIDO_FALLO).
  const extraFallo = etapa === "Resolución" ? (CAMPOS_POR_FALLO[datos.SENTIDO_FALLO] || []) : [];
  const especEtapa = especEtapaBase && extraFallo.length
    ? { ...especEtapaBase, campos: [...especEtapaBase.campos, ...extraFallo] }
    : especEtapaBase;
  const infoEtapa = INFO_ETAPA[etapa];
  const puedeDatos = perfil && especEtapa && rolPuedeEtapa(rol, etapa);

  // Precarga los datos ya registrados de este reclamo+etapa (si los hay)
  useEffect(() => {
    const prev = datosPrev?.[reclamo + "|" + etapa] || {};
    setDatos({ ...prev });
  }, [reclamo, etapa, datosPrev]);

  async function guardarDatos(){
    const llenos = Object.fromEntries(Object.entries(datos).filter(([,v]) => v !== "" && v != null));
    if(!Object.keys(llenos).length){ toast("Completa al menos un campo"); return; }
    setSavingDatos(true);
    await onSaveDatos?.({ exp:reclamo, etapa, rol, campos:llenos });
    setSavingDatos(false);
    toast("Datos de «"+etapa+"» guardados");
  }

  const hoy = "2026-06-21";
  const subidasHoy = evidencias.filter(e => e.fecha===hoy && e.resp===respId);
  const porReclamo = {};
  subidasHoy.forEach(e => { (porReclamo[e.exp] = porReclamo[e.exp]||[]).push(e); });

  function handleFiles(files){
    if(!reclamo){ toast("Selecciona primero el reclamo"); return; }
    [...files].forEach(f => onAdd({ exp:reclamo, etapa, nombre:f.name, tipo:tipoDe(f.name), fecha:hoy, resp:respId }));
    toast(files.length+" archivo(s) → Drive · "+reclamo+" · "+etapa);
  }

  const meta = FLUJO.find(f=>f.etapa===etapa);
  const docsEtapa = evidencias.filter(e=>e.exp===reclamo && e.etapa===etapa);
  const checklist = (meta?.evi||[]).map(ev => ({
    ev, ok: docsEtapa.some(d => d.nombre.toLowerCase().includes(ev.split(" ")[0].toLowerCase()))
  }));

  return <>
    <Card>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <h3 style={{margin:0}}>Subir evidencia del día · {etapa}</h3>
        <button onClick={()=>setVerInfo(v=>!v)} title="¿Qué es esta etapa según las bases?"
          style={{width:24,height:24,borderRadius:"50%",border:"1px solid #1F4E8C",background:verInfo?"#1F4E8C":"transparent",
                  color:verInfo?"#fff":"#60a5fa",fontWeight:700,fontStyle:"italic",cursor:"pointer",lineHeight:1,fontFamily:"Georgia,serif"}}>i</button>
      </div>
      {verInfo && infoEtapa && (
        <div className="note" style={{background:"rgba(31,78,140,.15)",border:"1px solid #1F4E8C",color:"#cbd5e1",margin:"10px 0"}}>
          <div style={{fontWeight:700,marginBottom:6,color:"#93c5fd"}}>«{etapa}» — según las bases (Directiva OSINERGMIN 269-2014)</div>
          <div className="kv"><b>Qué es</b><span>{infoEtapa.que_es}</span></div>
          <div className="kv"><b>Por qué importa</b><span>{infoEtapa.importa}</span></div>
          <div className="kv"><b>Plazo</b><span>{infoEtapa.plazo}</span></div>
          <div className="kv"><b>Penalidad en juego</b><span style={{color:infoEtapa.pen==="—"?"#94a3b8":"#fca5a5"}}>
            {infoEtapa.pen}{esGerente && infoEtapa.penMonto ? "  ·  "+infoEtapa.penMonto : ""}
          </span></div>
          {!esGerente && infoEtapa.pen!=="—" && <div className="muted" style={{fontSize:11,marginTop:4}}>El importe en S/ lo gestiona Gerencia.</div>}
        </div>
      )}
      <div style={{display:"flex",gap:8,flexWrap:"wrap",margin:"12px 0"}}>
        <select className="flt" value={reclamo} onChange={e=>setReclamo(e.target.value)} style={{minWidth:200}}>
          {misReclamos.length? misReclamos.map(r=><option key={r.id} value={r.codigo}>{r.osinerg} · {r.solicitante.slice(0,22)}</option>) : <option value="">Sin reclamos asignados</option>}
        </select>
        <select className="flt" value={etapa} onChange={e=>setEtapa(e.target.value)}>{ETAPAS.map(e=><option key={e}>{e}</option>)}</select>
      </div>

      <div className={"drop"+(over?" over":"")}
        onClick={()=>inputRef.current?.click()}
        onDragOver={e=>{e.preventDefault();setOver(true);}}
        onDragLeave={()=>setOver(false)}
        onDrop={e=>{e.preventDefault();setOver(false);handleFiles(e.dataTransfer.files);}}>
        <div style={{fontSize:14,color:"#cbd5e1"}}>Arrastra aquí los PDF / imágenes del trabajo</div>
        <div style={{fontSize:12,marginTop:4}}>o haz clic para seleccionar · se archivan en <span className="mono">/{reclamo||"{reclamo}"}/{etapa}</span></div>
        <input ref={inputRef} type="file" multiple hidden onChange={e=>handleFiles(e.target.files)}/>
      </div>

      {meta?.guia && <div className="note" style={{background:"rgba(31,78,140,.15)",border:"1px solid #1F4E8C",color:"#cbd5e1",marginTop:14}}>
        <div style={{fontWeight:600,marginBottom:8}}>Qué subir en «{etapa}» — guía según las bases</div>
        <div className="kv"><b>Documentos</b><span>{meta.evi.join(" · ")}</span></div>
        <div className="kv"><b>Formato admitido</b><span>{meta.guia.formatos}</span></div>
        <div className="kv"><b>Recomendado</b><span><b>PDF de preferencia.</b> El expediente final debe ser un único PDF foliado; las fotos en JPG/PNG se integran a ese PDF.</span></div>
        <div className="kv"><b>Qué se espera</b><span>{meta.guia.espera}</span></div>
      </div>}

      <div style={{marginTop:14}}>
        <div style={{fontWeight:600,fontSize:12,color:"#cbd5e1",marginBottom:6}}>Estado de la evidencia en «{etapa}»</div>
        {checklist.length? checklist.map((c,i)=>(
          <div key={i} className="chk"><span style={{color:c.ok?"#22c55e":"#ef4444"}}>{c.ok?"✓":"pendiente"}</span> {c.ev}</div>
        )) : <div className="muted" style={{fontSize:12}}>Etapa sin evidencia obligatoria.</div>}
        <a className="link" style={{fontSize:12}} href={DRIVE_URL} target="_blank" rel="noreferrer">Abrir carpeta en Drive ↗</a>
      </div>
    </Card>

    {especEtapa && (
      <Card style={{marginTop:14}}>
        <h3>Datos de «{etapa}» {puedeDatos ? "" : "— solo lectura"}</h3>
        <div className="muted" style={{fontSize:12,marginBottom:10}}>
          {especEtapa.nota} {!puedeDatos && <em>· esta etapa la registra: {especEtapa.roles.join(", ")}</em>}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          {especEtapa.campos.map(c => (
            <label key={c.k} title={AYUDA_CAMPO[c.k]||""} style={{fontSize:12.5,gridColumn:c.tipo==="textarea"?"1 / -1":undefined}}>
              <span style={{color:"#94a3b8"}}>{c.label}{AYUDA_CAMPO[c.k] && <span style={{color:"#60a5fa",cursor:"help"}} title={AYUDA_CAMPO[c.k]}> ⓘ</span>}</span>
              {c.tipo==="select" ? (
                <select disabled={!puedeDatos} value={datos[c.k]||""} onChange={e=>setDatos(d=>({...d,[c.k]:e.target.value}))} style={inDato}>
                  <option value="">—</option>{c.opciones.map(o=><option key={o} value={o}>{o}</option>)}
                </select>
              ) : c.tipo==="textarea" ? (
                <textarea rows={2} disabled={!puedeDatos} value={datos[c.k]||""} onChange={e=>setDatos(d=>({...d,[c.k]:e.target.value}))} style={inDato}/>
              ) : (
                <input type={c.tipo==="num"?"number":"text"} placeholder={c.ph||""} disabled={!puedeDatos}
                  value={datos[c.k]||""} onChange={e=>setDatos(d=>({...d,[c.k]:e.target.value}))} style={inDato}/>
              )}
            </label>
          ))}
        </div>
        {puedeDatos && (
          <div style={{marginTop:12,display:"flex",alignItems:"center",gap:10}}>
            <button onClick={guardarDatos} disabled={savingDatos} className="btn-primary"
              style={{background:"#1F4E8C",color:"#fff",border:0,borderRadius:8,padding:"8px 16px",fontSize:13,cursor:"pointer",fontWeight:600}}>
              {savingDatos?"Guardando…":"Guardar datos de la etapa"}
            </button>
            <span className="muted" style={{fontSize:11}}>Se guardan en la base y luego prellenan los documentos de esta fase.</span>
          </div>
        )}
      </Card>
    )}

    <Card style={{marginTop:14}}>
      <h3>Subidas de hoy ({subidasHoy.length})</h3>
      {Object.keys(porReclamo).length? Object.entries(porReclamo).map(([cod,list])=>(
        <div key={cod} style={{marginBottom:12}}>
          <div className="mono" style={{fontSize:12,color:"#93c5fd",marginBottom:6}}>{cod}</div>
          {list.map((e,i)=>(
            <div className="evic" key={i}>
              <div className="th">{icoTipo(e.tipo)}</div>
              <div style={{flex:1}}><a className="link" href={DRIVE_URL} target="_blank" rel="noreferrer">{e.nombre}</a><div className="muted" style={{fontSize:11}}>{e.etapa}</div></div>
              <Tag>{wName(e.resp)}</Tag>
            </div>
          ))}
        </div>
      )) : <div className="muted" style={{fontSize:12}}>Aún no subes documentos hoy. Arrastra tus PDF arriba.</div>}
    </Card>
  </>;
}

const inDato = { width:"100%", marginTop:3, padding:"7px 9px", borderRadius:8, fontSize:13,
  fontFamily:"inherit", background:"#0e1726", color:"#e2e8f0", border:"1px solid #334155" };
