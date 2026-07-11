// 🗂 OFICINA — vista SIMPLE para el TRAMITADOR (Mi día → sub-pestaña). Pedido literal del
// gerente: "algo físico que sí o sí debemos procesar… el tramitador toma foto, se registra,
// cruza información… sencillo… SIN mostrar toda la información a detalle, solo lo básico…
// pensado para personas adultas que no se adaptan a la tecnología". Cero jerga SIELSE, móvil
// primero, targets ≥44px, tipografía grande. Los JEFES conservan su panel completo
// (OficinaPanel.jsx, en Expedientes) — esta vista es el espejo simplificado para el trabajo
// diario de Marilyn/Jocabed/Anais con el celular.
//
// El dato es el MISMO de siempre (datos_etapa "Recepción" vía guardar_datos, cero columnas
// nuevas — ver lib/camposEtapa.js FISICO_*): aquí solo cambia CÓMO se llega a marcarlo.
// Toda la red pasa por api.js (extraerCamposIA/subirArchivo ya existen; saveDatos llega del
// contexto → lib/api.js guardarDatos). Nada de esto es "silencioso": cada marca queda firmada
// en la bitácora como cualquier dato de etapa.
import { useMemo, useRef, useState } from "react";
import { Card, toast } from "../ui.jsx";
import { SemaforoPlazo } from "../Ticket.jsx";
import { extraerCamposIA, subirArchivo } from "../../lib/api.js";
import { ETAPA_ROL, ETAPA_NN } from "../../lib/model.js";
import { hoyISO, tieneFisico, rankActivo } from "./util.js";

// Lo mínimo que la IA debe leer del Formato 1 para cruzar con la cartera — igual criterio de
// NuevoCaso.jsx (EXTRAER): mismos nombres de campo que ya entiende extraer_ia.
const CAMPOS_FOTO = [
  { k: "NumeroOsinerg", label: "N° OSINERG (REC00…) si aparece en el folder" },
  { k: "CodigoSuministro", label: "Código de suministro (11 dígitos)" },
  { k: "NombreSolicitante", label: "Nombre del reclamante" },
];
const ETAPA_NN_RECEPCION = ETAPA_NN["Recepción"] || "01_Recepcion";

// Botón grande — MISMO patrón visual que los dos botones principales de Mi día (MiDia.jsx).
const btnGrande = (variant) => ({
  flex: "1 1 220px", padding: 16, borderRadius: 14, fontSize: 16, fontWeight: 800, cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 56,
  ...(variant === "navy"
    ? { border: 0, background: "var(--navy)", color: "#fff", boxShadow: "0 4px 14px rgba(31,78,140,.28)" }
    : { border: "2px solid var(--acc)", background: "var(--card)", color: "var(--tx)" }),
});

// resuelve un caso a partir de lo leído/tecleado: N° OSINERG EXACTO → suministro (solo si es
// ÚNICO — un suministro con varios reclamos NUNCA se auto-elige, va a "ambiguo" a elegir a mano).
function resolverCaso({ osinerg, suministro }, data) {
  if (osinerg) {
    const rec = data.find(x => String(x.osinerg || "").trim().toUpperCase() === String(osinerg).trim().toUpperCase());
    if (rec) return { rec };
  }
  if (suministro) {
    const cands = data.filter(x => String(x.suministro || "").trim() === String(suministro).trim());
    if (cands.length === 1) return { rec: cands[0] };
    if (cands.length > 1) return { ambiguo: { suministro, candidatos: cands } };
  }
  return { noEncontrado: true };
}

