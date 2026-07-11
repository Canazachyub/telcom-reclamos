import { useEffect, useState } from "react";
import { fmtFecha } from "../lib/model.js";
import { CUADERNOS, valCuaderno } from "../lib/cuadernosDef.js";
import { loadCuadernosPorCaso } from "../lib/api.js";
import RegistrarEvento from "./RegistrarEvento.jsx";

const CUAD_POR_FUENTE = {}; CUADERNOS.forEach(c => { CUAD_POR_FUENTE[c.fuente] = c; });

// ════════ FUENTE DE CUADERNOS PARA ESTE CASO (reutilizable: Sala + Drawer) ════════
// Línea de tiempo de dónde aparece ESTE expediente en los cuadernos de control. Clic en el
// nombre del cuaderno → lo abre FILTRADO a este caso (igual que la Sala). Incluye el botón
// «➕ Registrar en cuaderno» (precargado con el suministro).
//  · Si recibe `registros` → modo presentacional (el padre ya los tiene; p.ej. la Sala).
//  · Si NO recibe `registros` → hace su propio fetch (p.ej. el Drawer).
// Columnas que YA se ven arriba (cabecera del caso en la Sala/Drawer: RECLAMO/SUMINISTRO/RUTA)
// — no se repiten por línea en el modo RESUMIDO (son redundantes con esa cabecera). El toggle
// «ver detalle completo» sí las restaura (volcado original, para jefes/auditoría).
const HEADER_PATHS = new Set(["ruta", "reclamo", "suministro"]);

// a) DEDUPE — colapsa SOLO duplicados de contenido IDÉNTICO (los re-sync repiten la misma línea
// sin aportar nada). La clave es la FIRMA COMPLETA del registro (tipo + fecha + todos los campos
// de contenido): dos eventos reales del mismo tipo el mismo día con CUALQUIER campo distinto
// (observación, f2/f3/f4, correlativo…) se conservan ambos. Se queda la PRIMERA que llegó.
function dedupeRegs(regs) {
  const seen = new Set(), out = [];
  (regs || []).forEach(r => {
    const f = String(r.fecha_evento || "").slice(0, 10);
    const k = [r.tipo, f, r.correlativo, r.resolucion, r.f2, r.f3, r.f4, r.estado, r.observaciones, r.extra]
      .map(v => String(v == null ? "" : v).trim()).join("|");
    if (seen.has(k)) return;
    seen.add(k);
    out.push(r);
  });
  return out;
}

