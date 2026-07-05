import { useState } from "react";
import { fmtFecha, FLUJO, ETAPA_NN } from "../lib/model.js";
import { toast } from "./ui.jsx";

// ===================== Ficha SIELSE =====================
// Modal casi pantalla completa (mismo patrón que el modal "📄 Generar documento" del Drawer).
// Conecta en una sola vista: 1) el registro SIELSE completo del caso (exp.raw, las 45 columnas),
// 2) lo trabajado en la plataforma por cada etapa (datos[exp.codigo+"|"+etapa]) y
// 3) los documentos/evidencias del expediente. Cada campo tiene botón 📋 copiar (para
// que el digitador lo pegue directo en SIELSE) y un botón arriba copia TODO como texto plano.

const copiar = (label, val) => {
  const t = String(val ?? "");
  if (!t) return;
  navigator.clipboard?.writeText(t).then(
    () => toast("📋 copiado: " + label),
    () => toast("No se pudo copiar")
  );
};

// Fila label -> valor, con botón copiar. Vacíos en gris "—" (así el digitador ve qué falta).
function Fila({ label, value }) {
  const vacio = value == null || value === "";
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "5px 0", borderBottom: "1px solid var(--bd)" }}>
      <div style={{ width: 190, flexShrink: 0, fontSize: 11.5, color: "var(--mut)" }}>{label}</div>
      <div style={{ flex: 1, fontSize: 12.5, color: vacio ? "var(--mut)" : "var(--tx)", wordBreak: "break-word" }}>{vacio ? "—" : String(value)}</div>
      {!vacio && (
        <button onClick={() => copiar(label, value)} title={"Copiar " + label}
          style={{ flexShrink: 0, background: "transparent", border: "1px solid var(--bd)", color: "var(--linkTx)", borderRadius: 6, padding: "1px 6px", fontSize: 11, cursor: "pointer" }}>📋</button>
      )}
    </div>
  );
}

const Bloque = ({ t, children }) => (
  <div style={{ marginBottom: 16 }}>
    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--tx)", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 6 }}>{t}</div>
    {children}
  </div>
);

const Grupo = ({ t, children }) => (
  <div style={{ marginBottom: 10, background: "var(--card2)", border: "1px solid var(--bd)", borderRadius: 8, padding: "8px 10px" }}>
    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--linkTx)", marginBottom: 4 }}>{t}</div>
    {children}
  </div>
);

