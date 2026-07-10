import { useEffect, useMemo, useState } from "react";
import { Card } from "./ui.jsx";
import { postAction, loadCatalogoCampos } from "../lib/api.js";

// Etiquetas amigables y agrupación de los tipos de documento (= plantillas)
const TIPOS = [
  ["— Resoluciones (ACT-01) —", null],
  ["RES_INFUNDADO", "Resolución · Infundado"],
  ["RES_FUNDADO", "Resolución · Fundado"],
  ["RES_FUNDADO_PARTE", "Resolución · Fundado en parte"],
  ["RES_IMPROCEDENTE", "Resolución · Improcedente"],
  ["RES_INADMISIBLE", "Resolución · Inadmisible"],
  ["RES_SUSPENSION_OFICIO", "Resolución · Suspensión de oficio"],
  ["RES_VARIOS", "Resolución · Reclamos varios"],
  ["— Evaluación y campo (ACT-03) —", null],
  ["REPORTE_1", "Reporte 1 · Evaluación excesivo consumo"],
  ["INFORME_CAMPO", "Informe de inspección de campo"],
  ["ACTA_A01_AVISO_PREVIO", "Acta A-01 · Aviso previo"],
  ["ACTA_A02_DERECHO_CONTRASTE", "Acta A-02 · Derecho a contrastación"],
  ["CARTA_RECLAMANTE", "Carta al reclamante"],
  ["— Notificación y cierre —", null],
  ["CEDULA_NOTIFICACION", "Cédula de notificación (ACT-05)"],
  ["ACTA_TRATO_DIRECTO", "Acta de Trato Directo"],
  ["CARATULA_INDICE", "Carátula + Índice foliado"],
  ["— Apelación (ACT-02) —", null],
  ["INFORME_ELEVACION", "Informe de Elevación (Formato 6)"],
  ["OFICIO_ELEVACION", "Oficio de elevación a JARU"],
];

// Mapea un reclamo del modelo del dashboard -> claves que espera el backend
function reclamoBackend(r) {
  if (!r) return {};
  return {
    codigo: r.codigo, n_osinerg: r.osinerg, solicitante: r.solicitante,
    dni: r.raw?.DniSolicitante || r.raw?.NumeroDocumento || "",
    suministro: r.suministro, direccion: r.direccion, distrito: r.distrito,
    tarifa: r.raw?.Tarifa || r.raw?.NombreTarifa || "",
    materia: r.clase, fecha_reclamo: r.fechaReg, periodo: "", monto: "",
    consumo_reclamado: "",
  };
}
// Valor AUTO a precargar en el formulario para un campo dado
function autoValue(campo, r) {
  const b = reclamoBackend(r);
  const m = {
    N_OSINERG: b.n_osinerg, COD_RECLAMO: b.codigo, RECLAMANTE: b.solicitante,
    DNI: b.dni, SUMINISTRO: b.suministro, DIRECCION: b.direccion, DISTRITO: b.distrito,
    TARIFA: b.tarifa, MATERIA: b.materia, FECHA_RECLAMO: b.fecha_reclamo,
    PERIODO_RECLAMADO: "", MONTO_RECLAMADO: "", CONSUMO_RECLAMADO: "",
  };
  return m[campo] ?? "";
}

const GRUPO_LABEL = { general: "Datos del documento", tabla: "Tabla de cargas", firma: "Firma" };

