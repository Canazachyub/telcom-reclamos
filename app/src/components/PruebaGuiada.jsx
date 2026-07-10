import { useState, useEffect, useMemo } from "react";
import { postAction } from "../lib/api.js";
import { toast } from "./ui.jsx";

// ===================== Guía viva + canal de sugerencias =====================
// Botón flotante "Prueba guiada": abre un panel lateral (overlay suave, no bloquea la app)
// con un checklist de pasos SEGÚN EL ROL del perfil. Cada paso se marca ✓ y queda persistido
// en localStorage por usuario+paso. Botón flotante "Sugerencia": mini-form que cae en
// Equipo → "Mejoras sugeridas" (filtra por prefijo MEJORA:).
//
// Cada paso tiene 3 campos que se muestran en 3 líneas con labels grises:
//   t   = título corto y sobrio
//   que = "Qué harás" — la acción concreta en 1 frase
//   como = "Cómo" — la ruta exacta (pestaña → elemento → acción)
//   ves = "Deberías ver" — el resultado verificable
//   ctx = (opcional, solo GERENTE) aclaración de contexto cuando el paso simula trabajo operativo

const PASOS_DIA1 = [
  {
    t: "Revisa la Bandeja",
    que: "Ver los reclamos reales que ya llegaron por correo.",
    como: "Pestaña Bandeja → abre los correos de ELSE (OFICINA RECLAMOS, Anabell).",
    ves: "Verás los reclamos reales pendientes, con sus PDF adjuntos.",
  },
  {
    t: "Analiza el primero con IA",
    que: "Entender qué pide ese correo antes de registrar el caso.",
    como: "Dentro del correo, pulsa \"Analizar con IA\".",
    ves: "Verás qué piden y qué reclamos menciona el correo.",
  },
  {
    t: "Registra el primer caso real",
    que: "Crear el expediente del primer reclamo real.",
    como: "Botón \"Convertir en caso\" del correo (o \"Nuevo caso\" del encabezado si tienes el expediente físico escaneado) → adjunta el PDF del reclamo → \"Extraer datos del Formato 1\" → valida contra el PDF → Crear expediente.",
    ves: "El expediente queda creado con los datos extraídos y validados.",
  },
  {
    t: "Mira nacer el flujo",
    que: "Confirmar que el caso arrancó su flujo de etapas.",
    como: "Pestaña Hoy → busca el caso recién creado.",
    ves: "El caso aparece con su etapa Recepción, responsable asignado automáticamente y su plazo.",
  },
  {
    t: "Vincula la correspondencia",
    que: "Asociar otros correos del mismo caso a su expediente.",
    como: "Vuelve a Bandeja → en correos del mismo caso pulsa \"Vincular a expediente\".",
    ves: "Los adjuntos de esos correos se copian a la carpeta del caso.",
  },
  {
    t: "Trabaja la primera etapa",
    que: "Avanzar el expediente subiendo su evidencia.",
    como: "Abre el caso (\"Abrir y trabajar\") → sube el escaneo con \"Evidencia + datos\" → \"Terminé esta etapa\".",
    ves: "La etapa queda marcada como terminada (o te avisa qué dato falta).",
  },
  {
    t: "Repite con los demás reclamos",
    que: "Registrar el resto de reclamos reales que llegaron por correo.",
    como: "Repite los pasos 3 a 6 con cada correo pendiente de la Bandeja.",
    ves: "Cada reclamo real queda con su propio expediente y flujo. Toda idea u obstáculo → botón Sugerencia.",
  },
];

