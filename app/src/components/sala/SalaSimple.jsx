import { ETAPAS, fmtFecha, wColor } from "../../lib/model.js";
import { CUADERNOS } from "../../lib/cuadernosDef.js";
import { iniciales } from "./utils.js";
import { TarjetaQR } from "./TarjetaQR.jsx";

// ===== Sala del expediente — vista FÁCIL ============================================
// Pedido literal del gerente: "dos visiones de Sala: uno completo y otro fácil de
// entender... para tramitadores adultos poco tecnológicos, en celular". Tipografía grande,
// cero jerga, una sola acción principal (Trabajar esta etapa). El detalle completo
// (relojes SAP, ficha de 45 columnas, feed, correos) vive detrás del botón "🔍 Detalles"
// en SalaExpediente.jsx — este componente NO duplica esa información, solo la resume.

const CUAD_POR_FUENTE = {}; CUADERNOS.forEach(c => { CUAD_POR_FUENTE[c.fuente] = c; });

// semáforo simple con días — mismos umbrales que el plazoPill clásico de SalaExpediente
// (vencido = rojo, ≤2 días hábiles = ámbar, resto = verde): "el rojo se gana", nunca antes.
function estadoSimple(act, cerrado){
  if(cerrado) return { icono:"🟢", texto:"expediente completado", bg:"var(--tint-green-bg)", cl:"var(--tint-green-tx)" };
  if(!act) return { icono:"⚪", texto:"sin plazo registrado", bg:"var(--card2)", cl:"var(--mut)" };
  if(act.vencido) return { icono:"🔴", texto:"vencido hace "+Math.abs(act.diasRestantes||0)+" días hábiles", bg:"var(--tint-red-bg)", cl:"var(--tint-red-tx)" };
  if(act.diasRestantes!=null && act.diasRestantes<=2) return { icono:"🟡", texto:"quedan "+act.diasRestantes+" días hábiles", bg:"var(--tint-amber-bg)", cl:"var(--tint-amber-tx)" };
  return { icono:"🟢", texto: act.diasRestantes!=null ? "quedan "+act.diasRestantes+" días hábiles" : "sin plazo registrado", bg:"var(--tint-green-bg)", cl:"var(--tint-green-tx)" };
}

// "¿Qué sigue?" — una sola frase derivada de FLUJO (primera oración de su descripción);
// si la etapa no tiene descripción registrada, cae al genérico pedido por el gerente.
function queSigue(flujoInfo, etapaActual){
  const desc = flujoInfo?.desc || "";
  const frase = desc.split(/(?<=[.:])\s+/)[0];
  return frase || ("Completar "+(etapaActual||"la etapa")+" y marcar Terminé.");
}

// último paso visto en los CUADERNOS (Excel) — 1 sola línea, el más reciente por fecha_evento.
function ultimoCuaderno(cuadRegs){
  if(!cuadRegs || !cuadRegs.length) return null;
  const orden = [...cuadRegs].sort((a,b)=> String(b.fecha_evento||"").localeCompare(String(a.fecha_evento||"")));
  const r = orden[0];
  const def = CUAD_POR_FUENTE[r.tipo];
  return {
    nombre: (def?.emoji ? def.emoji+" " : "")+(def ? def.nombre : (r.tipo||"cuaderno")),
    fecha: r.fecha_evento ? fmtFecha(String(r.fecha_evento).slice(0,10)) : "",
  };
}

