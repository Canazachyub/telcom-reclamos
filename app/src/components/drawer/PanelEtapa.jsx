import { toast } from "../ui.jsx";
import { Tag } from "../ui.jsx";
import { GuiaSielseBox, GUIA_SIELSE } from "../../lib/guiaSielse.jsx";
import { INFO_ETAPA } from "../../lib/camposEtapa.js";
import CuadernosCaso from "../CuadernosCaso.jsx";
import { Sec } from "./Sec.jsx";
import { PlanEtapa } from "./PlanEtapa.jsx";
import { humaniza } from "./utils.js";

// --- Datos del formulario (lo que llenó el trabajador) --- (columna central del Drawer)
export function PanelEtapa({
  style, esMiEtapa, exp, onAbrirCuaderno, perfil, etapaActualDrawer, cerradoDrawer,
  datosAbierto, setDatosAbierto, s, estPlazo, tk, faltantes, puedeAccion, onEstadoTicket,
  sel, setSel, FLUJO, setDocSel, setSubir, camposEtapaTodos, planDescartado, setPlanDescartado,
  datK, dat, onComentar, docs, ci,
}) {
  return (
    <div style={style}>
      {esMiEtapa && <div style={{ background: "var(--tint-amber-bg)", border: "1px solid var(--tint-amber-bd)", borderRadius: 8, padding: "8px 10px", marginBottom: 10, fontSize: 12.5, color: "var(--tint-amber-tx)" }}>
        ✋ <b>Esta etapa es tuya.</b> 1) 📎 sube la evidencia y llena los datos · 2) 📄 genera el documento si aplica · 3) pulsa «✔ Terminé esta etapa».
      </div>}

      {/* FUENTE DE CUADERNOS de este caso — arriba del panel de la etapa (clic abre el cuaderno filtrado) */}
      <div style={{ marginBottom: 12 }}>
        <CuadernosCaso exp={exp} onAbrirCuaderno={onAbrirCuaderno} perfil={perfil} etapaActual={etapaActualDrawer} cerrado={cerradoDrawer} />
      </div>

      {/* Datos de la etapa — COLAPSABLE (se puede ocultar para dar protagonismo a los cuadernos) */}
      <div onClick={() => setDatosAbierto(v => !v)} title={datosAbierto ? "Ocultar los datos de la etapa" : "Mostrar los datos de la etapa"}
        style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none", padding: "2px 0" }}>
        <span style={{ color: "var(--mut)", fontSize: 12, width: 12 }}>{datosAbierto ? "▾" : "▸"}</span>
        <b style={{ color: "var(--titulo)", fontSize: 13 }}>Datos de la etapa</b>
        {!datosAbierto && <span className="muted" style={{ fontSize: 11 }}>· {s.etapa} ({s.rol}) — clic para mostrar</span>}
      </div>
      {datosAbierto && <>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "8px 0" }}>
        <Tag bg="var(--card2)" color="var(--tx)">👤 {s.rol}</Tag><Tag bg="var(--card2)" color="var(--tx)">{s.act}</Tag><Tag bg="var(--card2)" color="var(--tx)" title="Todos los plazos del contrato son en días HÁBILES (lun-vie sin feriados)">⏱ {s.plazo}</Tag>
        {estPlazo && <Tag bg={estPlazo.c} color={estPlazo.tx}>{estPlazo.t} · {tk.fechaLimite} ({tk.diasRestantes}d háb.)</Tag>}
        {tk && tk.hecho && <Tag bg="var(--tint-green-bg)" color="var(--tint-green-tx)">✓ hecho</Tag>}
      </div>
      {s.quien && (
        <div style={{ background: "var(--card2)", border: "1px solid var(--bd)", borderRadius: 8, padding: "7px 10px", margin: "0 0 10px", fontSize: 12, color: "var(--tx)" }}>
          👥 <b>Quién lo hace:</b> {s.quien}
        </div>
      )}
      {tk?.hecho && faltantes.length > 0 && (
        <div style={{ background: "var(--tint-amber-bg)", border: "1px solid var(--tint-amber-bd)", borderRadius: 8, padding: "7px 10px", margin: "0 0 10px", fontSize: 12, color: "var(--tint-amber-tx)" }}>
          ⚠ Esta etapa figura <b>HECHA</b> pero le faltan {faltantes.length} ítem(s) de datos/evidencia — inconsistencia que ELSE puede observar. Súbelos ahora con «📎 Evidencia + datos», o Coordinación puede reabrirla desde la Sala (clic en la etapa → ↩ Reabrir).
        </div>
      )}
      {puedeAccion && tk.abierto && (() => {
        // Regla de integridad (SIN CAMBIOS): una etapa NO se marca hecha con datos/evidencia
        // faltantes. Operativos: bloqueo real (botón deshabilitado). Coordinación/Gerencia:
        // pueden forzar el cierre, pero el MOTIVO es obligatorio (queda en bitácora).
        const esJefe = ["GERENTE", "COORDINADOR"].includes(perfil?.rol);
        const bloqueado = faltantes.length > 0 && !esJefe;
        return (
          <div style={{ margin: "4px 0 10px" }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {tk.estado === "pendiente" && <button className="btn sm" onClick={() => { onEstadoTicket?.(tk, "en_proceso"); toast("«" + s.etapa + "» en proceso"); setPlanDescartado(p => ({ ...p, [s.etapa]: false })); }}>▶ Iniciar etapa</button>}
              <button className="btn sm" disabled={bloqueado}
                aria-disabled={bloqueado}
                aria-describedby={bloqueado ? "panel-etapa-faltantes-bloqueo" : undefined}
                title={bloqueado ? "Completa lo que falta (abajo) para poder terminar esta etapa" : undefined}
                style={bloqueado
                  ? { background: "var(--card2)", color: "var(--mut)", border: "1px solid var(--bd)", cursor: "not-allowed" }
                  : { background: "var(--green)", color: "var(--ink)", border: 0 }}
                onClick={() => {
                  if (faltantes.length) {
                    if (!esJefe) return; // el botón ya está disabled — defensivo por si el evento se disparara igual
                    const lista = "· " + faltantes.slice(0, 10).join("\n· ") + (faltantes.length > 10 ? "\n…" : "");
                    const motivo = prompt("«" + s.etapa + "» tiene " + faltantes.length + " faltante(s):\n" + lista + "\n\nComo Coordinación/Gerencia puedes cerrarla igual, pero el MOTIVO es obligatorio (queda en la bitácora del caso):");
                    if (motivo == null) return;
                    if (!String(motivo).trim()) { toast("⛔ Sin motivo no se cierra una etapa con faltantes"); return; }
                    onComentar?.({ reclamo: exp.codigo, etapa: s.etapa, texto: "⚠ CIERRE CON FALTANTES (" + faltantes.length + "): " + String(motivo).trim(), nombre: perfil?.nombre });
                  }
                  onEstadoTicket?.(tk, "hecho");
                  const sig = sel < FLUJO.length - 1 ? FLUJO[sel + 1].etapa : null;
                  toast("✓ «" + s.etapa + "» hecha" + (sig ? " · sigue: " + sig : " · expediente cerrado"));
                  if (sig) { setSel(sel + 1); setDocSel(0); setSubir(false); }
                }}>✔ Terminé esta etapa</button>
            </div>
            {/* Protagonista: EXACTAMENTE qué falta, justo debajo del botón deshabilitado.
                id estable + role="status" para que el lector de pantalla lo anuncie cuando
                aparece (aria-describedby del botón «Terminé esta etapa» apunta aquí). */}
            {bloqueado && (
              <div id="panel-etapa-faltantes-bloqueo" role="status" style={{ marginTop: 8, background: "var(--tint-red-bg)", border: "1px solid var(--tint-red-bd)", borderRadius: 8, padding: "8px 10px", fontSize: 12, color: "var(--tint-red-tx)" }}>
                <b>Para terminar «{s.etapa}» todavía falta:</b>
                <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                  {faltantes.slice(0, 10).map((f, i) => <li key={i}>{f}</li>)}
                  {faltantes.length > 10 && <li>… y {faltantes.length - 10} más</li>}
                </ul>
                <div style={{ marginTop: 4 }}>Súbelo con «📎 Evidencia + datos». Si algo no aplica a este caso, pide a Coordinación que lo cierre con motivo.</div>
              </div>
            )}
          </div>
        );
      })()}

      {tk && tk.estado === "en_proceso" && datK.length === 0 && !planDescartado[s.etapa] && (
        <PlanEtapa
          etapa={s.etapa}
          campos={camposEtapaTodos}
          evidencias={s.evi}
          guia={GUIA_SIELSE[s.etapa]}
          onAbrirEvidencia={() => setSubir(true)}
          onCerrar={() => setPlanDescartado(p => ({ ...p, [s.etapa]: true }))}
        />
      )}

      <div style={{ marginTop: 10 }}><GuiaSielseBox etapa={s.etapa} compacta /></div>

      <Sec t="📝 Lo que registró el trabajador (formulario)">
        {datK.length ? <div style={{ display: "grid", gap: 4 }}>
          {datK.map(k => <div key={k} style={{ fontSize: 12.5 }}><b style={{ color: "var(--mut)" }}>{humaniza(k)}:</b> <span style={{ color: "var(--tx)" }}>{String(dat[k])}</span></div>)}
        </div> : <div className="muted" style={{ fontSize: 12 }}>Aún no se registraron datos en esta etapa.</div>}
      </Sec>

      <Sec t="¿Qué hizo / qué falta?">
        {s.pasos.map((p, k) => {
          const done = tk ? tk.hecho : (sel < ci || exp.estado === "Cerrado");
          return (
            <div className="chk" key={k} style={{ alignItems: "flex-start" }}>
              <span style={{ fontWeight: 700, color: done ? "var(--tint-green-tx)" : "var(--tint-red-tx)" }}>{done ? "✓" : "✗"}</span>
              <span style={{ color: "var(--tx)" }}>{p}</span>
            </div>
          );
        })}
      </Sec>
      <Sec t="Evidencia requerida">
        {s.evi.map((ev, k) => { const has = docs.some(d => String(d.nombre).toLowerCase().includes(ev.split(" ")[0].toLowerCase())); return <div className="chk" key={k}><span style={{ fontWeight: 700, color: has ? "var(--tint-green-tx)" : "var(--tint-red-tx)" }}>{has ? "✓" : "✗ falta"}</span> {ev}</div>; })}
      </Sec>
      {INFO_ETAPA[s.etapa] && <div className="note" style={{ background: "var(--tint-acc-bg)", border: "1px solid var(--bd)", color: "var(--tx)", fontSize: 11.5, marginTop: 8 }}>
        <b style={{ color: "var(--linkTx)" }}>Según las bases:</b> {INFO_ETAPA[s.etapa].importa}
      </div>}
      </>}
    </div>
  );
}