const PASOS_OPERATIVO = [
  {
    t: "Iniciar sesión",
    que: "Entrar a la plataforma con tu usuario.",
    como: "Ya lo hiciste: ingresaste tu usuario y el PIN que te asignó coordinación.",
    ves: "Estás dentro de la plataforma, viendo tu pantalla de inicio.",
  },
  {
    t: "Ubicar tu tarea prioritaria",
    que: "Identificar cuál expediente atender primero.",
    como: "Pestaña Mi día → mira la primera tarjeta de la lista y su semáforo (color de urgencia).",
    ves: "Una tarjeta destacada arriba de todas, con un color (rojo/ámbar/verde) que indica qué tan urgente es.",
  },
  {
    t: "Abrir el expediente",
    que: "Entrar al expediente de esa tarea.",
    como: "En la tarjeta prioritaria, pulsa el botón \"Abrir y trabajar\".",
    ves: "Se abre la ficha completa del expediente, con sus datos y pestañas internas.",
  },
  {
    t: "Adjuntar evidencia",
    que: "Subir un documento de prueba y completar datos del expediente.",
    como: "Dentro del expediente, pestaña Evidencia + datos → arrastra un PDF cualquiera, llena 2-3 campos y pulsa Guardar.",
    ves: "El PDF aparece listado como adjunto y los campos quedan guardados al recargar la pestaña.",
  },
  {
    t: "Generar un documento",
    que: "Producir el documento del expediente con los datos ya cargados.",
    como: "Dentro del expediente, pestaña Generar documento → revisa los campos precargados y pulsa Generar.",
    ves: "Se descarga o se muestra un documento con los datos del expediente ya completados.",
  },
  {
    t: "Revisar Ficha SIELSE",
    que: "Copiar un dato del expediente para pegarlo en el sistema SIELSE.",
    como: "Dentro del expediente, pestaña Ficha SIELSE → pulsa el botón de copiar junto a cualquier campo.",
    ves: "Un aviso confirma que el dato quedó copiado al portapapeles.",
  },
  {
    t: "Cerrar la etapa",
    que: "Marcar como terminada la etapa actual del expediente.",
    como: "Dentro del expediente, pulsa el botón \"Terminé esta etapa\".",
    ves: "Si falta algún dato obligatorio, aparece un aviso listando qué falta antes de poder avanzar.",
  },
  {
    t: "Abrir un correo",
    que: "Revisar un correo real de la bandeja.",
    como: "Pestaña Bandeja → haz clic en cualquier correo de la lista.",
    ves: "El correo se abre a la derecha con su contenido completo.",
  },
  {
    t: "Analizar el correo con IA",
    que: "Pedir a la IA que resuma o clasifique el correo abierto.",
    como: "Con el correo abierto, pulsa el botón \"Analizar con IA\".",
    ves: "Aparece un resumen o clasificación generado automáticamente debajo del correo.",
  },
  {
    t: "Probar una respuesta sugerida",
    que: "Ver cómo la IA redacta una posible respuesta (sin enviarla).",
    como: "Con el correo abierto, pulsa \"Sugerir respuesta\" y lee el texto generado.",
    ves: "Aparece un borrador de respuesta. No lo envíes: solo revísalo.",
  },
  {
    t: "Revisar tu calendario",
    que: "Ver tus vencimientos y plazos pendientes.",
    como: "Pestaña Mi calendario → revisa las fechas marcadas.",
    ves: "Una lista o calendario con tus próximos vencimientos, ordenados por fecha.",
  },
  {
    t: "Enviar una sugerencia",
    que: "Cerrar la prueba dejando una opinión real sobre lo que probaste.",
    como: "Botón Sugerencia (abajo a la derecha) → escribe una idea u obstáculo real y pulsa Enviar.",
    ves: "Un aviso confirma el envío; tu sugerencia queda registrada para el Gerente.",
  },
];

