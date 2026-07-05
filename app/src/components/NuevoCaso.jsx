import { useState, useRef, useEffect } from "react";
import { nuevoReclamo, subirArchivo, extraerCamposIA, guardarDatos, loadCatalogos } from "../lib/api.js";
import { toast } from "./ui.jsx";
import { CATALOGOS_LOCAL, agruparCatalogos, mezclarCatalogos } from "../lib/catalogosSielse.js";
import { GuiaSielseBox } from "../lib/guiaSielse.jsx";

// Campos que la IA extrae del Formato 1 / cargo de recepción. ESTE registro es la
// mesa de partes digital de TELCOM: aquí nace el expediente; SIELSE se llena DESPUÉS
// transcribiendo este detalle (etapa SIELSE, ≤2 días háb. — penalidades 5.1/5.2).
const EXTRAER = [
  { k: "NombreSolicitante", label: "Nombre del solicitante / reclamante" },
  { k: "DNI", label: "DNI del solicitante (8 dígitos)" },
  { k: "TELEFONO", label: "Teléfono / celular de contacto" },
  { k: "CodigoSuministro", label: "Código de suministro (11 dígitos)" },
  { k: "NumeroOsinerg", label: "N° OSINERG (REC00…) si aparece" },
  { k: "DireccionSolicitante", label: "Dirección del suministro" },
  { k: "NombreDistrito", label: "Distrito" },
  { k: "NombreClaseReclamo", label: "Materia del reclamo", opciones: ["RECLAMOS POR EXCESIVA FACTURACION", "RECLAMOS VARIOS"] },
  { k: "PERIODO_RECLAMADO", label: "Período/mes reclamado (ej. Junio 2026)" },
  { k: "monto_reclamo", label: "Monto en reclamo (solo número)" },
  { k: "FechaAdmisionReclamo", label: "Fecha de presentación del reclamo (DD/MM/AAAA)" },
  { k: "DescripcionReclamo", label: "Descripción / motivo del reclamo" },
];

const PASOS = [
  { n: 1, titulo: "¿Qué reclama?" },
  { n: 2, titulo: "Documento" },
  { n: 3, titulo: "¿Quién reclama?" },
  { n: 4, titulo: "Suministro y pedido" },
  { n: 5, titulo: "Revisar y crear" },
];

// Checklist de sustentos recomendados por materia (Directiva 269-2014-OS/CD, Formato 1).
// Puramente orientativo: ayuda al digitador a no olvidar pedir algo en mesa de partes.
const SUSTENTOS_POR_CLASE = {
  "RECLAMOS POR EXCESIVA FACTURACION": ["Recibo(s) reclamado(s)", "Historial de consumos (si lo tiene)", "DNI del reclamante"],
  "EXCESIVO CONSUMO": ["Recibo(s) reclamado(s)", "Historial de consumos (si lo tiene)", "DNI del reclamante"],
  "RECUPERO DE ENERGIA": ["Carta/notificación de recupero", "Acta de intervención", "Recibo"],
  "CORTE DEL SERVICIO": ["Recibo con el corte", "Constancia/foto del corte"],
  "DAÑOS Y PERJUICIOS": ["Relación de artefactos dañados", "Fotos", "Presupuesto/proforma de reparación"],
};
const SUSTENTOS_DEFAULT = ["Documento del reclamo", "DNI del reclamante"];
const sustentosDe = clase => SUSTENTOS_POR_CLASE[clase] || SUSTENTOS_DEFAULT;

// Heurística simple de plazo estimado, solo para orientar al digitador — SIELSE fija el oficial
// al Admitir (10 o 30 días hábiles según la clase y el análisis del Analista Legal en Evaluación).
const CLASES_RAPIDAS = new Set(["CORTE DEL SERVICIO", "NEGATIVA A LA INSTALACION DEL SUMINISTRO", "MALA CALIDAD (TENSION / INTERRUPCIONES)"]);
function plazoEstimado(f) {
  if (f.NombreClaseReclamo && CLASES_RAPIDAS.has(f.NombreClaseReclamo)) return 10;
  if (f.RECLAMO_OSINERG) return 30;
  return 10;
}
// fecha límite aprox.: hoy + plazo en días CALENDARIO (aproximación simple para el resumen en vivo)
function fechaLimiteAprox(dias) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const BORRADOR_KEY = "nuevoCaso_borrador";