export default function CuadernosCaso({ exp, registros, onAbrirCuaderno, onRegistrado, perfil,
  etapaActual, cerrado, mostrarRegistrar = true }) {
  const externo = registros !== undefined;
  const [propio, setPropio] = useState(null);
  const [reg, setReg] = useState(false);
  const [detalleCompleto, setDetalleCompleto] = useState(false); // toggle discreto — jefes que necesiten el volcado de siempre
  const cuadRegs = externo ? registros : propio;

  const cargar = () => loadCuadernosPorCaso(exp.codigo, exp.osinerg).then(r => { setPropio(r || []); return r; });
  useEffect(() => {
    if (externo) return;
    let vivo = true; setPropio(null);
    loadCuadernosPorCaso(exp.codigo, exp.osinerg).then(r => { if (vivo) setPropio(r || []); });
    return () => { vivo = false; };
  }, [exp.codigo, exp.osinerg, externo]);

  const trasRegistrar = () => { if (externo) onRegistrado && onRegistrado(); else cargar(); };

  // volcado COMPLETO — comportamiento de siempre (todos los campos no vacíos), solo para el
  // toggle "ver detalle completo". Se mantiene intacto para no romper lo que ya usan los jefes.
  const detParesCompleto = (def, r) => {
    if (!def) return [];
    const out = [];
    (def.cols || []).forEach(([lbl, path]) => {
      if (!path || path === "item" || path === "fecha_evento") return;
      let v = valCuaderno(r, path); v = String(v == null ? "" : v).trim();
      if (!v) return;
      if (/^\d{4}-\d{2}-\d{2}/.test(v)) v = fmtFecha(v.slice(0, 10));
      out.push({ lbl, v });
    });
    return out;
  };

  // b) SOLO EL DATO NUEVO — cada línea muestra solo lo que aporta algo que aún no se vio: nunca
  // RUTA/RECLAMO/SUMINISTRO (cabecera del caso, arriba) y, del resto, solo si el valor de esa
  // MISMA etiqueta (no la ruta cruda: varios cuadernos reusan f2/f3/f4 con significados distintos
  // — p.ej. "EMISIÓN" vs "FECHA RESO" — pero "CORRELATIVO"/"RESOLUCIÓN" sí repiten etiqueta con el
  // mismo significado en varios cuadernos) es DISTINTO al último valor ya mostrado con esa
  // etiqueta en una línea anterior de este caso. `vistos` viaja MUTADO entre llamadas — se recorre
  // en orden cronológico (mismo `orden` del render) para que "cambia" tenga sentido en el tiempo.
  const detParesNuevo = (def, r, vistos) => {
    if (!def) return [];
    const out = [];
    (def.cols || []).forEach(([lbl, path]) => {
      if (!path || path === "item" || path === "fecha_evento" || HEADER_PATHS.has(path)) return;
      let v = valCuaderno(r, path); v = String(v == null ? "" : v).trim();
      if (!v) return;
      if (/^\d{4}-\d{2}-\d{2}/.test(v)) v = fmtFecha(v.slice(0, 10));
      if (vistos.get(lbl) === v) return; // mismo dato ya mostrado antes con esta etiqueta — no aporta nada nuevo
      vistos.set(lbl, v);
      out.push({ lbl, v });
    });
    return out;
  };

  return (
    <div style={{ background: "var(--card2)", border: "1px solid var(--bd)", borderRadius: 12, padding: "11px 13px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--titulo)" }}>📒 Fuente de cuadernos — este caso {cuadRegs != null && cuadRegs.length > 0 ? "(" + cuadRegs.length + ")" : ""}</div>
        {cuadRegs != null && cuadRegs.length > 0 && <button className="btn-ghost" onClick={() => setDetalleCompleto(v => !v)}
          title={detalleCompleto ? "Volver a la vista resumida (solo lo nuevo por línea)" : "Ver todos los campos de cada línea, sin resumir (para revisión a fondo)"}
          style={{ fontSize: 10.5, padding: "2px 8px", color: "var(--mut)" }}>{detalleCompleto ? "− ver resumido" : "+ ver detalle completo"}</button>}
        {mostrarRegistrar && <button className="btn sm" onClick={() => setReg(true)} title="Anota un paso de ESTE caso en un cuaderno (precargado con su suministro)"
          style={{ marginLeft: "auto", background: "var(--navy)", color: "#fff", border: 0, fontWeight: 700 }}>➕ Registrar en cuaderno</button>}
      </div>
      <div className="muted" style={{ fontSize: 11, margin: "2px 0 8px" }}>Dónde aparece este expediente en los cuadernos de control: cada línea es un paso registrado (inspección, resolución, notificación, apelación…). Clic en el cuaderno para abrirlo filtrado a este caso.</div>
      {cuadRegs == null && <div className="muted" style={{ fontSize: 12 }}>Cargando cuadernos…</div>}
      {cuadRegs != null && cuadRegs.length === 0 && <div className="muted" style={{ fontSize: 12 }}>Este expediente aún no figura en ningún cuaderno.</div>}
      {cuadRegs != null && cuadRegs.length > 0 && (() => {
        // por defecto: a) dedupe de re-sync + b) solo lo nuevo por línea. El toggle restaura el
        // volcado de siempre (sin dedupe, todos los campos) para quien necesite verlo íntegro.
        const base = detalleCompleto ? cuadRegs : dedupeRegs(cuadRegs);
        const orden = [...base].map(r => ({ r, f: String(r.fecha_evento || "").slice(0, 10) }))
          .sort((a, b) => (a.f || "9999") < (b.f || "9999") ? -1 : 1);
        const vistos = new Map(); // etiqueta -> último valor mostrado (progresa en orden cronológico, modo resumido)
        return <div>
          {orden.map(({ r, f }, i) => {
            const def = CUAD_POR_FUENTE[r.tipo], nombre = def ? def.nombre : r.tipo;
            const pares = detalleCompleto ? detParesCompleto(def, r) : detParesNuevo(def, r, vistos);
            const queryCaso = r.reclamo || r.suministro || exp.codigo;
            return <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", position: "relative", paddingBottom: 12 }}>
              <span style={{ position: "absolute", left: 9, top: 19, bottom: 0, width: 2, background: "var(--bd)" }} />
              <span title="Paso registrado" style={{ flexShrink: 0, width: 20, height: 20, borderRadius: "50%", background: "var(--green)", color: "#fff", fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1 }}>✓</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                  <span onClick={() => onAbrirCuaderno && onAbrirCuaderno(r.tipo, queryCaso)}
                    title="Abrir este cuaderno filtrado a este caso" style={{ fontSize: 12.5, fontWeight: 700, color: "var(--linkTx)", cursor: onAbrirCuaderno ? "pointer" : "default", textDecoration: onAbrirCuaderno ? "underline" : "none", textUnderlineOffset: 2 }}>{nombre}</span>
                  <span className="muted" style={{ fontSize: 11 }}>{f ? fmtFecha(f) : "sin fecha"}</span>
                </div>
                {pares.length > 0 && <div style={{ fontSize: 11, marginTop: 2, display: "flex", flexWrap: "wrap", gap: "1px 12px" }}>
                  {pares.map((p, j) => <span key={j}><span className="muted">{p.lbl}:</span> <b style={{ fontWeight: 600, color: "var(--tx)" }}>{p.v}</b></span>)}
                </div>}
              </div>
            </div>;
          })}
          {/* estado actual (SIELSE) — dónde está AHORA (opcional) */}
          {etapaActual && <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span title="Etapa actual" style={{ flexShrink: 0, width: 20, height: 20, borderRadius: "50%", background: "var(--card)", border: "2px solid var(--linkTx)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1 }} />
            <div style={{ fontSize: 12, color: "var(--tx)" }}><b>Ahora:</b> {cerrado ? "Expediente cerrado" : etapaActual} <span className="muted">· etapa actual según SIELSE</span></div>
          </div>}
        </div>;
      })()}
      {reg && <RegistrarEvento perfil={perfil} data={[exp]} sumInicial={exp.suministro || ""}
        onClose={() => setReg(false)} onGuardado={() => { setReg(false); trasRegistrar(); }} />}
    </div>
  );
}
