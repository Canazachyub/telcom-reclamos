import { useState, useMemo } from "react";

// ===================== ⚖ Relojes normativos → mini-calendario interactivo =====================
// Pedido del gerente: "como un calendario de muestra con botones en las fechas calculadas; al
// seleccionar, cuadros llamativos al costado explican qué es o qué está pasando". Motor de datos
// intacto (relojesDelCaso, lib/plazosNormativos.js) — esto es SOLO presentación.

const DOW_REL = ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"];
const MESES_REL = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
const isoDia = d => d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const hoyISO_REL = isoDia(new Date());

// normaliza reloj.base / reloj.limite (Date u ISO) -> "yyyy-mm-dd" (o null)
function isoDeFecha(v){
  if(v==null || v==="") return null;
  const d = v instanceof Date ? v : new Date(v);
  return isNaN(d) ? null : isoDia(d);
}

// reloj.base/reloj.limite vienen como Date (motor puro) — fmtFecha (model.js) solo parsea
// strings "dd/mm/aaaa", así que para estos dos campos formateamos aparte (dd/mm/aaaa, es-PE).
function fmtFechaReloj(v){
  if(v==null || v==="") return "—";
  const d = v instanceof Date ? v : new Date(v);
  return isNaN(d) ? String(v) : d.toLocaleDateString("es-PE");
}

// peor estado entre varios relojes del mismo día (para pintar el botón del día)
const RANGO_ESTADO = { vencido:4, por_vencer:3, ok:2, cumplido:1, no_aplica:0 };
function peorEstado(lista){
  return lista.reduce((peor,r)=> RANGO_ESTADO[r.estado] > RANGO_ESTADO[peor] ? r.estado : peor, "no_aplica");
}

const ESTADO_INFO = {
  vencido:     { pillBg:"var(--tint-red-bg)", pillCl:"var(--tint-red-tx)", txt:"vencido" },
  por_vencer:  { pillBg:"var(--tint-amber-bg)", pillCl:"var(--tint-amber-tx)", txt:"por vencer" },
  ok:          { pillBg:"var(--tint-green-bg)", pillCl:"var(--tint-green-tx)", txt:"en plazo" },
  cumplido:    { pillBg:"var(--card2)", pillCl:"var(--mut)", txt:"cumplido ✓" },
  no_aplica:   { pillBg:"var(--card2)", pillCl:"var(--mut)", txt:"no aplica" },
};

// jerarquía para preseleccionar el reloj/día más urgente: vencido+SAP > vencido > por_vencer (más próximo) > resto
function urgenciaReloj(r){
  if(r.estado==="vencido" && r.esSAP) return 0;
  if(r.estado==="vencido") return 1;
  if(r.estado==="por_vencer" && r.esSAP) return 2;
  if(r.estado==="por_vencer") return 3;
  if(r.estado==="ok") return 4;
  if(r.estado==="cumplido") return 5;
  return 6;
}