const PASOS_GERENTE = [
  {
    t: "Revisar KPIs y cola del día",
    que: "Ver el estado general del equipo y qué expedientes están en cola.",
    como: "Pestaña Hoy → lee los indicadores (KPIs) y la lista de la cola priorizada.",
    ves: "Números resumen arriba y, debajo, una lista de expedientes ordenados por urgencia.",
  },
  {
    t: "Reasignar un caso",
    que: "Cambiar el responsable de un caso en la cola.",
    como: "Pestaña Hoy → en la primera tarjeta de la cola, abre el selector de la derecha y elige otro nombre; nota que cada nombre muestra su cargo.",
    ves: "El responsable cambia al instante y queda registrado en la bitácora del expediente.",
    ctx: "Este paso normalmente lo hace el Coordinador al balancear la carga del equipo; pruébalo tú para conocer cómo funciona.",
  },
  {
    t: "Abrir un expediente desde la cola",
    que: "Entrar al detalle de un caso listado en la cola.",
    como: "Pestaña Hoy → haz clic sobre cualquier expediente de la cola.",
    ves: "Se abre la ficha completa de ese expediente con todos sus datos.",
  },
  {
    t: "Revisar carga del equipo",
    que: "Ver cuántos casos tiene cada trabajador y qué mejoras han sugerido.",
    como: "Pestaña Equipo → revisa la carga por trabajador y baja hasta la sección Mejoras sugeridas.",
    ves: "Un listado de trabajadores con su número de casos asignados, y debajo las sugerencias enviadas por el equipo.",
  },
  {
    t: "Filtrar y delegar un expediente",
    que: "Buscar un expediente puntual y asignarlo a otro responsable.",
    como: "Pestaña Expedientes → usa los filtros para encontrar uno, luego usa su selector de responsable para delegarlo.",
    ves: "La lista se reduce según el filtro aplicado, y el expediente elegido muestra el nuevo responsable.",
    ctx: "Filtrar y delegar expedientes es una tarea de supervisión que tú sí ejecutas en el día a día; este paso confirma que funciona.",
  },
  {
    t: "Revisar un correo de todos los buzones",
    que: "Ver los correos de todo el equipo, no solo los tuyos, y analizarlo con IA.",
    como: "Pestaña Bandeja → cambia la vista a \"Todos los buzones\", abre un correo y pulsa \"Analizar\".",
    ves: "La bandeja muestra correos de varios usuarios, y el análisis de IA aparece debajo del correo abierto.",
  },
  {
    t: "Revisar Valorización",
    que: "Ver el estado de la valorización mensual del contrato.",
    como: "Pestaña Reportes → abre la sub-pestaña Valorización.",
    ves: "Una tabla o resumen con los montos y el estado de la valorización del periodo.",
  },
  {
    t: "Consultar la Guía del flujo",
    que: "Repasar cómo funciona una etapa del proceso (rol, plazo, penalidad).",
    como: "Pestaña Guía del flujo → haz clic en cualquier etapa para abrir su detalle.",
    ves: "Un panel con el rol responsable, el plazo aplicable y la penalidad asociada a esa etapa.",
  },
  {
    t: "Abrir Herramientas",
    que: "Acceder al análisis avanzado del contrato (Streamlit).",
    como: "Cabecera de la app → botón Herramientas.",
    ves: "Se abre una pestaña nueva del navegador con el panel de análisis avanzado.",
  },
  {
    t: "Probar extracción de datos con IA",
    que: "Ver cómo la IA extrae datos de un PDF para un caso nuevo (sin guardar nada).",
    como: "Botón Nuevo caso → adjunta un PDF cualquiera, pulsa \"Extraer\", revisa los campos y luego pulsa Cancelar sin guardar.",
    ves: "Los campos del formulario se completan solos con datos leídos del PDF.",
    ctx: "Cargar un caso nuevo suele hacerlo el Asistente Administrativo; pruébalo tú para conocer el flujo completo.",
  },
  {
    t: "Enviar una sugerencia",
    que: "Cerrar la prueba dejando una opinión real sobre lo que probaste.",
    como: "Botón Sugerencia (abajo a la derecha) → escribe una idea u obstáculo real y pulsa Enviar.",
    ves: "Un aviso confirma el envío; tu sugerencia queda registrada para revisión.",
  },
];

function pasosPara(perfil) {
  const operativo = ["ANALISTA_LEGAL", "ANALISTA_JUNIOR", "ASISTENTE", "TRAMITADOR"].includes(perfil?.rol);
  return operativo ? PASOS_OPERATIVO : PASOS_GERENTE;
}

function keyUsuario(perfil) { return "prueba_guiada_" + (perfil?.usuario || perfil?.nombre || "anon"); }

function loadHechos(perfil) {
  try { return JSON.parse(localStorage.getItem(keyUsuario(perfil))) || {}; } catch { return {}; }
}
function saveHechos(perfil, obj) {
  try { localStorage.setItem(keyUsuario(perfil), JSON.stringify(obj)); } catch {}
}