// Grupos de REGISTRO DEL CASO — campos de exp.raw (las 45 columnas SIELSE) + algunos ya mapeados en exp.
function gruposRegistro(exp) {
  const r = exp.raw || {};
  return [
    { t: "Identificación", campos: [
      ["Código de reclamo", r.CodigoReclamo ?? exp.codigo],
      ["N° OSINERGMIN", r.NumeroOsinerg ?? exp.osinerg],
      ["Fecha de registro", fmtFecha(r.FechaRegistroReclamo ?? exp.fechaReg)],
      ["Fecha de admisión", fmtFecha(r.FechaAdmisionReclamo ?? exp.fechaAdm)],
      ["Fecha límite de atención", fmtFecha(r.FechaLimiteAtencion ?? exp.fechaLim)],
      ["Fecha estimada de solución", fmtFecha(r.FechaEstimadaSolucion ?? exp.fechaEstimada)],
    ]},
    { t: "Solicitante", campos: [
      ["Nombre del solicitante", r.NombreSolicitante ?? exp.solicitante],
      ["DNI / documento", r.DniSolicitante ?? r.NumeroDocumento ?? r.raw?.DNI],
      ["Dirección", r.DireccionSolicitante ?? exp.direccion],
    ]},
    { t: "Ubicación", campos: [
      ["Departamento", r.NombreDepartamento ?? exp.depto],
      ["Provincia", r.NombreProvincia ?? exp.provincia],
      ["Distrito", r.NombreDistrito ?? exp.distrito],
      ["Código de suministro", r.CodigoSuministro ?? exp.suministro],
      ["SET", r.NombreSET],
      ["AMT", r.NombreAMT],
      ["SED", r.NombreSED ?? exp.sed],
      ["Referencia de ubicación", r.ReferenciaUbicacion ?? exp.referencia],
    ]},
    { t: "Clasificación", campos: [
      ["Clase de reclamo", r.NombreClaseReclamo ?? exp.clase],
      ["Forma de reclamo", r.NombreFormaReclamo ?? exp.forma],
      ["Tipo de resolución", r.NombreTipoResolucionReclamo ?? exp.tipoRes],
      ["Área administrativa", r.NombreAreaAdministrativa ?? exp.area],
      ["Responsable (SIELSE)", r.Responsable ?? exp.respRaw],
      ["¿Admitido?", r.EsAdmitido != null ? (String(r.EsAdmitido) === "1" ? "Sí" : "No") : (exp.admitido ? "Sí" : "No")],
      ["¿Apelación?", r.Apelacion != null ? (String(r.Apelacion) === "1" ? "Sí" : "No") : (exp.apelacion ? "Sí" : "No")],
      ["Monto en reclamo (S/)", r.monto_reclamo ?? r.MontoReclamo],
    ]},
    { t: "Estado / Solución", campos: [
      ["Estado comercial", r.NombreEstadoReclamoComercial ?? exp.estadoCom],
      ["Situación del reclamo", r.NombreSituacionReclamo ?? exp.situacion],
      ["Descripción del reclamo", r.DescripcionReclamo ?? exp.descripcion],
      ["Descripción de la solución", r.DescripcionSolucion ?? exp.solucion],
      ["Motivo de cierre", r.NombreMotivoCierreReclamo ?? exp.motivoCierre],
      ["Fecha/hora de solución", r.FechaHoraSolucionReclamo ? fmtFecha(r.FechaHoraSolucionReclamo) : fmtFecha(exp.fechaSol)],
      ["Documento de referencia", r.DocumentoReferencia ?? exp.docRef],
    ]},
  ];
}

// Arma el bloque de texto plano con TODOS los campos no vacíos (registro + etapas + docs).
function armarTextoCompleto(exp, gruposEtapas, docs) {
  const lineas = [];
  lineas.push("FICHA SIELSE — " + (exp.osinerg || exp.codigo));
  lineas.push("");
  lineas.push("=== REGISTRO DEL CASO ===");
  gruposRegistro(exp).forEach(g => {
    const camposLlenos = g.campos.filter(([, v]) => v != null && v !== "");
    if (!camposLlenos.length) return;
    lineas.push("-- " + g.t + " --");
    camposLlenos.forEach(([l, v]) => lineas.push(l + ": " + v));
  });
  if (gruposEtapas.length) {
    lineas.push("");
    lineas.push("=== TRABAJADO EN LA PLATAFORMA (por fase) ===");
    gruposEtapas.forEach(({ etapa, campos }) => {
      lineas.push("-- " + etapa + " --");
      campos.forEach(([l, v]) => lineas.push(l + ": " + v));
    });
  }
  if (docs.length) {
    lineas.push("");
    lineas.push("=== DOCUMENTOS DEL CASO ===");
    docs.forEach(d => lineas.push("[" + d.etapa + "] " + d.nombre + (d.url ? " — " + d.url : "")));
  }
  return lineas.join("\n");
}