export default function OficinaSimple({ data = [], activoByCode = {}, datos = {}, saveDatos, perfil, setSelExp, onEscanear }) {
  const [leyendo, setLeyendo] = useState(false);
  const [ambiguo, setAmbiguo] = useState(null);      // {suministro, candidatos:[...]}
  const [confirmar, setConfirmar] = useState(null);  // {x, foto, fuente}
  const [guardando, setGuardando] = useState(false);
  const [qManual, setQManual] = useState("");
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState("todos");     // todos | urgentes | mia
  const camRef = useRef();
  const rol = perfil?.rol;

  // ---- universo: casos YA marcados como físico en oficina, con su urgencia actual ----
  const marcados = useMemo(() => data
    .filter(x => tieneFisico(datos, x.codigo))
    .map(x => ({ x, act: activoByCode[String(x.codigo)] }))
    .sort((a, b) => rankActivo(a.x, activoByCode) - rankActivo(b.x, activoByCode)),
  [data, datos, activoByCode]);

  const urgentesN = useMemo(() => marcados.filter(({ x }) => rankActivo(x, activoByCode) <= 1).length, [marcados, activoByCode]);
  const miEtapaN = useMemo(() => marcados.filter(({ x, act }) => ETAPA_ROL[act ? act.etapa : x.etapa] === rol).length, [marcados, rol]);

  const filtrados = useMemo(() => {
    let base = marcados;
    if (filtro === "urgentes") base = base.filter(({ x }) => rankActivo(x, activoByCode) <= 1);
    if (filtro === "mia") base = base.filter(({ x, act }) => ETAPA_ROL[act ? act.etapa : x.etapa] === rol);
    if (!q.trim()) return base;
    const qq = q.trim().toLowerCase();
    return base.filter(({ x }) => `${x.osinerg || ""} ${x.solicitante || ""} ${x.suministro || ""}`.toLowerCase().includes(qq));
  }, [marcados, filtro, q, activoByCode, rol]);

  // ---- búsqueda manual (fallback si la foto falla, o para marcar directo) — busca en TODA la cartera ----
  const resultadosManual = useMemo(() => {
    if (qManual.trim().length < 2) return [];
    const qq = qManual.trim().toLowerCase();
    return data.filter(x => `${x.solicitante || ""} ${x.suministro || ""} ${x.osinerg || ""}`.toLowerCase().includes(qq)).slice(0, 8);
  }, [data, qManual]);

  function cancelarTodo() {
    setAmbiguo(null); setConfirmar(null); setLeyendo(false);
    if (camRef.current) camRef.current.value = "";
  }

  async function onFoto(e) {
    const file = e.target.files && e.target.files[0];
    if (camRef.current) camRef.current.value = ""; // permite volver a elegir la misma foto
    if (!file) return;
    setLeyendo(true); setAmbiguo(null); setConfirmar(null);
    try {
      const r = await extraerCamposIA({ file, etapa: "Recepción", campos: CAMPOS_FOTO, guardar: false });
      setLeyendo(false);
      if (!r || r.ok === false) { toast("No se pudo leer la foto — búscalo a mano abajo ↓"); return; }
      const osinerg = r.campos?.NumeroOsinerg, suministro = r.campos?.CodigoSuministro;
      if (!osinerg && !suministro) { toast("No se leyó suministro ni N° OSINERG — búscalo a mano abajo ↓"); return; }
      const res = resolverCaso({ osinerg, suministro }, data);
      if (res.rec) setConfirmar({ x: res.rec, foto: file, fuente: "foto folder" });
      else if (res.ambiguo) setAmbiguo({ ...res.ambiguo, foto: file });
      else toast("No encontramos ese caso en la cartera — búscalo a mano abajo ↓");
    } catch (err) {
      setLeyendo(false);
      toast("Error leyendo la foto — búscalo a mano abajo ↓");
    }
  }

  function elegirAmbiguo(rec) {
    setConfirmar({ x: rec, foto: ambiguo?.foto || null, fuente: "foto folder" });
    setAmbiguo(null);
  }

  function elegirManual(x) {
    setConfirmar({ x, foto: null, fuente: "manual" });
    setQManual("");
  }

  async function confirmarSi() {
    if (!confirmar || guardando) return;
    setGuardando(true);
    const { x, foto, fuente } = confirmar;
    const r = await saveDatos({ exp: x.codigo, etapa: "Recepción", rol, campos: {
      FISICO_OFICINA: "sí", FISICO_FECHA: hoyISO(), FISICO_FUENTE: fuente,
    } });
    if (r && r.ok === false) { toast("⚠ No se guardó: " + (r.error || "error")); setGuardando(false); return; }
    if (foto) { try { await subirArchivo(x.codigo, ETAPA_NN_RECEPCION, foto); } catch (e) { /* el registro ya quedó guardado */ } }
    toast("✓ Guardado — folder registrado");
    setGuardando(false);
    cancelarTodo();
  }

  const ocupado = leyendo || !!ambiguo || !!confirmar;

  return <>
    {/* ---- Cabecera: 2 botones grandes (mismo patrón que Mi día) ---- */}
    {!ocupado && <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
      {onEscanear && <button onClick={onEscanear} style={btnGrande("navy")}>📷 Escanear QR del folder</button>}
      <button onClick={() => camRef.current?.click()} style={btnGrande("outline")}>📸 Foto a la primera página</button>
    </div>}
    <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={onFoto} />

    {leyendo && <Card style={{ marginBottom: 14, textAlign: "center" }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: "var(--titulo)" }}>🔎 Leyendo la foto…</div>
      <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Un momento, esto es automático.</div>
    </Card>}

    {ambiguo && (
      <Card style={{ marginBottom: 14, borderLeft: "4px solid var(--amber)" }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: "var(--titulo)", marginBottom: 4 }}>⚡ Suministro {ambiguo.suministro} tiene varios reclamos</div>
        <div className="muted" style={{ fontSize: 12.5, marginBottom: 12 }}>Elige cuál es — nunca se marca solo.</div>
        <div style={{ display: "grid", gap: 8 }}>
          {ambiguo.candidatos.map(c => (
            <button key={c.codigo} onClick={() => elegirAmbiguo(c)} style={{
              textAlign: "left", padding: "13px 14px", borderRadius: 12, border: "1px solid var(--bd)",
              background: "var(--card2)", minHeight: 52, cursor: "pointer",
            }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--titulo)" }}>{c.solicitante}</div>
              <div className="muted" style={{ fontSize: 12 }}>{c.osinerg || c.codigo} · {c.estado}</div>
            </button>
          ))}
        </div>
        <button className="btn-ghost" style={{ marginTop: 12, minHeight: 44, width: "100%" }} onClick={cancelarTodo}>← Cancelar</button>
      </Card>
    )}

    {confirmar && (() => {
      const act = activoByCode[String(confirmar.x.codigo)];
      const etapaTxt = act ? act.etapa : confirmar.x.etapa;
      return (
        <Card style={{ marginBottom: 14, borderLeft: "4px solid var(--acc)" }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--mut)", fontWeight: 700, marginBottom: 8 }}>¿Es este expediente?</div>
          <div style={{ fontSize: 21, fontWeight: 800, color: "var(--titulo)", marginBottom: 6 }}>{confirmar.x.solicitante || "—"}</div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", fontSize: 14.5 }}>
            {confirmar.x.suministro && <span className="mono">⚡ {confirmar.x.suministro}</span>}
            <span>{etapaTxt}</span>
            {act && <SemaforoPlazo t={act} />}
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{confirmar.x.osinerg || confirmar.x.codigo}</div>
          <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
            <button className="btn primary" disabled={guardando} onClick={confirmarSi}
              style={{ flex: "1 1 200px", minHeight: 52, fontSize: 16, fontWeight: 800 }}>
              {guardando ? "Guardando…" : "✔ Sí, está en oficina"}
            </button>
            <button className="btn-ghost" disabled={guardando} onClick={cancelarTodo}
              style={{ flex: "1 1 160px", minHeight: 52, fontSize: 15, fontWeight: 700 }}>
              ✖ No, buscar a mano
            </button>
          </div>
        </Card>
      );
    })()}

    {/* ---- Búsqueda manual — siempre visible, fallback de la foto/QR ---- */}
    {!ocupado && <Card style={{ marginBottom: 14 }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>🔎 O búscalo a mano</div>
      <input value={qManual} onChange={e => setQManual(e.target.value)} placeholder="Nombre o suministro…"
        style={{ width: "100%", padding: 13, fontSize: 16, borderRadius: 10, border: "1px solid var(--bd)", boxSizing: "border-box" }} />
      {qManual.trim().length >= 2 && (
        <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
          {resultadosManual.map(x => (
            <button key={x.id} onClick={() => elegirManual(x)} style={{
              textAlign: "left", padding: "11px 13px", borderRadius: 10, border: "1px solid var(--bd)",
              background: "var(--card2)", minHeight: 48, cursor: "pointer",
            }}>
              <span style={{ fontWeight: 700, color: "var(--titulo)" }}>{x.solicitante}</span>{" "}
              <span className="muted" style={{ fontSize: 12 }}>· ⚡{x.suministro || "—"} · {x.osinerg || x.codigo}</span>
            </button>
          ))}
          {!resultadosManual.length && <div className="muted" style={{ fontSize: 12.5 }}>Sin resultados.</div>}
        </div>
      )}
    </Card>}

    {/* ---- Filtros: 3 chips grandes ---- */}
    {!ocupado && <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
      {[
        ["todos", `Todos (${marcados.length})`],
        ["urgentes", `🔴 Urgentes (${urgentesN})`],
        ["mia", `Mi etapa (${miEtapaN})`],
      ].map(([k, label]) => (
        <button key={k} onClick={() => setFiltro(k)} style={{
          minHeight: 44, padding: "9px 16px", borderRadius: 999, fontSize: 13.5, fontWeight: 700, cursor: "pointer",
          border: `1px solid ${filtro === k ? "var(--acc)" : "var(--bd)"}`,
          background: filtro === k ? "var(--acc)" : "var(--card)", color: filtro === k ? "#fff" : "var(--tx)",
        }}>{label}</button>
      ))}
    </div>}

    {/* ---- Lista de físicos en oficina — una tarjeta por caso, SOLO lo básico ---- */}
    {!ocupado && <div style={{ display: "grid", gap: 10 }}>
      {filtrados.map(({ x, act }) => (
        <button key={x.id} onClick={() => setSelExp(x.id)} style={{
          textAlign: "left", padding: "14px 15px", borderRadius: 14, border: "1px solid var(--bd)",
          background: "var(--card2)", cursor: "pointer", display: "block", minHeight: 44,
        }}>
          <div style={{ fontSize: 15.5, fontWeight: 800, color: "var(--titulo)" }}>{x.solicitante || "—"}</div>
          <div style={{ display: "flex", gap: 9, alignItems: "center", flexWrap: "wrap", marginTop: 5 }}>
            {x.suministro && <span className="mono" style={{ fontSize: 13 }}>⚡ {x.suministro}</span>}
            <span style={{ fontSize: 13, color: "var(--tx2)" }}>{act ? act.etapa : x.etapa}</span>
            {act && <SemaforoPlazo t={act} />}
          </div>
        </button>
      ))}
      {!filtrados.length && <Card><div className="muted" style={{ textAlign: "center", padding: 14 }}>
        {marcados.length ? "Nada con este filtro." : "Sin folders marcados todavía — usa 📷 o 📸 arriba."}
      </div></Card>}
    </div>}
  </>;
}