// Modal "Iniciar expediente": wizard de 5 pasos — sube el Formato 1, la IA extrae los
// datos, se confirman por pantallas y se crea el caso. La lógica de creación (payload,
// duplicados, IA, archivo) es exactamente la misma que antes; solo cambió la presentación.
export default function NuevoCaso({ perfil, onCreado, onClose, existentes = [], inicial = null }) {
  // si el caso viene de la Bandeja (correo), preseleccionamos forma de presentación
  const inicialF = { NombreClaseReclamo: "RECLAMOS POR EXCESIVA FACTURACION", RECLAMO_OSINERG: true, ...(inicial ? { FORMA_PRESENTACION: "CORREO ELECTRONICO" } : {}), ...(inicial || {}) };
  const [f, setF] = useState(inicialF);
  const [file, setFile] = useState(null);
  const [pdfUrl, setPdfUrl] = useState("");
  const [iaBusy, setIaBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sug, setSug] = useState(new Set());
  const [cats, setCats] = useState(CATALOGOS_LOCAL);
  const [paso, setPaso] = useState(1);
  const [visorAbierto, setVisorAbierto] = useState(true); // colapso del visor en pantallas angostas
  const [creado, setCreado] = useState(null); // {codigo} tras crear() con éxito -> pantalla de éxito
  const [borradorDisponible, setBorradorDisponible] = useState(false);
  const inputRef = useRef();
  const set = (k, v) => { setF(p => ({ ...p, [k]: v })); if (sug.has(k)) setSug(s => { const n = new Set(s); n.delete(k); return n; }); };

  // Catálogos SIELSE: Sheet manda, respaldo local completa lo que falte.
  useEffect(() => {
    let vivo = true;
    loadCatalogos().then(rows => {
      if (!vivo) return;
      const deSheet = rows ? agruparCatalogos(rows) : {};
      setCats(mezclarCatalogos(deSheet));
    }).catch(() => { /* queda CATALOGOS_LOCAL */ });
    return () => { vivo = false; };
  }, []);

  // URL local para previsualizar el PDF subido (se libera al cambiar/cerrar).
  useEffect(() => {
    if (!file) { setPdfUrl(""); return; }
    const u = URL.createObjectURL(file);
    setPdfUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  // Borrador: si NO viene de un correo (inicial=null) hay un borrador guardado, ofrece continuarlo.
  useEffect(() => {
    if (inicial) return;
    try {
      const raw = localStorage.getItem(BORRADOR_KEY);
      if (raw) {
        const b = JSON.parse(raw);
        if (b && b.f && Object.keys(b.f).length) setBorradorDisponible(true);
      }
    } catch (e) { /* borrador corrupto: se ignora */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Persistencia del borrador: solo campos (f) y paso — NUNCA el archivo. Debounce simple.
  useEffect(() => {
    if (creado) return; // ya se creó el expediente: no seguir grabando borrador
    const t = setTimeout(() => {
      try {
        // guarda si hay al menos un campo con contenido más allá de los valores por defecto iniciales
        const tieneContenido = Object.entries(f).some(([k, v]) => v != null && v !== "" && !(k === "NombreClaseReclamo" && v === "RECLAMOS POR EXCESIVA FACTURACION") && !(k === "RECLAMO_OSINERG"));
        if (tieneContenido) localStorage.setItem(BORRADOR_KEY, JSON.stringify({ f, paso }));
      } catch (e) { /* localStorage no disponible: no bloquea el wizard */ }
    }, 500);
    return () => clearTimeout(t);
  }, [f, paso, creado]);

  // Colapsa el visor automáticamente en pantallas angostas (arranca expandido en escritorio)
  const [anchoVentana, setAnchoVentana] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
  useEffect(() => { const h = () => setAnchoVentana(window.innerWidth); window.addEventListener("resize", h); return () => window.removeEventListener("resize", h); }, []);
  const angosto = anchoVentana < 900;

  function continuarBorrador() {
    try {
      const raw = localStorage.getItem(BORRADOR_KEY);
      const b = raw ? JSON.parse(raw) : null;
      if (b?.f) { setF(p => ({ ...p, ...b.f })); setPaso(b.paso || 1); }
    } catch (e) { /* ignora */ }
    setBorradorDisponible(false);
  }
  function descartarBorrador() {
    try { localStorage.removeItem(BORRADOR_KEY); } catch (e) { /* ignora */ }
    setBorradorDisponible(false);
  }
  function limpiarBorrador() {
    try { localStorage.removeItem(BORRADOR_KEY); } catch (e) { /* ignora */ }
  }

  async function extraer() {
    if (!file) { toast("Adjunta primero el Formato 1 (PDF)"); return; }
    setIaBusy(true);
    const r = await extraerCamposIA({ file, etapa: "Recepción", campos: EXTRAER, guardar: false });
    setIaBusy(false);
    if (!r?.ok) { toast("IA: " + (r?.error || "no se pudo leer")); return; }
    const ll = {}, keys = new Set();
    Object.entries(r.campos || {}).forEach(([k, v]) => { if (v != null && String(v).toLowerCase() !== "null" && v !== "") { ll[k] = String(v); keys.add(k); } });
    setF(p => ({ ...p, ...ll })); setSug(keys);
    toast(`IA leyó ${Object.keys(ll).length} dato(s) — revísalos contra el PDF y corrige`);
  }

  async function crear() {
    // Blindaje del registro: estos datos alimentan plazos, penalidades y SIELSE — mejor parar aquí que corregir después.
    if (!f.NombreClaseReclamo) { toast("Falta la materia del reclamo — complétalo en el paso 1"); setPaso(1); return; }
    if (!f.NombreSolicitante) { toast("Falta el reclamante — complétalo en el paso 3"); setPaso(3); return; }
    if (!f.CodigoSuministro) { toast("Falta el suministro — complétalo en el paso 4"); setPaso(4); return; }
    if (!f.DescripcionReclamo) { toast("Falta la descripción del reclamo — complétalo en el paso 4"); setPaso(4); return; }
    if (!/^\d{6,}$/.test(String(f.CodigoSuministro).trim())) { toast("⚠ El suministro debe ser numérico (mín. 6 dígitos)"); setPaso(4); return; }
    if (f.DNI && !/^\d{8}$/.test(String(f.DNI).trim())) { toast("⚠ El DNI debe tener 8 dígitos"); setPaso(3); return; }
    if (f.FechaAdmisionReclamo && !/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(String(f.FechaAdmisionReclamo).trim())) { toast("⚠ Fecha admisión en formato DD/MM/AAAA (arranca el cómputo de plazos)"); setPaso(2); return; }
    if (f.monto_reclamo && isNaN(parseFloat(f.monto_reclamo))) { toast("⚠ El monto debe ser un número (define la exposición a penalidades)"); setPaso(4); return; }
    const dup = existentes.find(x => String(x.suministro) === String(f.CodigoSuministro).trim() && x.estado !== "Cerrado");
    if (dup && !confirm(`⚠ Ya existe un reclamo ABIERTO para el suministro ${dup.suministro} (${dup.osinerg} · ${dup.solicitante}).\n¿Registrar otro de todas formas?`)) return;
    setBusy(true);
    const datos = { ...f, Responsable: perfil?.nombre || "", resp_id: perfil?.resp_id ?? "" };
    const r = await nuevoReclamo(datos);
    if (r?.ok) {
      if (file) { try { await subirArchivo(r.codigo, "01_Recepcion", file); } catch (e) {} }
      // el detalle que NO cabe en la fila del caso (DNI, teléfono, período, forma) se guarda
      // como datos de Recepción: prellena los documentos y es la lista a transcribir a SIELSE
      const extras = Object.fromEntries(Object.entries({
        DNI: f.DNI, TELEFONO: f.TELEFONO, PERIODO_RECLAMADO: f.PERIODO_RECLAMADO,
        MONTO_RECLAMADO: f.monto_reclamo, FORMA_PRESENTACION: f.FORMA_PRESENTACION, TARIFA: f.TARIFA,
      }).filter(([, v]) => v != null && v !== ""));
      if (Object.keys(extras).length) { try { await guardarDatos({ exp: r.codigo, etapa: "Recepción", rol: perfil?.rol, campos: extras }); } catch (e) {} }
    }
    setBusy(false);
    if (r?.ok) { toast("Expediente creado: " + r.codigo + " · queda pendiente transcribirlo a SIELSE en su etapa"); return r; }
    else { toast("No se pudo crear: " + (r?.error || "")); return r; }
  }

  // Envoltura de crear(): crear() en sí queda intacto línea por línea. La ÚNICA excepción
  // (mejora 5, autorizada por el pedido) es que la llamada final a onCreado ya NO vive dentro
  // de crear() — crear() ahora devuelve `r` y es ESTA función la que decide qué hacer con el
  // éxito: en vez de notificar al padre de inmediato, muestra la pantalla de éxito (paso 6
  // interno) y difiere onCreado al botón "Ir al expediente".
  async function crearYMostrarExito() {
    const r = await crear();
    if (r?.ok) { limpiarBorrador(); setCreado({ codigo: r.codigo }); }
  }

  function irAlExpediente() {
    const codigo = creado?.codigo;
    onCreado?.(codigo);
  }
  function registrarOtro() {
    setCreado(null);
    setF({ NombreClaseReclamo: "RECLAMOS POR EXCESIVA FACTURACION", RECLAMO_OSINERG: true });
    setFile(null);
    setSug(new Set());
    setPaso(1);
  }

  function pedirCierre() {
    const hayDatos = Object.entries(f).some(([k, v]) => v != null && v !== "" && !(k === "NombreClaseReclamo" && v === "RECLAMOS POR EXCESIVA FACTURACION") && k !== "RECLAMO_OSINERG");
    if (!creado && hayDatos && !confirm("Tienes datos escritos en este formulario. ¿Cerrar de todas formas? (queda como borrador)")) return;
    onClose();
  }

  // Escape no cierra a secas si hay datos escritos y no se creó el expediente (usa el mismo confirm que la X).
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") { e.preventDefault(); pedirCierre(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }); // sin deps: siempre lee el f/creado más reciente (closure fresca a propósito)

  const completo = {
    1: !!f.NombreClaseReclamo && !!f.FORMA_PRESENTACION,
    2: !!file,
    3: !!f.NombreSolicitante,
    4: !!f.CodigoSuministro && !!f.DescripcionReclamo,
    5: false,
  };
  const irA = n => setPaso(n);
  const siguiente = () => setPaso(p => Math.min(5, p + 1));
  const anterior = () => setPaso(p => Math.max(1, p - 1));

  const hayVisor = !!pdfUrl && paso >= 2 && !creado;

  return (
    <div className="overlay" style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={e => { if (e.target === e.currentTarget) pedirCierre(); }}>
      <div style={{ width: "min(1180px,97vw)", maxHeight: "94vh", display: "flex", flexDirection: "column", background: "var(--card)", border: "1px solid var(--bd)", borderRadius: 14, boxShadow: "0 20px 60px rgba(22,41,75,.15)", overflow: "hidden" }}>
        {/* header — franja hero */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, padding: "16px 20px", background: "linear-gradient(120deg,#DDF0FA,#EDF7FC)", borderBottom: "1px solid var(--bd)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center",
              background: "linear-gradient(135deg,#E3001B,#FF5A63)", fontSize: 20, boxShadow: "0 4px 12px rgba(227,0,27,.28)",
            }}>📥</div>
            <div>
              <h3 style={{ margin: 0, color: "var(--titulo)", fontSize: 17, fontWeight: 700 }}>Registrar reclamo — mesa de partes TELCOM</h3>
              {!creado
                ? (
                  <div style={{ fontSize: 12, marginTop: 2, color: "var(--mut)" }}>
                    <b>Paso {paso} de 5</b> — {PASOS[paso - 1].titulo}. El detalle queda listo para <b>transcribirlo a SIELSE</b> en su etapa (≤2 días háb.).
                  </div>
                )
                : <div style={{ fontSize: 12, marginTop: 2, color: "var(--mut)" }}>Expediente creado.</div>}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "0 0 auto" }}>
            {angosto && hayVisor && (
              <button className="btn sec sm" onClick={() => setVisorAbierto(v => !v)}>📄 {visorAbierto ? "ocultar documento" : "ver documento"}</button>
            )}
            <button className="btn sec sm" onClick={pedirCierre}>✕ cerrar</button>
          </div>
        </div>

        {!creado && (
          <>
            {borradorDisponible && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 18px", background: "#FFF7E6", borderBottom: "1px solid var(--bd)", fontSize: 12.5 }}>
                <span style={{ fontSize: 14 }}>📝</span>
                <span style={{ color: "var(--tx)" }}>Tienes un borrador sin terminar de un registro anterior.</span>
                <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                  <button onClick={continuarBorrador} style={{ background: "var(--acc)", color: "#fff", border: 0, borderRadius: 6, padding: "4px 12px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>Continuar</button>
                  <button onClick={descartarBorrador} style={{ background: "transparent", color: "var(--mut)", border: "1px solid var(--bd)", borderRadius: 6, padding: "4px 12px", fontSize: 12, cursor: "pointer" }}>Descartar</button>
                </div>
              </div>
            )}

            {/* stepper de pills */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "12px 18px", borderBottom: "1px solid var(--bd)", flexWrap: "wrap" }}>
              {PASOS.map((p, i) => (
                <div key={p.n} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <button
                    onClick={() => irA(p.n)}
                    title={p.titulo}
                    style={{
                      display: "flex", alignItems: "center", gap: 6, border: "1px solid " + (paso === p.n ? "var(--acc)" : (completo[p.n] ? "var(--selBg)" : "var(--bd)")),
                      background: paso === p.n ? "var(--acc)" : (completo[p.n] ? "var(--selBg)" : "var(--card2)"),
                      color: paso === p.n ? "#fff" : "var(--tx)", borderRadius: 999, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer",
                      boxShadow: paso === p.n ? "0 2px 8px rgba(227,0,27,.3)" : "none", transition: "all .12s",
                    }}>
                    <span style={{
                      width: 18, height: 18, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center",
                      fontSize: 10, background: paso === p.n ? "rgba(255,255,255,.25)" : (completo[p.n] ? "#15803D" : "var(--bd)"),
                      color: paso === p.n ? "#fff" : (completo[p.n] ? "#fff" : "var(--mut)"),
                    }}>{completo[p.n] ? "✓" : p.n}</span>
                    {p.titulo}
                  </button>
                  {i < PASOS.length - 1 && <span style={{ color: "var(--mut)", fontSize: 11 }}>—</span>}
                </div>
              ))}
            </div>

            {/* contenido: visor fijo a la izquierda (paso>=2 con PDF) + panel del paso a la derecha */}
            <div style={{ display: "flex", flex: 1, overflow: "hidden", minHeight: 0 }}>
              {hayVisor && !angosto && (
                <div style={{ flex: "0 0 44%", maxWidth: "44%", borderRight: "1px solid var(--bd)", display: "flex", flexDirection: "column", background: "var(--card2)" }}>
                  <div style={{ padding: "8px 12px", fontSize: 11, color: "var(--mut)", borderBottom: "1px solid var(--bd)", display: "flex", alignItems: "center", gap: 6 }}>
                    📄 <span style={{ fontWeight: 600 }}>{file?.name || "documento"}</span> <span style={{ marginLeft: "auto" }}>valida cada campo contra este documento</span>
                  </div>
                  <iframe title="pdf-fijo" src={pdfUrl} style={{ flex: 1, width: "100%", border: 0 }} />
                </div>
              )}
              {hayVisor && angosto && visorAbierto && (
                <div style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={e => { if (e.target === e.currentTarget) setVisorAbierto(false); }}>
                  <div style={{ width: "min(720px,94vw)", height: "88vh", background: "#fff", borderRadius: 12, overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,.3)" }}>
                    <div style={{ padding: "8px 12px", fontSize: 12, borderBottom: "1px solid var(--bd)", display: "flex", alignItems: "center", gap: 8 }}>
                      📄 <b>{file?.name || "documento"}</b>
                      <button onClick={() => setVisorAbierto(false)} style={{ marginLeft: "auto", background: "transparent", border: "1px solid var(--bd)", borderRadius: 6, padding: "3px 10px", fontSize: 12, cursor: "pointer" }}>cerrar</button>
                    </div>
                    <iframe title="pdf-modal" src={pdfUrl} style={{ flex: 1, width: "100%", border: 0 }} />
                  </div>
                </div>
              )}

              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                <ResumenVivo f={f} />
                <div style={{ padding: 18, overflow: "auto", flex: 1 }}>
                  {paso === 1 && (
                    <Paso1 f={f} set={set} cats={cats} />
                  )}
                  {paso === 2 && (
                    <Paso2 file={file} setFile={setFile} inputRef={inputRef} pdfUrl={pdfUrl} iaBusy={iaBusy} extraer={extraer} f={f} set={set} sug={sug} mostrarVisorInline={!hayVisor} />
                  )}
                  {paso === 3 && (
                    <Paso3 f={f} set={set} sug={sug} cats={cats} />
                  )}
                  {paso === 4 && (
                    <Paso4 f={f} set={set} sug={sug} cats={cats} />
                  )}
                  {paso === 5 && (
                    <Paso5 f={f} file={file} irA={irA} />
                  )}
                </div>
              </div>
            </div>

            {/* navegación */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderTop: "1px solid var(--bd)", background: "var(--card2)" }}>
              <button
                onClick={anterior} disabled={paso === 1}
                style={{
                  background: "transparent", color: "var(--mut)", border: "1px solid var(--bd)", borderRadius: 8, padding: "9px 18px", fontSize: 13.5, fontWeight: 600,
                  opacity: paso === 1 ? .45 : 1, cursor: paso === 1 ? "not-allowed" : "pointer",
                }}>← Volver</button>
              {paso < 5
                ? <button onClick={siguiente} style={{ background: "var(--acc)", color: "#fff", border: 0, borderRadius: 8, padding: "9px 22px", fontSize: 14, cursor: "pointer", fontWeight: 700, boxShadow: "0 2px 8px rgba(227,0,27,.3)" }}>Continuar →</button>
                : <button onClick={crearYMostrarExito} disabled={busy} style={{ background: "#15803D", color: "#fff", border: 0, borderRadius: 8, padding: "9px 22px", fontSize: 14, cursor: "pointer", fontWeight: 700, boxShadow: "0 2px 8px rgba(21,128,61,.3)" }}>{busy ? "Creando…" : "Crear expediente ✓"}</button>}
            </div>
          </>
        )}

        {creado && (
          <PantallaExito codigo={creado.codigo} onIrAlExpediente={irAlExpediente} onRegistrarOtro={registrarOtro} />
        )}
      </div>
    </div>
  );
}

// Clases del art. 13 de la Directiva 269-2014-OS/CD: en SIELSE, al Admitir estas
// materias se genera el correlativo OSINERG. Marcamos el checkbox en true por defecto
// para estas; el resto queda en false (el usuario confirma según el caso).
const CLASES_ART13 = new Set([
  "RECLAMOS POR EXCESIVA FACTURACION", "EXCESIVO CONSUMO", "RECUPERO DE ENERGIA", "COBRO INDEBIDO",
  "CORTE DEL SERVICIO", "NEGATIVA A LA INSTALACION DEL SUMINISTRO", "NEGATIVA AL INCREMENTO DE POTENCIA",
  "NEGATIVA AL CAMBIO DE OPCION TARIFARIA", "REEMBOLSO DE APORTES O CONTRIBUCIONES",
  "REUBICACION DE INSTALACIONES", "MALA CALIDAD (TENSION / INTERRUPCIONES)", "DEUDAS DE TERCEROS",
  "RECLAMOS VARIOS",
]);

/* ===================== Resumen en vivo (franja sticky, tipo tarifa Shalom) ===================== */
function ResumenVivo({ f }) {
  const clase = f.NombreClaseReclamo || "—";
  const dias = plazoEstimado(f);
  const limite = fechaLimiteAprox(dias);
  return (
    <div style={{
      position: "sticky", top: 0, zIndex: 5, display: "flex", flexWrap: "wrap", gap: "6px 18px",
      alignItems: "center", padding: "8px 18px", background: "#F4F8FB", borderBottom: "1px solid var(--bd)", fontSize: 11.5,
    }}>
      <span style={{ color: "var(--mut)", textTransform: "uppercase", letterSpacing: ".04em", fontWeight: 700, fontSize: 10 }}>Resumen en vivo</span>
      <Dato label="Clase" valor={clase} />
      <Dato label="Plazo estimado" valor={`${dias} días hábiles`} nota="estimado; SIELSE fija el oficial" />
      <Dato label="Fecha límite" valor={limite} nota="aprox." />
      <Dato label="Se asignará a" valor="reparto automático de Recepción" />
    </div>
  );
}
function Dato({ label, valor, nota }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 4 }}>
      <span style={{ color: "var(--mut)" }}>{label}:</span>
      <b style={{ color: "var(--titulo)" }}>{valor}</b>
      {nota && <span style={{ color: "var(--mut)", fontStyle: "italic" }}>({nota})</span>}
    </span>
  );
}

