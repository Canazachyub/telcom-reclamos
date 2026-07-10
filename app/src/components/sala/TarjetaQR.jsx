import { descargarQR, imprimirQRs } from "../../lib/qr.js";

// ===== QR del caso (por suministro) — descargar PNG / imprimir / pegar en el libro =====
export function TarjetaQR({ exp, qrImg, cuadRegs }){
  const corr = [...new Set((cuadRegs||[]).map(r=>String(r.correlativo||"").trim()).filter(Boolean))].slice(0,6);
  return (
    <div style={{marginTop:14,display:"flex",gap:14,alignItems:"center",flexWrap:"wrap",background:"var(--card2)",border:"1px solid var(--bd)",borderRadius:12,padding:"12px 14px"}}>
      <div style={{background:"#fff",padding:6,borderRadius:8,flexShrink:0}}>
        {qrImg ? <img src={qrImg} alt="QR del caso" style={{width:112,height:112,display:"block"}}/> : <div style={{width:112,height:112,display:"flex",alignItems:"center",justifyContent:"center",color:"#6B7280",fontSize:11}}>QR…</div>}
      </div>
      <div style={{flex:1,minWidth:180}}>
        <div style={{fontSize:13.5,fontWeight:700,color:"var(--titulo)"}}>📱 QR del caso</div>
        <div className="muted" style={{fontSize:11,margin:"1px 0 6px"}}>Pégalo en el libro físico: al escanearlo, abre este caso en la plataforma para documentar el evento.</div>
        <div style={{fontSize:12,lineHeight:1.7}}>
          <div><span className="muted">Suministro:</span> <b className="mono">{exp.suministro}</b></div>
          <div><span className="muted">Reclamo:</span> <b className="mono">{exp.osinerg||exp.codigo}</b></div>
          {corr.length>0 && <div><span className="muted">Correlativos:</span> <b>{corr.join(" · ")}</b></div>}
        </div>
        <div style={{display:"flex",gap:8,marginTop:9,flexWrap:"wrap"}}>
          <button className="btn sm" onClick={()=>descargarQR(exp.suministro, "QR_"+(exp.suministro))}>⬇ Descargar PNG</button>
          <button className="btn sm" onClick={()=>imprimirQRs([{suministro:exp.suministro,reclamante:exp.solicitante,osinerg:exp.osinerg||exp.codigo}], "QR — "+(exp.osinerg||exp.codigo))}>🖨 Imprimir etiqueta</button>
        </div>
      </div>
    </div>
  );
}
