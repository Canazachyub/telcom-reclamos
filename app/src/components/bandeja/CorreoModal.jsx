import { useState, useEffect } from "react";
import { correoCompleto, responderCorreo, resumirIA, iaChat } from "../../lib/api.js";
import { toast } from "../ui.jsx";
import {
  fechaHumana_, soloAdjuntosDeTrabajo_, adjuntoNoDescargado_, motivoAdjuntoNoDescargado_,
  iconoAdjunto_, cuerpoTextoPlano_, esEml_, esImg_, previewUrl_, WEBMAIL_URL,
} from "./utils.js";
import { VistaCorreoEml } from "./VistaCorreoEml.jsx";

// Modal de lectura completa del correo: carga el cuerpo (html/text) vía correo_completo y permite
// responder desde el buzón TELCOM. Si el backend aún no implementa el endpoint, avisa sin romper.
// Incluye panel lateral de previsualización de adjuntos (2 columnas en desktop, apilado en móvil).
export function CorreoModal({ correo, verExpediente = () => {}, onClose, onRespondido }){
  const [cargando, setCargando] = useState(true);
  const [detalle, setDetalle] = useState(null);
  const [noDisponible, setNoDisponible] = useState(false);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [w, setW] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
  const [adjSel, setAdjSel] = useState(0);
  const [iaBusy, setIaBusy] = useState(false);
  const [iaAnalisis, setIaAnalisis] = useState("");
  const [sugBusy, setSugBusy] = useState(false);
  const [ampliado, setAmpliado] = useState(false);

  useEffect(() => { const f = () => setW(window.innerWidth); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); }, []);
  const mobile = w < 760;

  let adjuntos = [];
  try { adjuntos = typeof correo.adjuntos_json === "string" ? JSON.parse(correo.adjuntos_json) : (correo.adjuntos_json || []); } catch (e) { adjuntos = []; }
  adjuntos = soloAdjuntosDeTrabajo_(adjuntos);

  useEffect(() => {
    (async () => {
      const r = await correoCompleto(correo.id);
      if (r && r.ok) setDetalle(r);
      else setNoDisponible(true);
      setCargando(false);
    })();
  }, [correo.id]);

  // Primer adjunto seleccionado por defecto si existe.
  useEffect(() => { setAdjSel(0); setAmpliado(false); }, [correo.id]);

  async function enviar(){
    const t = texto.trim();
    if (!t) { toast("Escribe una respuesta antes de enviar"); return; }
    setEnviando(true);
    const r = await responderCorreo(correo.id, t);
    setEnviando(false);
    if (r?.ok) { toast("✓ Respuesta enviada"); setTexto(""); onRespondido?.(); }
    else toast("No se pudo enviar: " + (r?.error || ""));
  }

  const adjActivo = adjuntos[Math.min(adjSel, Math.max(adjuntos.length - 1, 0))];

  async function analizarConIA(){
    const cuerpo = cuerpoTextoPlano_(detalle);
    if (!cuerpo) { toast("No hay contenido del correo para analizar todavía"); return; }
    setIaBusy(true); setIaAnalisis("");
    const r = await resumirIA({
      texto: cuerpo,
      prompt: "Analiza este correo del contrato CP-026-2026-ELSE y responde en 4 líneas: QUÉ PIDEN:, PLAZO/URGENCIA:, RECLAMO(S) MENCIONADO(S):, ACCIÓN RECOMENDADA:",
      reclamo: correo.reclamo_vinculado || "",
      etapa: "correo",
    });
    setIaBusy(false);
    setIaAnalisis(r?.ok ? r.resumen : "⚠ " + (r?.error || "no se pudo analizar (¿configuraste la API key de IA?)"));
  }

  async function sugerirRespuesta(){
    const cuerpo = cuerpoTextoPlano_(detalle);
    if (!cuerpo) { toast("No hay contenido del correo para redactar la respuesta todavía"); return; }
    setSugBusy(true);
    const asunto = detalle?.asunto || correo.asunto || "";
    const remitente = detalle?.de || correo.de || "";
    const r = await iaChat({
      prompt: "Redacta una respuesta formal breve (máx 120 palabras) a este correo, en nombre de TELCOM (contrato CP-026-2026-ELSE), tono cordial peruano formal. Correo: " + cuerpo,
      contexto: asunto + " · " + remitente,
    });
    setSugBusy(false);
    if (r?.ok && r.respuesta) { setTexto(r.respuesta); toast("Sugerencia IA — revísala antes de enviar"); }
    else toast("No se pudo sugerir respuesta: " + (r?.error || ""));
  }

  return (
    <div className="overlay" style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: mobile ? 0 : 16, zIndex: 80 }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        width: mobile ? "100vw" : "min(1500px,97vw)", height: mobile ? "100vh" : "94vh", maxHeight: mobile ? "100vh" : "94vh",
        background: "var(--card)", border: mobile ? "none" : "1px solid var(--bd)", borderRadius: mobile ? 0 : 14,
        padding: 16, boxSizing: "border-box", display: "flex", flexDirection: "column", overflow: "hidden",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 10, gap: 8, flexShrink: 0 }}>
          <div style={{ minWidth: 0 }}>
            <b style={{ color: "var(--titulo)", fontSize: 14 }}>{detalle?.asunto || correo.asunto || "(sin asunto)"}</b>
            <div className="muted" style={{ fontSize: 11.5, marginTop: 3 }}>De: {detalle?.de || correo.de || "—"} · {fechaHumana_(detalle?.fecha || correo.fecha)}</div>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            {correo.reclamo_vinculado && (
              <button className="btn-ghost sm" onClick={() => { verExpediente(correo.reclamo_vinculado); onClose(); }} title="Abrir la Sala del expediente vinculado">📂 Ver expediente</button>
            )}
            <button className="btn sec sm" onClick={onClose}>✕ cerrar</button>
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column" }}>

        {cargando && <div className="muted" style={{ fontSize: 12.5, padding: "20px 0", textAlign: "center" }}>
          <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid var(--bd)", borderTopColor: "var(--navy)", borderRadius: "50%", animation: "girar .8s linear infinite", marginRight: 8, verticalAlign: "middle" }}/>
          Cargando correo…
        </div>}

        {!cargando && noDisponible && (
          <div className="note st-acc">
            La lectura del cuerpo completo se activa tras el próximo redeploy. Esta ventana quedará lista automáticamente en cuanto el backend responda <code>action=correo_completo</code>.
          </div>
        )}

        {!cargando && !noDisponible && detalle && (
          <div style={{ flex: 1, minHeight: mobile ? "auto" : "55vh", display: "flex", flexDirection: mobile ? "column" : "row", gap: 12 }}>
            {/* Columna izquierda: cuerpo del correo */}
            <div style={{ flex: mobile ? "1 1 auto" : "1 1 60%", minWidth: 0, border: "1px solid var(--bd)", borderRadius: 10, overflow: "hidden", minHeight: mobile ? 280 : "55vh", background: "#fff", display: "flex" }}>
              {detalle.html
                ? <iframe title="cuerpo-correo" srcDoc={detalle.html} sandbox="" style={{ flex: 1, width: "100%", height: "100%", minHeight: mobile ? 280 : "55vh", border: 0, background: "#fff" }} />
                : <pre style={{ flex: 1, whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0, padding: 14, fontFamily: "inherit", fontSize: 13.5, color: "#111827", overflowY: "auto" }}>{detalle.text || "(sin contenido)"}</pre>}
            </div>

            {/* Columna derecha: panel de adjuntos + previsualización */}
            {!!adjuntos.length && (
              <div style={{ flex: mobile ? "1 1 auto" : "1 1 40%", minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                <b style={{ color: "var(--titulo)", fontSize: 12.5 }}>📎 Adjuntos ({adjuntos.length})</b>
                <div style={{ display: "flex", flexDirection: mobile ? "row" : "column", gap: 6, flexWrap: "wrap", maxHeight: mobile ? "none" : 140, overflowY: mobile ? "visible" : "auto", flexShrink: 0 }}>
                  {adjuntos.map((a, i) => (
                    <button key={i} onClick={() => setAdjSel(i)} title={adjuntoNoDescargado_(a) ? `No descargado (${motivoAdjuntoNoDescargado_(a)})` : (a.nombre || "adjunto")} style={{
                      textAlign: "left", display: "flex", alignItems: "center", gap: 6, background: i === adjSel ? "var(--navy)" : "var(--card2)",
                      color: i === adjSel ? "#fff" : (adjuntoNoDescargado_(a) ? "var(--tint-amber-tx)" : "var(--tx)"), border: `1px solid ${i === adjSel ? "var(--navy)" : "var(--bd)"}`,
                      borderRadius: 8, padding: "6px 9px", fontSize: 11.5, cursor: "pointer", maxWidth: "100%",
                    }}>
                      <span style={{ flexShrink: 0 }}>{adjuntoNoDescargado_(a) ? "⚠" : iconoAdjunto_(a)}</span>
                      <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.nombre || "adjunto " + (i + 1)}</span>
                    </button>
                  ))}
                </div>
                <div style={{ flex: 1, minHeight: mobile ? 280 : "55vh", border: "1px solid var(--bd)", borderRadius: 10, overflow: "hidden", background: "var(--card2)", display: "flex", flexDirection: "column" }}>
                  {adjActivo && adjActivo.url && (
                    <div style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                      padding: "6px 8px", borderBottom: "1px solid var(--bd)", background: "var(--card2)", flexShrink: 0,
                    }}>
                      <span style={{ minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontSize: 11.5, color: "var(--tx)" }}>
                        {iconoAdjunto_(adjActivo)} {adjActivo.nombre || "adjunto"}
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                        <a className="link" style={{ fontSize: 11 }} href={adjActivo.url} target="_blank" rel="noreferrer">🔗 abrir en Drive ↗</a>
                        <button className="btn-ghost sm" onClick={() => setAmpliado(true)} title="Ampliar adjunto"
                          style={{ background: "var(--card2)", border: "1px solid var(--bd)" }}>
                          ⛶ Ampliar
                        </button>
                      </span>
                    </div>
                  )}
                  <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                    {adjActivo && adjuntoNoDescargado_(adjActivo)
                      ? <div style={{ textAlign: "center", color: "var(--tint-amber-tx)", padding: 20 }}>
                        <div style={{ fontSize: 32 }}>⚠</div>
                        <div style={{ fontSize: 12.5, marginTop: 6, fontWeight: 600 }}>{adjActivo.nombre || "adjunto"}</div>
                        <div style={{ fontSize: 11.5, marginTop: 4, color: "var(--tx)" }}>
                          No se pudo descargar automáticamente ({motivoAdjuntoNoDescargado_(adjActivo)}). Sin vista previa — {" "}
                          <a href={WEBMAIL_URL} target="_blank" rel="noreferrer"
                            title="Abrir webmail de Hostinger (inicia sesión con tu buzón TELCOM)"
                            style={{ color: "var(--tint-amber-tx)", textDecoration: "underline" }}>
                            ábrelo en el webmail
                          </a>.
                        </div>
                        <div style={{ marginTop: 10 }}>
                          <a className="btn sm" href={WEBMAIL_URL} target="_blank" rel="noreferrer"
                            title="Abrir webmail de Hostinger (inicia sesión con tu buzón TELCOM)"
                            style={{ textDecoration: "none", display: "inline-block" }}>
                            📬 Abrir webmail ↗
                          </a>
                        </div>
                      </div>
                      : adjActivo && adjActivo.url
                      ? (esEml_(adjActivo.nombre, adjActivo)
                        ? <VistaCorreoEml idCorreo={correo.id} nombre={adjActivo.nombre} url={adjActivo.url} />
                        : esImg_(adjActivo.nombre)
                          ? <img src={adjActivo.url} alt={adjActivo.nombre} style={{ maxWidth: "100%", maxHeight: "100%" }} />
                          : <iframe title="preview-adjunto" src={previewUrl_(adjActivo.url)} style={{ width: "100%", height: "100%", border: 0 }} />)
                      : <div style={{ textAlign: "center", color: "var(--mut)", padding: 20 }}>
                        <div style={{ fontSize: 32 }}>📎</div>
                        <div style={{ fontSize: 12, marginTop: 6 }}>Selecciona un adjunto para previsualizarlo</div>
                      </div>}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {!cargando && !noDisponible && detalle && (
          <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap", flexShrink: 0 }}>
            <button className="btn sm" disabled={iaBusy} onClick={analizarConIA}>{iaBusy ? "Analizando…" : "🤖 Analizar con IA"}</button>
            <button className="btn sm" disabled={sugBusy} onClick={sugerirRespuesta}>{sugBusy ? "Redactando…" : "✨ Sugerir respuesta"}</button>
          </div>
        )}
        {iaAnalisis && <div style={{ marginTop: 8, background: "var(--tint-acc-bg)", border: "1px solid var(--tint-acc-bd)", borderRadius: 8, padding: "10px 12px", fontSize: 12.5, color: "var(--tx)", whiteSpace: "pre-wrap", lineHeight: 1.5, flexShrink: 0 }}>
          <b style={{ color: "var(--tint-acc-tx)" }}>🤖 Análisis IA del correo:</b><br />{iaAnalisis}</div>}

        <div style={{ marginTop: 14, borderTop: "1px solid var(--bd)", paddingTop: 12, flexShrink: 0 }}>
          <b style={{ color: "var(--titulo)", fontSize: 13 }}>✍️ Responder</b>
          <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={3} placeholder="Escribe tu respuesta…"
            style={{ width: "100%", marginTop: 8, background: "var(--card2)", color: "var(--tx)", border: "1px solid var(--bd)", borderRadius: 8, padding: "8px 10px", fontSize: 12.5, resize: "vertical", boxSizing: "border-box" }} />
          <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>Se enviará desde tu buzón TELCOM · para archivos pesados comparte links de Drive, no adjuntos.</div>
          <div style={{ marginTop: 8, display: "flex", justifyContent: "flex-end" }}>
            <button className="btn sm" onClick={enviar} disabled={enviando}>{enviando ? "Enviando…" : "Enviar"}</button>
          </div>
        </div>
        </div>
      </div>

      {ampliado && adjActivo && adjActivo.url && (
        <div className="overlay" style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 0, zIndex: 90 }} onClick={e => { if (e.target === e.currentTarget) setAmpliado(false); }}>
          <div style={{ width: "95vw", height: "95vh", background: "var(--card)", border: "1px solid var(--bd)", borderRadius: 10, display: "flex", flexDirection: "column", overflow: "hidden" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderBottom: "1px solid var(--bd)", flexShrink: 0 }}>
              <b style={{ color: "var(--titulo)", fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{iconoAdjunto_(adjActivo)} {adjActivo.nombre || "adjunto"}</b>
              <button className="btn sec sm" onClick={() => setAmpliado(false)}>✕ cerrar</button>
            </div>
            <div style={{ flex: 1, minHeight: 0, background: esImg_(adjActivo.nombre) ? "var(--card2)" : "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {esEml_(adjActivo.nombre, adjActivo)
                ? <VistaCorreoEml idCorreo={correo.id} nombre={adjActivo.nombre} url={adjActivo.url} alto="100%" />
                : esImg_(adjActivo.nombre)
                  ? <img src={adjActivo.url} alt={adjActivo.nombre} style={{ maxWidth: "100%", maxHeight: "100%" }} />
                  : <iframe title="preview-adjunto-ampliado" src={previewUrl_(adjActivo.url)} style={{ width: "100%", height: "100%", border: 0 }} />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