export default function FichaSielse({ exp, datos, evidencias, onClose }) {
  const [w, setW] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
  const mobile = w < 880;

  const datosDe = et => (datos && datos[exp.codigo + "|" + et]) || {};
  const humaniza = k => String(k).replace(/_/g, " ").toLowerCase().replace(/^\w/, c => c.toUpperCase());

  // Trabajado en la plataforma por etapa — solo etapas con al menos 1 registro.
  const gruposEtapas = FLUJO.map(f => {
    const dat = datosDe(f.etapa);
    const keys = Object.keys(dat).filter(k => dat[k] != null && dat[k] !== "");
    return { etapa: f.etapa, campos: keys.map(k => [humaniza(k), dat[k]]) };
  }).filter(g => g.campos.length);

  // Documentos del caso — evidencias del expediente (misma lógica de match etapa/ETAPA_NN del Drawer).
  // Dedup defensivo: por url si existe (identifica el archivo físico en Drive), si no por etapa+nombre.
  // Necesario aunque api.js ya deduplique, porque corridas de simulación repetidas pueden llegar
  // a este componente vía props ya duplicadas.
  const docsCaso = (evidencias || []).filter(e => e.exp === exp.codigo);
  const vistoDocs = new Set();
  const docs = docsCaso.filter(d => {
    const k = d.url ? "u:" + d.url : "n:" + d.etapa + "|" + d.nombre;
    if (vistoDocs.has(k)) return false;
    vistoDocs.add(k);
    return true;
  });

  const copiarTodo = () => {
    const txt = armarTextoCompleto(exp, gruposEtapas, docs);
    navigator.clipboard?.writeText(txt).then(
      () => toast("📄 Ficha completa copiada"),
      () => toast("No se pudo copiar")
    );
  };

  const wrapS = { ...wrap, ...(mobile ? { width: "100vw", height: "100vh", maxWidth: "none", borderRadius: 0 } : {}) };

  return (
    <div className="overlay" style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: mobile ? 0 : 16, zIndex: 70 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={wrapS}>
        <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--bd)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <b style={{ color: "var(--titulo)", fontSize: 15 }}>📋 Ficha SIELSE — <span className="mono">{exp.osinerg || exp.codigo}</span></b>
            <span className="muted" style={{ fontSize: 12 }}>{exp.solicitante}</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn sm" onClick={copiarTodo} title="Copia todos los campos no vacíos como texto plano">📄 Copiar TODO como texto</button>
            <button className="btn sec sm" onClick={onClose} title="Cerrar ficha">✕ cerrar</button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "grid", gap: 20, gridTemplateColumns: mobile ? "1fr" : "1.3fr 1fr" }}>
          {/* Columna izquierda: registro del caso */}
          <div>
            <Bloque t="🗂 Registro del caso (lo que se digita en SIELSE)">
              {gruposRegistro(exp).map(g => (
                <Grupo key={g.t} t={g.t}>
                  {g.campos.map(([l, v]) => <Fila key={l} label={l} value={v} />)}
                </Grupo>
              ))}
            </Bloque>
          </div>

          {/* Columna derecha: trabajado en plataforma + documentos */}
          <div>
            <Bloque t="🛠 Trabajado en la plataforma (por fase)">
              {gruposEtapas.length ? gruposEtapas.map(g => (
                <Grupo key={g.etapa} t={g.etapa}>
                  {g.campos.map(([l, v]) => <Fila key={l} label={l} value={v} />)}
                </Grupo>
              )) : <div className="muted" style={{ fontSize: 12 }}>Aún no se registraron datos en ninguna etapa.</div>}
            </Bloque>

            <Bloque t="📎 Documentos del caso">
              {docs.length ? (
                <div style={{ display: "grid", gap: 6 }}>
                  {docs.map((d, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--card2)", border: "1px solid var(--bd)", borderRadius: 8, padding: "6px 9px" }}>
                      <span style={{ fontSize: 10, color: "var(--linkTx)", fontWeight: 700, flexShrink: 0 }}>{d.etapa}</span>
                      <span style={{ flex: 1, fontSize: 12, color: "var(--tx)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.nombre}</span>
                      {d.url && <a className="link" style={{ fontSize: 11, flexShrink: 0 }} href={d.url} target="_blank" rel="noreferrer">🔗 Drive ↗</a>}
                    </div>
                  ))}
                </div>
              ) : <div className="muted" style={{ fontSize: 12 }}>Sin documentos subidos para este expediente.</div>}
            </Bloque>
          </div>
        </div>
      </div>
    </div>
  );
}

const wrap = { width: "96vw", maxWidth: 1400, height: "92vh", background: "var(--card)", border: "1px solid var(--bd)", borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(22,41,75,.15)" };