export default function PruebaGuiada({ perfil, sinCasos = false }) {
  const [abierto, setAbierto] = useState(false);
  const [sugForm, setSugForm] = useState(null); // null | { pasoTitulo }
  const pasosRol = useMemo(() => pasosPara(perfil), [perfil]);
  // Con el sistema en blanco (0 reclamos), el arranque de operación real va PRIMERO,
  // antes del checklist normal del rol — es lo primero que el líder debe hacer mañana.
  const pasos = useMemo(() => (sinCasos ? [...PASOS_DIA1, ...pasosRol] : pasosRol), [pasosRol, sinCasos]);
  const [hechos, setHechos] = useState(() => loadHechos(perfil));

  useEffect(() => { setHechos(loadHechos(perfil)); }, [perfil]);

  const marcar = (idx, val) => {
    const next = { ...hechos, [idx]: val };
    setHechos(next);
    saveHechos(perfil, next);
  };

  const total = pasos.length;
  const hechosN = Object.values(hechos).filter(Boolean).length;

  return (
    <>
      {/* ---- Botones flotantes ---- */}
      <div style={{ position: "fixed", right: 18, bottom: 18, zIndex: 250, display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-end" }}>
        <button
          onClick={() => setSugForm({ pasoTitulo: "" })}
          title="Enviar una sugerencia u obstáculo al Gerente"
          style={fabStyle("var(--amber)", "var(--ink)")}
        >Sugerencia</button>
        <button
          onClick={() => setAbierto(v => !v)}
          title="Abrir la guía de prueba paso a paso"
          style={fabStyle("var(--navy)")}
        >Prueba guiada</button>
      </div>

      {/* ---- Panel lateral: checklist según rol (overlay suave, no bloquea la app) ---- */}
      {abierto && (
        <div
          onClick={() => setAbierto(false)}
          style={{ position: "fixed", inset: 0, zIndex: 240, background: "rgba(22,41,75,.45)" }}
        >
          <div onClick={e => e.stopPropagation()} style={panelStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 6 }}>
              <div>
                <b style={{ color: "var(--titulo)", fontSize: 15 }}>Prueba guiada</b>
                <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>Pasos para {perfil?.nombre || "tu perfil"} · {perfil?.rol}</div>
              </div>
              <button className="btn sec sm" onClick={() => setAbierto(false)}>✕</button>
            </div>

            <div style={{ margin: "10px 0 14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "var(--mut)", marginBottom: 4 }}>
                <span>Progreso</span><span>{hechosN} de {total}</span>
              </div>
              <div style={{ height: 8, borderRadius: 999, background: "var(--card2)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${total ? (hechosN / total) * 100 : 0}%`, background: "var(--green)", transition: "width .2s" }} />
              </div>
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              {pasos.map((p, i) => (
                <div key={i}>
                  {sinCasos && i === 0 && (
                    <div style={sectionHdrStyle}>DÍA 1 — Arranque de operación real</div>
                  )}
                  {sinCasos && i === PASOS_DIA1.length && (
                    <div style={{ ...sectionHdrStyle, marginTop: 10 }}>Checklist de tu rol</div>
                  )}
                <div style={{ background: "var(--card2)", border: "1px solid var(--bd)", borderRadius: 10, padding: "9px 11px" }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <input
                      type="checkbox"
                      checked={!!hechos[i]}
                      onChange={e => marcar(i, e.target.checked)}
                      style={{ marginTop: 3, width: 16, height: 16, flexShrink: 0, cursor: "pointer" }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: hechos[i] ? "var(--green)" : "var(--titulo)" }}>
                        {i + 1}. {p.t}
                      </div>

                      {p.ctx && (
                        <div style={{ fontSize: 11.5, color: "var(--purple)", marginTop: 4, lineHeight: 1.4, fontStyle: "italic" }}>
                          {p.ctx}
                        </div>
                      )}

                      <div style={{ marginTop: 6, display: "grid", gap: 3 }}>
                        <div style={{ fontSize: 12, lineHeight: 1.4 }}>
                          <span style={{ color: "var(--mut)", fontWeight: 600 }}>Qué harás: </span>
                          <span style={{ color: "var(--tx)" }}>{p.que}</span>
                        </div>
                        <div style={{ fontSize: 12, lineHeight: 1.4 }}>
                          <span style={{ color: "var(--mut)", fontWeight: 600 }}>Cómo: </span>
                          <span style={{ color: "var(--tx)" }}>{p.como}</span>
                        </div>
                        <div style={{ fontSize: 12, lineHeight: 1.4 }}>
                          <span style={{ color: "var(--mut)", fontWeight: 600 }}>Deberías ver: </span>
                          <span style={{ color: "var(--tx)" }}>{p.ves}</span>
                        </div>
                      </div>

                      <button
                        onClick={() => setSugForm({ pasoTitulo: p.t })}
                        style={{ marginTop: 8, background: "transparent", border: "1px solid var(--bd)", color: "var(--purple)", borderRadius: 7, padding: "3px 8px", fontSize: 11, cursor: "pointer" }}
                      >Comentar este paso</button>
                    </div>
                  </div>
                </div>
                </div>
              ))}
            </div>

            {hechosN === total && (
              <div className="note" style={{ marginTop: 14, background: "var(--tint-green-bg)", border: "1px solid var(--tint-green-bd)", color: "var(--tint-green-tx)" }}>
                Completaste todos los pasos. Gracias por probar la plataforma — si algo te costó, cuéntalo con el botón Sugerencia.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---- Mini-formulario de sugerencia ---- */}
      {sugForm && (
        <SugerenciaForm perfil={perfil} pasoTitulo={sugForm.pasoTitulo} onClose={() => setSugForm(null)} />
      )}
    </>
  );
}

function SugerenciaForm({ perfil, pasoTitulo, onClose }) {
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);

  const enviar = async () => {
    const t = texto.trim();
    if (!t) return;
    setEnviando(true);
    const prefijo = pasoTitulo ? `MEJORA: [${pasoTitulo}] ` : "MEJORA: ";
    await postAction("comentar", { reclamo: "", etapa: "PRUEBA", texto: prefijo + t, nombre: perfil?.nombre });
    setEnviando(false);
    toast("Sugerencia enviada al Gerente ✔");
    onClose();
  };

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 260, background: "rgba(22,41,75,.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
    >
      <div onClick={e => e.stopPropagation()} style={{ width: "min(420px,94vw)", background: "var(--card)", border: "1px solid var(--bd)", borderRadius: 14, padding: 16, boxShadow: "var(--shadow-modal)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <b style={{ color: "var(--titulo)", fontSize: 14 }}>💡 Enviar sugerencia</b>
          <button className="btn sec sm" onClick={onClose}>✕</button>
        </div>
        {pasoTitulo && <div className="muted" style={{ fontSize: 11.5, marginBottom: 8 }}>Sobre el paso: <b style={{ color: "var(--purple)" }}>{pasoTitulo}</b></div>}
        <textarea
          autoFocus
          value={texto}
          onChange={e => setTexto(e.target.value)}
          placeholder="Cuenta la idea o el obstáculo que encontraste… no lo guardes para después."
          rows={5}
          style={{ width: "100%", background: "var(--card2)", color: "var(--tx)", border: "1px solid var(--bd)", borderRadius: 8, padding: "9px 10px", fontSize: 13, resize: "vertical", fontFamily: "inherit" }}
        />
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
          <button className="btn sec sm" onClick={onClose}>Cancelar</button>
          <button className="btn sm" disabled={enviando || !texto.trim()} style={{ background: "var(--amber)", color: "var(--ink)" }} onClick={enviar}>{enviando ? "Enviando…" : "Enviar"}</button>
        </div>
      </div>
    </div>
  );
}

const fabStyle = (bg, fg = "#fff") => ({
  background: bg, color: fg, border: 0, borderRadius: 999, padding: "12px 18px", fontSize: 13.5,
  fontWeight: 600, cursor: "pointer", boxShadow: "var(--shadow-pop)", whiteSpace: "nowrap",
});

const panelStyle = {
  position: "absolute", right: 0, top: 0, height: "100%", width: "min(400px,92vw)",
  background: "var(--bg)", borderLeft: "1px solid var(--bd)", overflowY: "auto", padding: 16,
  boxShadow: "var(--shadow-modal)",
};

const sectionHdrStyle = {
  fontSize: 11, fontWeight: 700, color: "var(--mut)", textTransform: "uppercase", letterSpacing: ".05em",
  margin: "4px 0 8px", paddingBottom: 6, borderBottom: "1px solid var(--bd)",
};