export function CalendarioRelojes({ relojes, ladoALado }){
  // días con reloj (agrupados por fecha yyyy-mm-dd), solo los que tienen límite calculado
  const porDia = useMemo(()=>{
    const m = {};
    (relojes||[]).forEach(r=>{
      const k = isoDeFecha(r.limite);
      if(!k) return;
      (m[k] = m[k] || []).push(r);
    });
    return m;
  }, [relojes]);

  // reloj/día más urgente (para preseleccionar) — solo entre los que SÍ tienen fecha
  const relojesConFecha = (relojes||[]).filter(r=>isoDeFecha(r.limite));
  const masUrgente = relojesConFecha.slice().sort((a,b)=>urgenciaReloj(a)-urgenciaReloj(b))[0] || null;
  const diaUrgenteISO = masUrgente ? isoDeFecha(masUrgente.limite) : null;

  // mes inicial: el del límite pendiente más próximo (vencido u por_vencer), si no el mes actual
  const mesInicial = useMemo(()=>{
    if(diaUrgenteISO){ const d=new Date(diaUrgenteISO); return new Date(d.getFullYear(), d.getMonth(), 1); }
    return new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  }, [diaUrgenteISO]);

  const [mes, setMes] = useState(mesInicial);
  const [diaSel, setDiaSel] = useState(diaUrgenteISO);

  const y = mes.getFullYear(), m = mes.getMonth();
  const primero = new Date(y, m, 1);
  const offset = (primero.getDay()+6)%7; // lunes=0
  const nDias = new Date(y, m+1, 0).getDate();
  const celdas = [];
  for(let i=0;i<offset;i++) celdas.push(null);
  for(let d=1; d<=nDias; d++) celdas.push(new Date(y,m,d));

  // días "base" (inicio de cómputo) — solo puntito sutil, no botón
  const basesPorDia = {};
  (relojes||[]).forEach(r=>{ const k=isoDeFecha(r.base); if(k) basesPorDia[k]=true; });

  const relojesDia = diaSel ? (porDia[diaSel]||[]) : [];

  function elegirDia(k){
    setDiaSel(sel => sel===k ? null : k);
  }

  // resumen de una línea
  const nTot = (relojes||[]).length;
  const nVencidos = (relojes||[]).filter(r=>r.estado==="vencido").length;
  const nPorVencer = (relojes||[]).filter(r=>r.estado==="por_vencer").length;
  const nResto = nTot - nVencidos - nPorVencer;

  const apilado = ladoALado;

  const CS = {
    wrap:{ display:"flex", flexDirection: apilado ? "column" : "row", gap:14, marginTop:6, flexWrap:"wrap" },
    colCal:{ flex: apilado ? "1 1 100%" : "1 1 55%", minWidth:260 },
    colTarjeta:{ flex: apilado ? "1 1 100%" : "1 1 45%", minWidth:230 },
    navFila:{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 },
    mesTit:{ minWidth:120, textAlign:"center", fontSize:12.5, fontWeight:700, color:"var(--titulo)", textTransform:"capitalize" },
    navBtn:{ background:"var(--card2)", border:"1px solid var(--bd)", color:"var(--tx)", borderRadius:7, fontSize:12, padding:"3px 9px", cursor:"pointer", fontFamily:"inherit" },
    grid:{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:3 },
    dow:{ textAlign:"center", fontSize:9.5, color:"var(--mut)", fontWeight:700, padding:"1px 0" },
    celdaBase:{ minHeight:30, minWidth:30, borderRadius:7, display:"flex", alignItems:"center", justifyContent:"center",
      position:"relative", fontSize:11, fontFamily:"inherit", transition:"transform .12s ease, box-shadow .12s ease" },
    resumen:{ marginTop:10, fontSize:11.5, color:"var(--tx)", background:"var(--card2)", border:"1px solid var(--bd)", borderRadius:9, padding:"7px 11px" },
    tarjeta:{ background:"var(--card2)", border:"1px solid var(--bd)", borderRadius:12, padding:"11px 12px", height:"100%" },
    cuadro:(cl)=>({ background:"var(--card)", border:"1px solid var(--bd)", borderLeft:"4px solid "+cl, borderRadius:10, padding:"9px 11px", marginBottom:9 }),
    cuadroCab:{ display:"flex", alignItems:"center", gap:7, flexWrap:"wrap", marginBottom:5 },
    pill:(bg,cl)=>({ fontSize:10, fontWeight:700, padding:"2px 9px", borderRadius:999, background:bg, color:cl, marginLeft:"auto" }),
    linea:{ fontSize:11.5, color:"var(--tx)", margin:"2px 0" },
    franjaSAP:(estado)=>({ marginTop:7, fontSize:11, fontWeight:700, borderRadius:8, padding:"6px 9px",
      background: estado==="vencido" ? "var(--tint-red-bg)" : "var(--tint-amber-bg)", color: estado==="vencido" ? "var(--tint-red-tx)" : "var(--tint-amber-tx)" }),
  };

  return (
    <div>
      <div style={CS.wrap}>
        {/* ===== columna calendario (55%) ===== */}
        <div style={CS.colCal}>
          <div style={CS.navFila}>
            <button type="button" style={CS.navBtn} onClick={()=>setMes(new Date(y, m-1, 1))} aria-label="Mes anterior">‹</button>
            <span style={CS.mesTit}>{MESES_REL[m]} {y}</span>
            <button type="button" style={CS.navBtn} onClick={()=>setMes(new Date(y, m+1, 1))} aria-label="Mes siguiente">›</button>
          </div>
          <div style={CS.grid}>
            {DOW_REL.map(d=><div key={d} style={CS.dow}>{d}</div>)}
            {celdas.map((d,i)=>{
              if(!d) return <div key={i}/>;
              const k = isoDia(d);
              const esHoy = k===hoyISO_REL;
              const lista = porDia[k];
              const esBase = basesPorDia[k];
              const sel = diaSel===k;
              let estilo = { ...CS.celdaBase, cursor: lista ? "pointer" : "default", color:"var(--tx)", background:"var(--card2)", border:"1px solid var(--bd)" };
              let contenido = d.getDate();
              let badge = null;
              if(lista && lista.length){
                const peor = peorEstado(lista);
                if(peor==="vencido"){
                  const esSAP = lista.some(r=>r.esSAP && r.estado==="vencido");
                  estilo = { ...estilo, background:"var(--red)", color:"#fff", border:"1px solid var(--red)", fontWeight:700 };
                  contenido = <>{esSAP ? "⚠" : ""}{d.getDate()}</>;
                } else if(peor==="por_vencer"){
                  estilo = { ...estilo, background:"var(--amber)", color:"var(--ink)", border:"1px solid var(--amber)", fontWeight:700 };
                } else if(peor==="ok"){
                  estilo = { ...estilo, border:"2px solid var(--green)", fontWeight:700 };
                } else if(peor==="cumplido"){
                  // verde positivo: "esto YA lo cumplí" — informativo, no alarma
                  estilo = { ...estilo, background:"var(--tint-green-bg)", color:"var(--tint-green-tx)", border:"1px solid var(--tint-green-bd)", fontWeight:700 };
                  contenido = <>{d.getDate()}<span style={{fontSize:9,marginLeft:1}}>✓</span></>;
                }
                if(lista.length>1){
                  badge = (
                    <span style={{ position:"absolute", top:-5, right:-5, minWidth:14, height:14, borderRadius:999,
                      background:"var(--navy)", color:"#fff", fontSize:8.5, fontWeight:700, display:"flex",
                      alignItems:"center", justifyContent:"center", padding:"0 2px", border:"1px solid #fff" }}>{lista.length}</span>
                  );
                }
              }
              if(esHoy) estilo = { ...estilo, boxShadow:"0 0 0 2px var(--navy)" };
              if(sel) estilo = { ...estilo, transform:"scale(1.08)", boxShadow:(estilo.boxShadow?estilo.boxShadow+", ":"")+"var(--shadow-card)" };
              return (
                <button key={i} type="button" disabled={!lista}
                  onClick={()=>elegirDia(k)}
                  title={lista ? (lista.length+" reloj(es) vence(n) este día") : (esBase ? "inicio del cómputo" : undefined)}
                  style={{ ...estilo, appearance:"none" }}>
                  {contenido}
                  {!lista && esBase && <span title="inicio del cómputo" style={{ position:"absolute", bottom:2, width:4, height:4, borderRadius:"50%", background:"var(--navy)" }}/>}
                  {badge}
                </button>
              );
            })}
          </div>

          <div style={CS.resumen}>
            <b style={{color:"var(--titulo)"}}>{nTot}</b> reloj{nTot===1?"":"es"}: <span style={{color:"var(--tint-red-tx)",fontWeight:700}}>{nVencidos} vencido{nVencidos===1?"":"s"}</span> · <span style={{color:"var(--tint-amber-tx)",fontWeight:700}}>{nPorVencer} por vencer</span> · <span style={{color:"var(--tint-green-tx)",fontWeight:700}}>{nResto} en plazo/cumplido{nResto===1?"":"s"}</span>
          </div>
        </div>

        {/* ===== columna tarjeta explicativa (45%) ===== */}
        <div style={CS.colTarjeta}>
          <div style={CS.tarjeta}>
            {!diaSel && (
              <>
                <div style={{fontSize:12.5,color:"var(--tx)",marginBottom:9}}>
                  👉 Toca una fecha marcada para ver qué vence ese día.
                </div>
                <div style={{display:"grid",gap:5,fontSize:11}}>
                  <div><span style={{display:"inline-block",width:10,height:10,borderRadius:3,background:"var(--red)",marginRight:6}}/>vencido</div>
                  <div><span style={{display:"inline-block",width:10,height:10,borderRadius:3,background:"var(--amber)",marginRight:6}}/>por vencer</div>
                  <div><span style={{display:"inline-block",width:10,height:10,borderRadius:3,border:"2px solid var(--green)",marginRight:6}}/>en plazo</div>
                  <div><span style={{display:"inline-block",width:10,height:10,borderRadius:3,background:"var(--tint-green-bg)",border:"1px solid var(--tint-green-bd)",marginRight:6}}/><span style={{color:"var(--tint-green-tx)",fontWeight:700}}>cumplido ✓</span> — actividad ya realizada</div>
                  <div><span style={{display:"inline-block",width:6,height:6,borderRadius:"50%",background:"var(--navy)",marginRight:10}}/>inicio del cómputo (base)</div>
                </div>
              </>
            )}
            {diaSel && !relojesDia.length && (
              <div style={{fontSize:12,color:"var(--mut)"}}>Ese día no tiene relojes con vencimiento — es solo el inicio del cómputo de otro reloj.</div>
            )}
            {diaSel && relojesDia.map(r=>{
              const info = ESTADO_INFO[r.estado] || ESTADO_INFO.no_aplica;
              const icono = (r.esSAP && r.estado==="vencido") ? "🚨" : (r.esSAP ? "⚖" : "⏱");
              const franjaRiesgo = r.esSAP && (r.estado==="vencido" || r.estado==="por_vencer");
              return (
                <div key={r.id} style={CS.cuadro(info.pillCl)}>
                  <div style={CS.cuadroCab}>
                    <span style={{fontSize:15}}>{icono}</span>
                    <b style={{fontSize:12.5,color:"var(--titulo)"}}>{r.nombre}</b>
                    <span style={CS.pill(info.pillBg, info.pillCl)}>{info.txt}</span>
                  </div>
                  {r.estado==="no_aplica" ? (
                    <div style={{fontSize:11.5,color:"var(--mut)"}}>Se activará cuando se registre: {r.nota||"el dato faltante correspondiente."}</div>
                  ) : (
                    <>
                      <div style={CS.linea}><b>QUÉ ES:</b> {r.nota || "reloj normativo del expediente."}</div>
                      {r.base && <div style={CS.linea}><b>ARRANCÓ:</b> {fmtFechaReloj(r.base)}</div>}
                      {r.limite && <div style={CS.linea}><b>VENCE:</b> {fmtFechaReloj(r.limite)}</div>}
                      <div style={CS.linea}>
                        {r.estado==="cumplido"
                          ? "cumplido"+(r.limite?" el "+fmtFechaReloj(r.limite):"")
                          : (r.dias!=null && r.dias<0)
                            ? "venció hace "+Math.abs(r.dias)+" d háb."
                            : (r.dias!=null ? "faltan "+r.dias+" d háb." : "sin fecha calculada")}
                      </div>
                    </>
                  )}
                  {franjaRiesgo && (
                    <div style={CS.franjaSAP(r.estado)}>
                      ⚠ Si este reloj cae: el reclamo puede darse por FUNDADO — penalidad 5.5 (S/300 + el monto).
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
