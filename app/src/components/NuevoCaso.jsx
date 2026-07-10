import { useState, useRef, useEffect } from "react";
import { nuevoReclamo, subirArchivo, extraerCamposIA, guardarDatos, loadCatalogos } from "../lib/api.js";
import { toast } from "./ui.jsx";
import { CATALOGOS_LOCAL, agruparCatalogos, mezclarCatalogos } from "../lib/catalogosSielse.js";
import { EXTRAER, PASOS, BORRADOR_KEY } from "./nuevocaso/constantes.js";
import "./nuevocaso/estilos.js"; // side effect: inyecta el estilo de foco del wizard
import { ResumenVivo } from "./nuevocaso/ResumenVivo.jsx";
import { Paso1 } from "./nuevocaso/Paso1.jsx";
import { Paso2 } from "./nuevocaso/Paso2.jsx";
import { Paso3 } from "./nuevocaso/Paso3.jsx";
import { Paso4 } from "./nuevocaso/Paso4.jsx";
import { Paso5 } from "./nuevocaso/Paso5.jsx";
import { PantallaExito } from "./nuevocaso/PantallaExito.jsx";

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
      <div style={{ width: "min(1180px,97vw)", maxHeight: "94vh", display: "flex", flexDirection: "column", background: "var(--card)", border: "1px solid var(--bd)", borderRadius: 14, boxShadow: "var(--shadow-modal)", overflow: "hidden" }}>
        {/* header — franja hero */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, padding: "16px 20px", background: "linear-gradient(120deg,var(--tint-acc-bg),var(--card2))", borderBottom: "1px solid var(--bd)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center",
              background: "linear-gradient(135deg,var(--acc),var(--accLight))", fontSize: 20, boxShadow: "var(--shadow-card)",
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
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 18px", background: "var(--tint-amber-bg)", borderBottom: "1px solid var(--bd)", fontSize: 12.5 }}>
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
                      boxShadow: paso === p.n ? "var(--shadow-pop)" : "none", transition: "all .12s",
                    }}>
                    <span style={{
                      width: 18, height: 18, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center",
                      fontSize: 10, background: paso === p.n ? "rgba(255,255,255,.25)" : (completo[p.n] ? "var(--green)" : "var(--bd)"),
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
                  <div style={{ width: "min(720px,94vw)", height: "88vh", background: "var(--card)", borderRadius: 12, overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "var(--shadow-modal)" }}>
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
                ? <button onClick={siguiente} style={{ background: "var(--acc)", color: "#fff", border: 0, borderRadius: 8, padding: "9px 22px", fontSize: 14, cursor: "pointer", fontWeight: 700, boxShadow: "var(--shadow-pop)" }}>Continuar →</button>
                : <button onClick={crearYMostrarExito} disabled={busy} style={{ background: "var(--green)", color: "#fff", border: 0, borderRadius: 8, padding: "9px 22px", fontSize: 14, cursor: "pointer", fontWeight: 700, boxShadow: "var(--shadow-pop)" }}>{busy ? "Creando…" : "Crear expediente ✓"}</button>}
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