/* ===================== PASO 1 — ¿Qué reclama el usuario? ===================== */
function Paso1({ f, set, cats }) {
  const clases = cats.CLASE_RECLAMO || [];
  const formas = cats.FORMA_RECLAMO || [];
  const tiposReclamo = (cats.TIPO_RECLAMO || []).filter(t => t.extra === f.NombreClaseReclamo);

  function elegirClase(valor) {
    set("NombreClaseReclamo", valor);
    // valor por defecto del checkbox OSINERG según la clase (el usuario puede corregirlo)
    set("RECLAMO_OSINERG", CLASES_ART13.has(valor));
  }

  return (
    <div>
      <h4 style={{ margin: "0 0 4px", color: "var(--navy)" }}>¿Qué reclama el usuario?</h4>
      <div className="muted" style={{ fontSize: 12, marginBottom: 14 }}>Esto es lo primero que SIELSE pregunta al registrar la solicitud.</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 10, marginBottom: 18 }}>
        {clases.map(c => {
          const activo = f.NombreClaseReclamo === c.valor;
          return (
            <div key={c.valor} onClick={() => elegirClase(c.valor)}
              onMouseEnter={e => { if (!activo) e.currentTarget.style.borderColor = "#F3B4B4"; }}
              onMouseLeave={e => { if (!activo) e.currentTarget.style.borderColor = "var(--bd)"; }}
              style={{
                position: "relative", cursor: "pointer", borderRadius: 10, padding: "14px 12px",
                border: "2px solid " + (activo ? "var(--acc)" : "var(--bd)"),
                background: activo ? "var(--selBg)" : "var(--card2)",
                transition: "border-color .12s, transform .12s", transform: activo ? "none" : undefined,
              }}>
              {activo && (
                <span style={{
                  position: "absolute", top: 8, right: 8, width: 18, height: 18, borderRadius: "50%",
                  background: "var(--acc)", color: "#fff", fontSize: 11, fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1,
                }}>✓</span>
              )}
              <div style={{ fontSize: 26, marginBottom: 6 }}>{c.icono || "📄"}</div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--titulo)" }}>{c.valor}</div>
              {c.ayuda && <div style={{ fontSize: 10.5, marginTop: 3, color: "var(--mut)" }}>{c.ayuda}</div>}
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 22, flexWrap: "wrap", alignItems: "flex-start" }}>
        <label style={lbl(340)}>
          <span style={lblSpan}>¿Cómo llegó el reclamo?</span>
          <select value={f.FORMA_PRESENTACION || ""} onChange={e => set("FORMA_PRESENTACION", e.target.value)} style={inp(false)}>
            <option value="">—</option>
            {formas.map(x => <option key={x.valor} value={x.valor}>{x.valor}</option>)}
          </select>
        </label>

        <label style={lbl(340)}>
          <span style={lblSpan}>Tipo de reclamo (SIELSE)</span>
          {tiposReclamo.length
            ? (
              <select value={f.NombreTipoReclamo || ""} onChange={e => set("NombreTipoReclamo", e.target.value)} style={inp(false)}>
                <option value="">—</option>
                {tiposReclamo.map(t => <option key={t.valor} value={t.valor}>{t.valor}</option>)}
              </select>
            )
            : (
              <input type="text" value={f.NombreTipoReclamo || ""} onChange={e => set("NombreTipoReclamo", e.target.value)}
                placeholder="como aparece en el desplegable de SIELSE" style={inp(false)} />
            )}
          {!f.NombreClaseReclamo && <div style={{ fontSize: 10.5, marginTop: 3, color: "var(--mut)" }}>Elige antes la clase de reclamo.</div>}
        </label>

        <label style={{ ...lbl(280), display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer" }}>
          <input type="checkbox" checked={!!f.RECLAMO_OSINERG} onChange={e => set("RECLAMO_OSINERG", e.target.checked)} style={{ marginTop: 3 }} />
          <span>
            <span style={{ ...lblSpan, display: "block" }}>Reclamo OSINERG</span>
            <span style={{ fontSize: 11, color: "var(--mut)" }}>en SIELSE genera correlativo OSINERG al admitir</span>
          </span>
        </label>
      </div>
    </div>
  );
}

/* ===================== PASO 2 — Sube lo que llegó a mesa de partes ===================== */
function Paso2({ file, setFile, inputRef, pdfUrl, iaBusy, extraer, f, set, sug, mostrarVisorInline }) {
  const sugerenciaClase = sug.has("NombreClaseReclamo") && f.NombreClaseReclamo;
  const sustentos = sustentosDe(f.NombreClaseReclamo);
  const [marcados, setMarcados] = useState(new Set()); // checklist puramente visual, no viaja al payload
  const toggleSustento = (i) => setMarcados(s => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; });

  return (
    <div>
      <h4 style={{ margin: "0 0 4px", color: "var(--navy)" }}>Sube lo que llegó a mesa de partes</h4>
      <div className="muted" style={{ fontSize: 12, marginBottom: 14 }}>Adjunta el Formato 1 / cargo de recepción y deja que la IA lea los datos.</div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {/* izquierda: dropzone (+ visor solo si todavía no hay columna fija de documento) */}
        <div style={{ flex: "1 1 440px", minWidth: 300, display: "flex", flexDirection: "column" }}>
          <div onClick={() => inputRef.current?.click()} style={{ border: "1px dashed var(--bd)", borderRadius: 8, padding: "12px 10px", textAlign: "center", cursor: "pointer", marginBottom: 10 }}>
            <div style={{ fontSize: 13, color: "var(--tx)" }}>{file ? `📄 ${file.name} · cambiar` : "Adjunta el Formato 1 / cargo de recepción (PDF)"}</div>
            <input ref={inputRef} type="file" hidden accept="application/pdf,image/*" onChange={e => setFile(e.target.files[0])} />
          </div>
          {mostrarVisorInline && (
            <div style={{ flex: 1, minHeight: "50vh", border: "1px solid var(--bd)", borderRadius: 10, overflow: "hidden", background: "var(--card2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {pdfUrl
                ? <iframe title="pdf" src={pdfUrl} style={{ width: "100%", height: "100%", border: 0 }} />
                : <div className="muted" style={{ fontSize: 13, textAlign: "center", padding: 24 }}>Sube el Formato 1 (PDF) para previsualizarlo aquí.</div>}
            </div>
          )}

          {/* checklist de sustentos recomendados para la materia elegida (Formato 1 / Directiva 269-2014) */}
          <div style={{ marginTop: mostrarVisorInline ? 14 : 4, border: "1px solid var(--bd)", borderRadius: 10, padding: "10px 12px", background: "var(--card2)" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--titulo)", marginBottom: 6 }}>Sustentos recomendados para esta materia</div>
            <div style={{ display: "grid", gap: 6 }}>
              {sustentos.map((s, i) => (
                <label key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--tx)", cursor: "pointer" }}>
                  <input type="checkbox" checked={marcados.has(i)} onChange={() => toggleSustento(i)} />
                  <span style={{ textDecoration: marcados.has(i) ? "line-through" : "none", color: marcados.has(i) ? "var(--mut)" : "var(--tx)" }}>{s}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* derecha: panel IA */}
        <div style={{ flex: "1 1 380px", minWidth: 300 }}>
          <button onClick={extraer} disabled={iaBusy || !file} style={{ width: "100%", background: "rgba(109,40,217,.10)", color: "#6D28D9", border: "1px solid #6d28d9", borderRadius: 8, padding: "8px 12px", fontSize: 12.5, cursor: file ? "pointer" : "not-allowed", fontWeight: 600, marginBottom: 12 }}>
            {iaBusy ? "🤖 La IA está leyendo el documento…" : "🤖 Extraer datos del Formato 1"}
          </button>

          {sugerenciaClase && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--selBg)", border: "1px solid var(--acc)", borderRadius: 8, padding: "6px 10px", marginBottom: 12, fontSize: 12 }}>
              <span style={{ color: "var(--tx)" }}>IA sugiere: <b>{f.NombreClaseReclamo}</b></span>
              <button onClick={() => set("NombreClaseReclamo", f.NombreClaseReclamo)} style={{ marginLeft: "auto", background: "var(--acc)", color: "#fff", border: 0, borderRadius: 6, padding: "3px 10px", fontSize: 11.5, cursor: "pointer", fontWeight: 600 }}>aplicar</button>
            </div>
          )}

          <div className="muted" style={{ fontSize: 11, marginBottom: 8, textTransform: "uppercase", letterSpacing: .4 }}>Campos extraídos</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[
              ["NombreSolicitante", "Solicitante *", "text"], ["DNI", "DNI", "text"],
              ["TELEFONO", "Teléfono / celular", "text"], ["CodigoSuministro", "Suministro *", "text"],
              ["NumeroOsinerg", "N° OSINERG", "text"], ["DireccionSolicitante", "Dirección", "text"],
              ["NombreDistrito", "Distrito", "text"], ["FechaAdmisionReclamo", "Fecha admisión (DD/MM/AAAA)", "text"],
              ["PERIODO_RECLAMADO", "Período reclamado", "text"], ["monto_reclamo", "Monto en reclamo (S/)", "num"],
            ].map(([k, lab, tipo]) => (
              <label key={k} style={{ fontSize: 12 }}>
                <span style={lblSpan}>{lab}{sug.has(k) && <span style={badgeDudoso}>revisar</span>}</span>
                <input type={tipo === "num" ? "number" : "text"} value={f[k] || ""} onChange={e => set(k, e.target.value)} style={inp(sug.has(k))} />
              </label>
            ))}
            <label style={{ fontSize: 12, gridColumn: "1 / -1" }}>
              <span style={lblSpan}>Descripción{sug.has("DescripcionReclamo") && <span style={badgeDudoso}>revisar</span>}</span>
              <textarea rows={3} value={f.DescripcionReclamo || ""} onChange={e => set("DescripcionReclamo", e.target.value)} style={inp(sug.has("DescripcionReclamo"))} />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===================== PASO 3 — ¿Quién reclama? ===================== */
function Paso3({ f, set, sug, cats }) {
  const tiposDoc = cats.TIPO_DOC || [];
  const grados = cats.GRADO_PARENTESCO || [];
  const tipoActivo = f.TIPO_DOC || tiposDoc[0]?.valor || "";
  return (
    <div>
      <h4 style={{ margin: "0 0 4px", color: "var(--navy)" }}>¿Quién reclama?</h4>
      <div className="muted" style={{ fontSize: 12, marginBottom: 14 }}>Prellenado por la IA — confirma o corrige.</div>

      <div className="muted" style={{ fontSize: 11, marginBottom: 6, textTransform: "uppercase", letterSpacing: .4 }}>Tipo de documento</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        {tiposDoc.map(t => {
          const activo = tipoActivo === t.valor;
          return (
            <button key={t.valor} onClick={() => set("TIPO_DOC", t.valor)}
              style={{
                background: activo ? "var(--navy)" : "var(--card2)", color: activo ? "#fff" : "var(--tx)",
                border: "1px solid " + (activo ? "var(--navy)" : "var(--bd)"), borderRadius: 8, padding: "7px 14px", fontSize: 12.5, cursor: "pointer", fontWeight: 600,
              }}>{t.valor}</button>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, maxWidth: 640 }}>
        <label style={{ fontSize: 12 }}>
          <span style={lblSpan}>N° de documento{sug.has("DNI") && <span style={badgeDudoso}>revisar</span>}</span>
          <input type="text" value={f.DNI || ""} onChange={e => set("DNI", e.target.value)} style={inp(sug.has("DNI"))} />
        </label>
        <label style={{ fontSize: 12 }}>
          <span style={lblSpan}>Solicitante / reclamante *{sug.has("NombreSolicitante") && <span style={badgeDudoso}>revisar</span>}</span>
          <input type="text" value={f.NombreSolicitante || ""} onChange={e => set("NombreSolicitante", e.target.value)} style={inp(sug.has("NombreSolicitante"))} />
        </label>
        <label style={{ fontSize: 12 }}>
          <span style={lblSpan}>Celular / teléfono{sug.has("TELEFONO") && <span style={badgeDudoso}>revisar</span>}</span>
          <input type="text" value={f.TELEFONO || ""} onChange={e => set("TELEFONO", e.target.value)} style={inp(sug.has("TELEFONO"))} />
        </label>
        <label style={{ fontSize: 12 }}>
          <span style={lblSpan}>Correo electrónico</span>
          <input type="text" value={f.CORREO || ""} onChange={e => set("CORREO", e.target.value)} style={inp(false)} />
        </label>
        <label style={{ fontSize: 12 }}>
          <span style={lblSpan}>Grado de parentesco</span>
          <select value={f.GRADO_PARENTESCO || "Propietario"} onChange={e => set("GRADO_PARENTESCO", e.target.value)} style={inp(false)}>
            {grados.map(g => <option key={g.valor} value={g.valor}>{g.valor}</option>)}
          </select>
        </label>
      </div>
    </div>
  );
}

// Fallback local de sedes si el catálogo (Sheet o CATALOGOS_LOCAL) no trae el grupo SEDE todavía.
const SEDES_FALLBACK = ["Cusco", "Valle Sagrado", "Quispicanchi", "Anta", "Vilcanota", "Provincias Altas", "La Convención"];

/* ===================== PASO 4 — ¿Sobre qué suministro y qué pide? ===================== */
function Paso4({ f, set, sug, cats }) {
  const sectores = cats?.SECTOR_TIPICO || [];
  const tiposDeficiencia = (cats?.TIPO_DEFICIENCIA || []).filter(t => t.valor && !/completar desde el desplegable/i.test(t.valor));
  const sedes = (cats?.SEDE && cats.SEDE.length ? cats.SEDE.map(s => s.valor) : SEDES_FALLBACK);
  return (
    <div>
      <h4 style={{ margin: "0 0 4px", color: "var(--navy)" }}>¿Sobre qué suministro y qué pide?</h4>
      <div className="muted" style={{ fontSize: 12, marginBottom: 14 }}>Confirma el suministro y el detalle del reclamo.</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, maxWidth: 640 }}>
        <label style={{ fontSize: 12 }}>
          <span style={lblSpan}>Suministro *{sug.has("CodigoSuministro") && <span style={badgeDudoso}>revisar</span>}</span>
          <input type="text" value={f.CodigoSuministro || ""} onChange={e => set("CodigoSuministro", e.target.value)} style={inp(sug.has("CodigoSuministro"))} />
        </label>
        <label style={{ fontSize: 12 }}>
          <span style={lblSpan}>N° OSINERG{sug.has("NumeroOsinerg") && <span style={badgeDudoso}>revisar</span>}</span>
          <input type="text" value={f.NumeroOsinerg || ""} onChange={e => set("NumeroOsinerg", e.target.value)} style={inp(sug.has("NumeroOsinerg"))} />
        </label>
        <label style={{ fontSize: 12, gridColumn: "1 / -1" }}>
          <span style={lblSpan}>Dirección{sug.has("DireccionSolicitante") && <span style={badgeDudoso}>revisar</span>}</span>
          <input type="text" value={f.DireccionSolicitante || ""} onChange={e => set("DireccionSolicitante", e.target.value)} style={inp(sug.has("DireccionSolicitante"))} />
        </label>
        <label style={{ fontSize: 12 }}>
          <span style={lblSpan}>Distrito{sug.has("NombreDistrito") && <span style={badgeDudoso}>revisar</span>}</span>
          <input type="text" value={f.NombreDistrito || ""} onChange={e => set("NombreDistrito", e.target.value)} style={inp(sug.has("NombreDistrito"))} />
        </label>
        <label style={{ fontSize: 12 }}>
          <span style={lblSpan}>Monto en reclamo (S/){sug.has("monto_reclamo") && <span style={badgeDudoso}>revisar</span>}</span>
          <input type="number" value={f.monto_reclamo || ""} onChange={e => set("monto_reclamo", e.target.value)} style={inp(sug.has("monto_reclamo"))} />
        </label>
        <label style={{ fontSize: 12, gridColumn: "1 / -1" }}>
          <span style={lblSpan}>Pedido / descripción del reclamo *{sug.has("DescripcionReclamo") && <span style={badgeDudoso}>revisar</span>}</span>
          <textarea rows={3} value={f.DescripcionReclamo || ""} onChange={e => set("DescripcionReclamo", e.target.value)} style={inp(sug.has("DescripcionReclamo"))} />
        </label>
      </div>

      {/* Ubicación (lo pide SIELSE): campos propios de la pantalla Solicitud, ajenos al Formato 1 */}
      <div style={{ marginTop: 22, maxWidth: 640 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--titulo)", marginBottom: 2 }}>Ubicación (lo pide SIELSE)</div>
        <div style={{ fontSize: 11, color: "var(--mut)", marginBottom: 10 }}>Campos propios de la pantalla Solicitud — no vienen del Formato 1.</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label style={{ fontSize: 12, gridColumn: "1 / -1" }}>
            <span style={lblSpan}>Dirección frontis</span>
            <input type="text" value={f.DIRECCION_FRONTIS || ""} onChange={e => set("DIRECCION_FRONTIS", e.target.value)} style={inp(false)} />
          </label>
          <label style={{ fontSize: 12, gridColumn: "1 / -1" }}>
            <span style={lblSpan}>Referencia de ubicación de falla</span>
            <input type="text" value={f.REFERENCIA_FALLA || ""} onChange={e => set("REFERENCIA_FALLA", e.target.value)} style={inp(false)} />
          </label>
          <label style={{ fontSize: 12 }}>
            <span style={lblSpan}>Sector típico</span>
            <select value={f.SECTOR_TIPICO || ""} onChange={e => set("SECTOR_TIPICO", e.target.value)} style={inp(false)}>
              <option value="">—</option>
              {sectores.map(s => <option key={s.valor} value={s.valor}>{s.valor}</option>)}
            </select>
            <div style={{ fontSize: 10.5, marginTop: 3, color: "var(--mut)" }}>define si aplica NTCSE urbano o rural</div>
          </label>

          <label style={{ fontSize: 12 }}>
            <span style={lblSpan}>Libro (SIELSE)</span>
            <input type="text" value={f.LIBRO || ""} onChange={e => set("LIBRO", e.target.value)}
              placeholder="obligatorio en la pantalla Solicitud" style={inp(false)} />
          </label>
          <label style={{ fontSize: 12 }}>
            <span style={lblSpan}>Zona</span>
            <input type="text" value={f.ZONA || ""} onChange={e => set("ZONA", e.target.value)} style={inp(false)} />
          </label>
          <label style={{ fontSize: 12, gridColumn: "1 / -1" }}>
            <span style={lblSpan}>Localidad NTCSE</span>
            <input type="text" value={f.LOCALIDAD_NTCSE || ""} onChange={e => set("LOCALIDAD_NTCSE", e.target.value)}
              placeholder="obligatorio — define indicadores de calidad" style={inp(false)} />
          </label>
          <label style={{ fontSize: 12 }}>
            <span style={lblSpan}>Tipo de deficiencia</span>
            {tiposDeficiencia.length
              ? (
                <select value={f.TIPO_DEFICIENCIA || ""} onChange={e => set("TIPO_DEFICIENCIA", e.target.value)} style={inp(false)}>
                  <option value="">—</option>
                  {tiposDeficiencia.map(t => <option key={t.valor} value={t.valor}>{t.valor}</option>)}
                </select>
              )
              : (
                <input type="text" value={f.TIPO_DEFICIENCIA || ""} onChange={e => set("TIPO_DEFICIENCIA", e.target.value)}
                  placeholder="como aparece en el desplegable de SIELSE" style={inp(false)} />
              )}
          </label>
          <label style={{ fontSize: 12 }}>
            <span style={lblSpan}>Sede</span>
            <select value={f.SEDE || "Cusco"} onChange={e => set("SEDE", e.target.value)} style={inp(false)}>
              {sedes.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <div style={{ fontSize: 10.5, marginTop: 3, color: "var(--mut)" }}>Sedes ≠ Cusco: +1/+2 días hábiles en los plazos del contrato</div>
          </label>
        </div>
      </div>
    </div>
  );
}

/* ===================== PASO 5 — Revisa y crea el expediente ===================== */
function Paso5({ f, file, irA }) {
  const filas = [
    ["Tipo", f.NombreClaseReclamo || "—", 1],
    ["Tipo SIELSE", f.NombreTipoReclamo || "—", 1],
    ["OSINERG", f.RECLAMO_OSINERG ? "Sí" : "No", 1],
    ["Forma", f.FORMA_PRESENTACION || "—", 1],
    ["Documentos adjuntos", file ? `📄 ${file.name}` : "Ninguno", 2],
    ["Reclamante", [f.NombreSolicitante, f.DNI].filter(Boolean).join(" · ") || "—", 3],
    ["Suministro", [f.CodigoSuministro, f.DireccionSolicitante].filter(Boolean).join(" · ") || "—", 4],
    ["Sector típico", f.SECTOR_TIPICO || "—", 4],
    ["Sede", f.SEDE || "Cusco", 4],
    ["Libro/Zona", [f.LIBRO, f.ZONA].filter(Boolean).join(" · ") || "—", 4],
  ];
  return (
    <div>
      <h4 style={{ margin: "0 0 4px", color: "var(--navy)" }}>Revisa y crea el expediente</h4>
      <div className="muted" style={{ fontSize: 12, marginBottom: 14 }}>Verifica los datos antes de crear — quedan asociados al expediente.</div>
      <div style={{ background: "var(--card2)", border: "1px solid var(--bd)", borderRadius: 10, padding: 4, maxWidth: 640 }}>
        {filas.map(([k, v, pasoDestino]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "9px 12px", borderBottom: "1px solid var(--bd)" }}>
            <span style={{ color: "var(--mut)", fontSize: 12.5 }}>{k}</span>
            <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ color: "var(--tx)", fontSize: 12.5, fontWeight: 600, textAlign: "right" }}>{v}</span>
              <button onClick={() => irA(pasoDestino)} title={`Corregir en el paso ${pasoDestino}`} style={{ background: "transparent", color: "var(--acc)", border: "1px solid var(--acc)", borderRadius: 6, padding: "2px 8px", fontSize: 10.5, cursor: "pointer", fontWeight: 600 }}>corregir</button>
            </span>
          </div>
        ))}
        <div style={{ padding: "9px 12px", fontSize: 12, color: "var(--mut)" }}>Se asignará automáticamente al responsable de Recepción.</div>
      </div>
      <div style={{
        marginTop: 12, maxWidth: 640, display: "flex", gap: 8, alignItems: "flex-start",
        background: "var(--selBg)", border: "1px solid var(--acc)", borderRadius: 10, padding: "10px 12px",
      }}>
        <span style={{ fontSize: 14 }}>⚠️</span>
        <span style={{ fontSize: 12, color: "var(--tx)" }}>
          Al crear: transcribe la Solicitud en SIELSE el mismo día (botón <b>Nuevo → Guardar</b>) y anota aquí el <b>Nº de Solicitud</b>.
        </span>
      </div>
    </div>
  );
}