// `fijo`: reclamo preseleccionado (cuando se genera desde el Drawer del expediente) — oculta el buscador.
// `datosEtapa`: mapa CAMPO→valor capturado en las etapas; prellena los campos "llena" del documento.
// `onSaveDatos`: opcional — si viene del Drawer, persiste los campos llenados en la etapa actual.
// `etapaActual`: nombre de la etapa seleccionada en el Drawer (para el banner y el guardado).
export default function Formularios({ data, perfil, fijo = null, datosEtapa = null, onSaveDatos = null, etapaActual = null }) {
  const [catalogo, setCatalogo] = useState(null);
  const [tipo, setTipo] = useState("RES_INFUNDADO");
  const [q, setQ] = useState("");
  const [rec, setRec] = useState(fijo || null);
  const [campos, setCampos] = useState({});
  const [gen, setGen] = useState(false);
  const [res, setRes] = useState(null);
  const [precargados, setPrecargados] = useState(0);

  useEffect(() => { loadCatalogoCampos().then(setCatalogo).catch(() => setCatalogo({})); }, []);

  const spec = catalogo?.[tipo + ".docx"];

  // Reinicia los valores al cambiar de plantilla o reclamo (precarga AUTO + fijos + datos de etapa)
  useEffect(() => {
    if (!spec) return;
    const v = {};
    let pre = 0;
    spec.campos.forEach(c => {
      if (c.origen === "auto") v[c.campo] = autoValue(c.campo, rec);
      else if (c.origen === "fijo") v[c.campo] = c.valor || "";
      else if (c.campo === "COORDINADOR") v[c.campo] = "Andre Araujo Alvarez";
      else v[c.campo] = "";
      if (!v[c.campo] && datosEtapa && datosEtapa[c.campo] != null && datosEtapa[c.campo] !== "") {
        v[c.campo] = String(datosEtapa[c.campo]); pre++;
      }
    });
    setCampos(v); setRes(null); setPrecargados(pre);
  }, [tipo, rec, catalogo, datosEtapa]); // eslint-disable-line

  const resultados = useMemo(() => {
    const s = q.trim().toLowerCase();
    let arr = data || [];
    if (s) arr = arr.filter(r => [r.osinerg, r.solicitante, r.suministro, r.codigo].some(x => String(x || "").toLowerCase().includes(s)));
    return arr.slice(0, 8);
  }, [q, data]);

  function set(campo, val) { setCampos(c => ({ ...c, [campo]: val })); }

  async function generar() {
    if (!rec) { alert("Selecciona primero un reclamo."); return; }
    // aviso si quedan campos "a llenar" vacíos: el documento saldría con corchetes en blanco
    const vacios = (spec?.campos || []).filter(c => c.origen === "llena" && !String(campos[c.campo] || "").trim());
    if (vacios.length && !confirm(`Faltan ${vacios.length} campo(s) por llenar:\n· ${vacios.slice(0, 8).map(c => c.label || c.campo).join("\n· ")}${vacios.length > 8 ? "\n…" : ""}\n\n¿Generar igual (saldrán en blanco)?`)) return;
    setGen(true); setRes(null);
    const r = await postAction("generar_documento", { tipo, reclamo: reclamoBackend(rec), campos });
    setGen(false); setRes(r);
    // Persiste en la etapa actual los campos que el usuario llenó, para que queden
    // registrados en "Datos de la etapa" (no solo dentro del documento generado).
    if (r?.ok && onSaveDatos) {
      const llenos = Object.fromEntries(Object.entries(campos).filter(([, v]) => String(v || "").trim()));
      if (Object.keys(llenos).length) await onSaveDatos(llenos);
    }
  }

  // Campos visibles para llenar (oculta los calc; auto se muestran editables)
  const visibles = spec ? spec.campos.filter(c => c.origen !== "calc") : [];
  const porGrupo = g => visibles.filter(c => c.grupo === g);

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Card>
        <h3>Generar documento — plantillas con tu diseño, listas para firmar</h3>
        <div className="muted" style={{ marginBottom: 10 }}>
          Elige el documento y el reclamo. Los <b>datos generales</b> se precargan del reclamo; tú completas
          los <b>campos de la fase</b>. Se genera un <b>DOCX + PDF</b> archivado en Drive por mes.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: fijo ? "1fr" : "1fr 1fr", gap: 12 }}>
          <label style={{ fontSize: 13 }}>Tipo de documento
            <select value={tipo} onChange={e => setTipo(e.target.value)} style={inp}>
              {TIPOS.map(([k, label]) => label === null
                ? <option key={k} disabled>{k}</option>
                : <option key={k} value={k}>{label}</option>)}
            </select>
          </label>
          {!fijo && <label style={{ fontSize: 13 }}>Buscar reclamo (OSINERG / nombre / suministro)
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="REC001… / apellidos / 10010…" style={inp} />
          </label>}
        </div>
        {!fijo && q && (
          <div style={{ marginTop: 8, display: "grid", gap: 4 }}>
            {resultados.map(r => (
              <button key={r.codigo} onClick={() => { setRec(r); setQ(""); }} style={pick}>
                <b className="mono">{r.osinerg}</b> · {r.solicitante} · {r.suministro} <span className="muted">({r.clase})</span>
              </button>
            ))}
            {resultados.length === 0 && <div className="muted">Sin coincidencias.</div>}
          </div>
        )}
        {rec && (
          <div style={chip}>
            Reclamo: <b className="mono">{rec.osinerg}</b> · {rec.solicitante} · {rec.suministro}
            {!fijo && <button onClick={() => setRec(null)} style={{ marginLeft: 8, ...xbtn }}>cambiar</button>}
          </div>
        )}
      </Card>

      {spec && rec && (
        <Card>
          <h3 style={{ marginBottom: 2 }}>{(TIPOS.find(t => t[0] === tipo) || [])[1]}</h3>
          <div className="muted" style={{ marginBottom: 10 }}>
            {spec.auto} automáticos · {spec.llena} a llenar · {spec.calc} calculados por el sistema
            {precargados > 0 && <span style={{ color: "var(--tint-green-tx)", fontWeight: 600 }}> · ✓ {precargados} prellenado(s) con los datos registrados en las etapas</span>}
          </div>

          {["general", "tabla", "firma"].map(g => {
            const items = porGrupo(g); if (!items.length) return null;
            return (
              <div key={g} style={{ marginBottom: 14 }}>
                <div style={secTit}>{GRUPO_LABEL[g]}</div>
                <div style={{ display: "grid", gridTemplateColumns: g === "tabla" ? "repeat(6,1fr)" : "1fr 1fr", gap: 8 }}>
                  {items.map(c => <Field key={c.campo} c={c} val={campos[c.campo] || ""} onChange={v => set(c.campo, v)} />)}
                </div>
              </div>
            );
          })}

          <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 6 }}>
            <button onClick={generar} disabled={gen} style={btnPrim}>{gen ? "Generando…" : "Generar DOCX + PDF"}</button>
            {res?.ok && <span style={{ color: "var(--tint-green-tx)", fontSize: 13 }}>✓ Generado: {res.nombre}</span>}
            {res && !res.ok && <span style={{ color: "var(--tint-red-tx)", fontSize: 13 }}>Error: {res.error || "no se pudo generar"}</span>}
            {res?.mock && <span className="muted" style={{ fontSize: 13 }}>(sin backend: inicia sesión real para generar)</span>}
          </div>
          {res?.ok && (
            <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
              <a href={res.docxUrl} target="_blank" rel="noreferrer" style={btnDl}>⬇ Descargar DOCX</a>
              <a href={res.pdfUrl} target="_blank" rel="noreferrer" style={btnDl}>⬇ Ver PDF</a>
            </div>
          )}
          {res?.ok && (
            <div style={banner}>
              <b style={{ color: "var(--tint-amber-tx)" }}>Siguientes pasos para que este documento cuente como evidencia:</b>
              <ol style={{ margin: "6px 0 0", paddingLeft: 18, color: "var(--tint-amber-tx)" }}>
                <li>Descarga el DOCX.</li>
                <li>Corrige / firma / sella el documento.</li>
                <li>Sube el escaneado firmado con 📎 <b>Evidencia + datos</b>{etapaActual ? <> en la etapa «{etapaActual}»</> : ""}.</li>
              </ol>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function Field({ c, val, onChange }) {
  const auto = c.origen === "auto";
  const common = { value: val, onChange: e => onChange(e.target.value), style: { ...inp, ...(auto ? autoStyle : {}) } };
  let input;
  if (c.tipo === "textarea") input = <textarea rows={3} {...common} />;
  else if (c.tipo === "select") input = (
    <select {...common}><option value="">—</option>{(c.opciones || []).map(o => <option key={o} value={o}>{o}</option>)}</select>
  );
  else if (c.tipo === "date") input = <input type="text" placeholder="DD/MM/AAAA" {...common} />;
  else input = <input type={c.tipo === "num" ? "number" : "text"} {...common} />;
  const span = (c.tipo === "textarea") ? "1 / -1" : undefined;
  return (
    <label style={{ fontSize: 12.5, gridColumn: span }}>
      <span style={{ color: "var(--mut)" }}>{c.label}{auto && <span style={{ color: "var(--acc)" }}> · auto</span>}</span>
      {input}
    </label>
  );
}

const inp = { width: "100%", marginTop: 3, padding: "7px 9px", border: "1px solid var(--bd)", borderRadius: 8, fontSize: 13, fontFamily: "inherit", background: "var(--card2)", color: "var(--tx)" };
const autoStyle = { background: "var(--tint-acc-bg)", color: "var(--tx)" };
const pick = { textAlign: "left", padding: "7px 10px", border: "1px solid var(--bd)", borderRadius: 8, background: "var(--card2)", color: "var(--tx)", cursor: "pointer", fontSize: 13 };
const chip = { marginTop: 10, padding: "8px 12px", background: "var(--tint-acc-bg)", border: "1px solid var(--tint-acc-bd)", borderRadius: 8, fontSize: 13, color: "var(--tx)" };
const xbtn = { border: "1px solid var(--bd)", borderRadius: 6, background: "var(--card2)", color: "var(--tx)", cursor: "pointer", fontSize: 12, padding: "2px 8px" };
const secTit = { fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--mut)", fontWeight: 700, borderBottom: "1px solid var(--bd)", paddingBottom: 4, marginBottom: 8 };
const btnPrim = { background: "var(--acc)", color: "#fff", border: 0, borderRadius: 8, padding: "9px 16px", fontSize: 14, cursor: "pointer", fontWeight: 600 };
const btnDl = { background: "var(--navy)", color: "#fff", borderRadius: 8, padding: "8px 14px", fontSize: 13, textDecoration: "none" };
const banner = { marginTop: 12, background: "var(--tint-amber-bg)", border: "1px solid var(--tint-amber-bd)", borderRadius: 8, padding: "10px 12px", fontSize: 13 };