export default function SalaSimple({ exp, act, etapaActual, flujoInfo, cerrado, hechas, totalEtapas,
  propios, cuadRegs, qrImg, onTrabajar, onIrADetalles }){
  const total = totalEtapas || ETAPAS.length;
  // todas las etapas en simple (pedido gerencia 2026-07-11): ✓ hechas · ▶ actual · ○ pendientes.
  // Con tickets del caso (propios) se usa su estado real; sin tickets (respaldo v1) se deriva
  // de la posición de la etapa actual en el flujo.
  const idxActual = ETAPAS.indexOf(etapaActual);
  const estadoEtapa = (et, i) => {
    const t = (propios||[]).find(x => x.etapa === et);
    if (t) return t.hecho ? "hecha" : (et === etapaActual && !cerrado ? "actual" : "pendiente");
    if (cerrado) return "hecha";
    if (i < idxActual) return "hecha";
    return i === idxActual ? "actual" : "pendiente";
  };
  const est = estadoSimple(act, cerrado);
  const ultimo = ultimoCuaderno(cuadRegs);

  const S = {
    card:{ background:"var(--card)", border:"1px solid var(--bd)", borderRadius:16, padding:"18px 20px" },
    bloque:{ marginTop:16 },
    etiqueta:{ fontSize:11, textTransform:"uppercase", letterSpacing:".05em", color:"var(--mut)", fontWeight:700, marginBottom:6 },
    semaforo:{ display:"inline-flex", alignItems:"center", gap:8, background:est.bg, color:est.cl, fontWeight:800, fontSize:16, borderRadius:12, padding:"10px 16px" },
    ava:(c)=>({ width:34, height:34, borderRadius:"50%", background:c||"var(--acc)", color:"#fff", display:"inline-flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:700, flexShrink:0 }),
    botonGrande:{ display:"block", width:"100%", minHeight:56, fontSize:18, fontWeight:800, borderRadius:14, border:0, background:"var(--acc)", color:"#fff", cursor:"pointer", marginTop:18 },
    dots:{ display:"flex", gap:6, marginTop:8, flexWrap:"wrap" },
    dot:(on)=>({ width:16, height:16, borderRadius:"50%", background: on ? "var(--green)" : "var(--bd)", flexShrink:0 }),
    cuadLinea:{ display:"flex", alignItems:"center", gap:8, marginTop:8, fontSize:13.5, color:"var(--linkTx)", cursor:"pointer", textDecoration:"underline", textUnderlineOffset:2, minHeight:44 },
  };

  return (
    <div>
      {/* ===== reclamante + identificadores que el equipo usa con ELSE ===== */}
      <div style={S.card}>
        <div style={{fontSize:"clamp(16px,4.5vw,18px)", fontWeight:800, color:"var(--titulo)", lineHeight:1.25}}>
          {exp.solicitante || "Reclamante sin nombre registrado"}
        </div>
        <div style={{fontSize:14, color:"var(--mut)", marginTop:6}}>
          ⚡ <span className="mono" style={{color:"var(--tx)"}}>{exp.suministro || "—"}</span>
          {"  ·  N° "}<b className="mono" style={{color:"var(--tx)"}}>{exp.osinerg || exp.codigo}</b>
        </div>

        {/* ===== ¿Dónde está? ===== */}
        <div style={S.bloque}>
          <div style={S.etiqueta}>¿Dónde está?</div>
          <div style={{fontSize:16, fontWeight:700, color:"var(--titulo)"}}>{cerrado ? "Expediente cerrado" : etapaActual}</div>
          <div style={S.semaforo}><span style={{fontSize:20}}>{est.icono}</span> {est.texto}</div>
          <div style={{marginTop:10, display:"flex", alignItems:"center", gap:10, fontSize:14}}>
            <span style={S.ava(act?wColor(act.respId):"var(--mut2)")}>{iniciales(act?act.responsable:"—")}</span>
            <span>La tiene: <b style={{color:"var(--titulo)"}}>{act ? act.responsable : (cerrado ? "— (cerrado)" : "—")}</b></span>
          </div>
        </div>

        {/* ===== ¿Qué sigue? ===== */}
        {!cerrado && (
          <div style={S.bloque}>
            <div style={S.etiqueta}>¿Qué sigue?</div>
            <div style={{fontSize:14.5, color:"var(--tx)", lineHeight:1.45}}>{queSigue(flujoInfo, etapaActual)}</div>
          </div>
        )}

        {/* ===== acción principal ===== */}
        {!cerrado && (
          <button style={S.botonGrande} onClick={()=>onTrabajar(exp.id, act ? act.etapa : null)}>
            ▶ Trabajar esta etapa
          </button>
        )}

        {/* ===== TODAS las etapas, en simple (✓ hecha · ▶ actual · ○ pendiente) ===== */}
        <div style={S.bloque}>
          <div style={S.etiqueta}>Avance — {hechas} de {total} etapas hechas</div>
          <div style={{display:"grid", gap:4, marginTop:6}}>
            {ETAPAS.map((et,i)=>{
              const st = estadoEtapa(et, i);
              const esActual = st==="actual";
              return (
                <div key={et} style={{display:"flex", alignItems:"center", gap:10, minHeight:30,
                  padding:"3px 10px", borderRadius:8,
                  background: esActual ? "var(--tint-acc-bg)" : "transparent",
                  border: esActual ? "1px solid var(--tint-acc-bd)" : "1px solid transparent"}}>
                  <span style={{width:20, textAlign:"center", fontSize:14,
                    color: st==="hecha" ? "var(--green)" : esActual ? "var(--acc)" : "var(--mut2)"}}>
                    {st==="hecha" ? "✓" : esActual ? "▶" : "○"}
                  </span>
                  <span style={{fontSize:13.5, fontWeight: esActual ? 800 : 500,
                    color: st==="hecha" ? "var(--tx2)" : esActual ? "var(--titulo)" : "var(--mut)"}}>
                    {i+1}. {et}{esActual && !cerrado ? "  ← aquí está" : ""}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ===== último paso en cuadernos (1 línea, clic abre Detalles) ===== */}
        <div style={S.bloque}>
          <div style={S.etiqueta}>Último paso en cuadernos</div>
          {cuadRegs===null && <div className="muted" style={{fontSize:12.5}}>Cargando…</div>}
          {cuadRegs && !ultimo && <div className="muted" style={{fontSize:12.5}}>Aún no figura en ningún cuaderno.</div>}
          {ultimo && (
            <div style={S.cuadLinea} onClick={onIrADetalles} title="Ver el detalle completo en Detalles">
              📒 {ultimo.nombre}{ultimo.fecha ? " · "+ultimo.fecha : ""}
            </div>
          )}
        </div>
      </div>

      {/* ===== QR chico del caso ===== */}
      {exp.suministro && <TarjetaQR exp={exp} qrImg={qrImg} cuadRegs={cuadRegs} />}
    </div>
  );
}