/* ===================== Paso 6 interno — Pantalla de éxito ===================== */
function PantallaExito({ codigo, onIrAlExpediente, onRegistrarOtro }) {
  return (
    <div style={{ flex: 1, overflow: "auto", padding: "28px 24px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
      <div style={{
        width: 68, height: 68, borderRadius: "50%", background: "#DCFCE7", color: "#15803D", display: "flex",
        alignItems: "center", justifyContent: "center", fontSize: 36, fontWeight: 700, marginBottom: 14,
      }}>✓</div>
      <h3 style={{ margin: 0, color: "var(--titulo)", fontSize: 19 }}>Expediente {codigo} creado</h3>
      <div className="muted" style={{ fontSize: 13, marginTop: 6, maxWidth: 480 }}>
        Nació en <b>Recepción</b> con responsable y plazo automáticos.
      </div>

      <div style={{ width: "min(560px,100%)", marginTop: 22, textAlign: "left" }}>
        <GuiaSielseBox etapa="Recepción" compacta={false} />
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
        <button onClick={onRegistrarOtro} style={{ background: "transparent", color: "var(--tx)", border: "1px solid var(--bd)", borderRadius: 8, padding: "9px 20px", fontSize: 13.5, cursor: "pointer", fontWeight: 600 }}>Registrar otro reclamo</button>
        <button onClick={onIrAlExpediente} style={{ background: "var(--acc)", color: "#fff", border: 0, borderRadius: 8, padding: "9px 22px", fontSize: 14, cursor: "pointer", fontWeight: 700, boxShadow: "0 2px 8px rgba(227,0,27,.3)" }}>Ir al expediente →</button>
      </div>
    </div>
  );
}

const badgeDudoso = { marginLeft: 5, fontSize: 9, background: "#B45309", color: "#fff", borderRadius: 4, padding: "1px 4px" };
const inp = sug => ({
  width: "100%", marginTop: 3, padding: "7px 9px", borderRadius: 8, fontSize: 13, fontFamily: "inherit",
  background: "#fff", color: "var(--tx)", border: `1px solid ${sug ? "#B45309" : "var(--bd)"}`, boxSizing: "border-box",
  outline: "none", transition: "outline-color .1s",
});
// label uniforme: texto 10.5px mayúsculas espaciadas (patrón SIELSE de campo obligatorio)
const lbl = (maxWidth) => ({ fontSize: 12, display: "block", ...(maxWidth ? { maxWidth, flex: "1 1 " + maxWidth + "px" } : {}) });
const lblSpan = { color: "var(--mut)", fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".05em", fontWeight: 600 };
// aplica el foco navy 2px a todos los inputs/selects/textareas del wizard sin tocar la lógica
if (typeof document !== "undefined" && !document.getElementById("nuevocaso-focus-style")) {
  const st = document.createElement("style");
  st.id = "nuevocaso-focus-style";
  st.textContent = ".overlay input:focus, .overlay select:focus, .overlay textarea:focus { outline: 2px solid var(--navy); outline-offset: 1px; }";
  document.head.appendChild(st);
}
