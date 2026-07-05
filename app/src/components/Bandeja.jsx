import { useEffect, useMemo, useState } from "react";
import { vincularCorreo, correoCompleto, responderCorreo, resumirIA, iaChat, verEml } from "../lib/api.js";
import { Card, Tag, toast } from "./ui.jsx";
import { puedeVerTodo } from "../lib/auth.js";

// Parse tolerante de la fecha del correo: acepta Date, ISO ("2026-07-02T10:00:00.000Z"),
// "yyyy-MM-dd HH:mm:ss" u otro formato reconocible por Date(). Devuelve null si no se puede parsear.
function parseFechaCorreo_(v){
  if (!v) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

// Convierte cualquier fecha parseable a milisegundos para ordenar desc (más nuevo arriba).
// Sin fecha parseable → va al fondo (no rompe el orden de lo que sí tiene fecha).
function tsCorreo_(c){
  const f = parseFechaCorreo_(c?.fecha);
  return f ? f.getTime() : -Infinity;
}

function ordenarDesc_(lista){
  return [...(lista || [])].sort((a, b) => tsCorreo_(b) - tsCorreo_(a));
}

// Quita duplicados: primero por `id` único; luego, si dos correos con id distinto comparten
// (buzon+de+asunto+fecha), se conserva solo uno. Esto cubre el caso de resincronizaciones que
// reinsertan el mismo correo con otro id. Conserva el orden de entrada.
function dedupCorreos_(lista){
  const porId = new Map();
  (lista || []).forEach(c => { const k = c?.id != null ? String(c.id) : Symbol(); if (!porId.has(k)) porId.set(k, c); });
  const vistos = new Set();
  const out = [];
  for (const c of porId.values()) {
    const clave = [c.buzon || "", c.de || "", c.asunto || "", c.fecha || ""].join("||").toLowerCase();
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    out.push(c);
  }
  return out;
}

// Fecha humana estilo cliente de correo: "Hoy 15:11" / "Ayer 10:15" / "26 jun · 15:11"
// (año solo si es distinto al actual). Si no hay fecha parseable, devuelve el crudo (o "—").
function fechaHumana_(v){
  const f = parseFechaCorreo_(v);
  if (!f) return v || "—";
  const ahora = new Date();
  const hora = f.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", hour12: false });
  const mismoDia = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (mismoDia(f, ahora)) return `Hoy ${hora}`;
  const ayer = new Date(ahora); ayer.setDate(ayer.getDate() - 1);
  if (mismoDia(f, ayer)) return `Ayer ${hora}`;
  const opts = { day: "2-digit", month: "short" };
  if (f.getFullYear() !== ahora.getFullYear()) opts.year = "numeric";
  const fechaCorta = f.toLocaleDateString("es-PE", opts).replace(".", "");
  return `${fechaCorta} · ${hora}`;
}

// Etiqueta de separador de día ("— Hoy —" / "— Ayer —" / "— 26 jun —") para la lista plana.
function claveDia_(v){
  const f = parseFechaCorreo_(v);
  if (!f) return "Sin fecha";
  const ahora = new Date();
  const mismoDia = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (mismoDia(f, ahora)) return "Hoy";
  const ayer = new Date(ahora); ayer.setDate(ayer.getDate() - 1);
  if (mismoDia(f, ayer)) return "Ayer";
  const opts = { day: "2-digit", month: "short" };
  if (f.getFullYear() !== ahora.getFullYear()) opts.year = "numeric";
  return f.toLocaleDateString("es-PE", opts).replace(".", "");
}

// Extrae el nombre visible de un remitente tipo `"Juan Pérez" <juan@else.pe>` o `juan@else.pe`.
// El email completo queda disponible como title (tooltip) en el row.
function nombreRemitente_(de){
  if (!de) return "—";
  const m = String(de).match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (m && m[1].trim()) return m[1].trim();
  if (m && m[2]) return m[2].trim();
  return String(de).trim();
}

// URL de previsualización embebible de un archivo de Drive (mismo patrón que Drawer.jsx).
function previewUrl_(url) {
  const m = String(url || "").match(/\/d\/([^/]+)/) || String(url || "").match(/[?&]id=([^&]+)/);
  return m ? `https://drive.google.com/file/d/${m[1]}/preview` : url;
}
const esImg_ = n => /\.(jpg|jpeg|png|gif|webp)$/i.test(String(n || ""));
const esEml_ = (n, a) => a?.tipo === "eml" || /\.eml$/i.test(String(n || "")) || String(a?.contentType || "").indexOf("message/rfc822") === 0;
const esPdf_ = (n, a) => a?.tipo === "pdf" || /\.pdf$/i.test(String(n || "")) || a?.contentType === "application/pdf";
const esHojaCalculo_ = n => /\.(xlsx?|csv)$/i.test(String(n || ""));

// Filtra los adjuntos "de trabajo" para mostrar en listas: oculta los inline:true (logos/firma
// embebidos en el cuerpo). Tolerante con adjuntos viejos que no tengan el campo `inline`.
const soloAdjuntosDeTrabajo_ = lista => (lista || []).filter(a => !a?.inline);

// Un adjunto quedó SIN descargar si el backend le puso un `estado` distinto de 'ok' (fallo de
// descarga o "muy_grande") y no tiene `url` para abrir. Tolerante con registros viejos que no
// traían el campo `estado` (esos se consideran 'ok' siempre que tengan url).
const adjuntoNoDescargado_ = a => !!(a?.estado && a.estado !== "ok" && !a?.url);
function motivoAdjuntoNoDescargado_(a){
  if (a?.estado === "muy_grande") return "muy grande para descargar automáticamente";
  if (a?.estado === "error_descarga") return "falló la descarga";
  return "no descargado";
}

// Ícono + etiqueta amable según tipo de adjunto (usa `tipo`/`contentType` si vienen del backend
// actualizado; si no, cae a heurística por extensión del nombre — tolera adjuntos viejos).
function iconoAdjunto_(a){
  const nombre = a?.nombre || "";
  if (esEml_(nombre, a)) return "📧";
  if (esImg_(nombre) || a?.tipo === "imagen") return "🖼";
  if (esPdf_(nombre, a)) return "📄";
  if (esHojaCalculo_(nombre)) return "📊";
  return "📎";
}

// Cuerpo del correo en texto plano para mandar a la IA: prioriza `text`; si solo hay `html`,
// le quita etiquetas/entidades básicas (mismo patrón que enviarCorreo/EmailSync.gs en el backend).
function cuerpoTextoPlano_(detalle) {
  if (!detalle) return "";
  if (detalle.text && detalle.text.trim()) return detalle.text.trim();
  const html = detalle.html || "";
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

const ESTADOS_FILTRO = ["Todos", "nuevo", "vinculado", "respondido"];

// Webmail Hostinger: el trabajador inicia sesión con su buzón @ingeneriatelcom.com para abrir
// adjuntos que el backend no pudo descargar automáticamente (error_descarga / muy_grande).
const WEBMAIL_URL = "https://mail.hostinger.com";

// ===== Estilos inline (patrón dominante del proyecto: Drawer.jsx, Ticket.jsx) =====
const S = {
  kpiRow: { display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 },
  kpiChip: { display: "flex", alignItems: "center", gap: 7, background: "var(--card2)", border: "1px solid var(--bd)", borderRadius: 10, padding: "8px 14px", cursor: "pointer", fontSize: 12.5, color: "var(--tx)", lineHeight: 1.2 },
  kpiChipActiva: { borderColor: "var(--acc)", boxShadow: "0 0 0 1px var(--acc) inset" },
  kpiNum: { fontSize: 17, fontWeight: 800, color: "var(--titulo)" },
  kpiLbl: { fontSize: 11, color: "var(--mut)", whiteSpace: "nowrap" },
  buzonColsWrap: { overflowX: "auto", paddingBottom: 4 },
  buzonCols: { display: "grid", gap: 14 },
  buzonColHd: { position: "sticky", top: 0, zIndex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, paddingBottom: 8, marginBottom: 8, borderBottom: "1px solid var(--bd)", background: "var(--card)" },
  buzonColNombre: { fontSize: 12.5, fontWeight: 700, color: "var(--titulo)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textTransform: "lowercase" },
  buzonColCount: { fontSize: 10.5, color: "var(--mut)", background: "var(--card2)", border: "1px solid var(--bd)", borderRadius: 999, padding: "1px 8px", flexShrink: 0 },
  buzonColBody: { maxHeight: 640, overflowY: "auto", paddingRight: 2 },
  diaSep: { display: "flex", alignItems: "center", gap: 10, margin: "14px 0 8px", color: "var(--mut)", fontSize: 11, textTransform: "uppercase", letterSpacing: ".06em" },
  diaSepLine: { flex: 1, height: 1, background: "var(--bd)" },
  mailRow: { position: "relative", display: "flex", flexDirection: "column", gap: 6, background: "var(--card2)", border: "1px solid var(--bd)", borderRadius: 10, padding: "10px 12px", marginBottom: 6, cursor: "pointer" },
  mailTop: { display: "flex", gap: 10, alignItems: "flex-start" },
  mailDot: { width: 8, height: 8, borderRadius: "50%", flexShrink: 0, marginTop: 6 },
  mailMain: { minWidth: 0, flex: 1 },
  mailLinea1: { display: "flex", alignItems: "baseline", gap: 8, minWidth: 0, flexWrap: "wrap" },
  mailRemitente: { fontWeight: 700, fontSize: 13, color: "var(--titulo)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "50%" },
  mailBuzonChip: { fontSize: 10, color: "var(--mut)", background: "var(--card2)", border: "1px solid var(--bd)", borderRadius: 5, padding: "1px 6px", whiteSpace: "nowrap", flexShrink: 0 },
  mailFecha: { marginLeft: "auto", paddingLeft: 8, fontSize: 11, color: "var(--mut)", whiteSpace: "nowrap", flexShrink: 0, textAlign: "right" },
  mailAsunto: { fontSize: 12.5, color: "var(--tx)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  mailResumen: { fontSize: 11.5, color: "var(--mut)", marginTop: 2, display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden", lineHeight: 1.4 },
  mailAdjuntos: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 },
  mailVinc: { display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginTop: 8 },
  mailAcciones: { display: "flex", gap: 6, alignItems: "center", flexShrink: 0, flexWrap: "wrap" },
  mailBtn: { background: "var(--card2)", border: "1px solid var(--bd)", color: "var(--tx)", borderRadius: 7, padding: "5px 9px", fontSize: 11.5, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, lineHeight: 1, flexShrink: 0, whiteSpace: "nowrap" },
  mailBtnAcc: { borderColor: "var(--acc)", color: "var(--acc)" },
};
const estBorde = { nuevo: "var(--navy)", vinculado: "#15803D", respondido: "#6D28D9" };

// "📧 Bandeja": correos sincronizados de los buzones (ELSE/OSINERGMIN). El Gerente/Coordinador
// ve todos los buzones (con selector); el resto ve lo que el backend ya le filtró.
// Barra de filtros (client-side, sobre la lista ya cargada): texto libre, rango de fechas y estado.
// Acciones por correo: vincular a un expediente existente o convertir en caso nuevo (abre NuevoCaso).
export default function Bandeja({ perfil, correos, cargando, noDisponible, onRecargar, existentes = [], onConvertir, verExpediente = () => {} }){
  const [buzon, setBuzon] = useState("Todos");
  const [q, setQ] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("Todos");
  const verTodo = puedeVerTodo(perfil?.rol);
  const [w, setW] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
  useEffect(() => { const f = () => setW(window.innerWidth); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); }, []);
  const colsBuzon = w < 980 ? 1 : 2;

  // Dedup al cargar: por id único, y si ids distintos pero (buzon+de+asunto+fecha) coinciden, deja uno solo.
  const correosLimpios = useMemo(() => dedupCorreos_(correos), [correos]);

  const buzones = useMemo(() => {
    const set = new Set((correosLimpios || []).map(c => c.buzon).filter(Boolean));
    return ["Todos", ...Array.from(set).sort()];
  }, [correosLimpios]);

  const porBuzon = useMemo(() => {
    if (!verTodo || buzon === "Todos") return correosLimpios || [];
    return (correosLimpios || []).filter(c => c.buzon === buzon);
  }, [correosLimpios, buzon, verTodo]);

  const filtrados = useMemo(() => {
    const texto = q.trim().toLowerCase();
    const dDesde = desde ? new Date(desde + "T00:00:00") : null;
    const dHasta = hasta ? new Date(hasta + "T23:59:59") : null;
    const lista = (porBuzon || []).filter(c => {
      if (estadoFiltro !== "Todos") {
        // Mismo criterio que el badge de CorreoRow: respondido > vinculado (estado o reclamo_vinculado) > nuevo.
        const estado = c.estado === "respondido"
          ? "respondido"
          : (c.estado === "vinculado" || c.reclamo_vinculado) ? "vinculado" : "nuevo";
        if (estado !== estadoFiltro) return false;
      }
      if (texto) {
        const haystack = [c.de, c.asunto, c.resumen].filter(Boolean).join(" ").toLowerCase();
        if (!haystack.includes(texto)) return false;
      }
      if (dDesde || dHasta) {
        const f = parseFechaCorreo_(c.fecha);
        if (!f) return false; // sin fecha parseable: no pasa un filtro de rango activo
        if (dDesde && f < dDesde) return false;
        if (dHasta && f > dHasta) return false;
      }
      return true;
    });
    return ordenarDesc_(lista); // más nuevo arriba, siempre
  }, [porBuzon, q, desde, hasta, estadoFiltro]);

  const agrupado = useMemo(() => {
    if (!verTodo || buzon !== "Todos") return null;
    const g = {};
    (filtrados || []).forEach(c => { const k = c.buzon || "Sin buzón"; (g[k] = g[k] || []).push(c); });
    // cada columna ya hereda el orden desc de `filtrados`, pero se re-ordena por si acaso
    Object.keys(g).forEach(k => { g[k] = ordenarDesc_(g[k]); });
    return g;
  }, [filtrados, buzon, verTodo]);

  const hayFiltrosActivos = !!(q.trim() || desde || hasta || estadoFiltro !== "Todos");

  // KPIs de la cabecera: se calculan sobre `porBuzon` (ya filtrado por buzón, pero ANTES del
  // filtro de estado/texto/fecha) para que los chips reflejen el universo real del buzón elegido
  // y no colapsen a 0 cuando el usuario ya tiene un filtro de estado activo.
  // "Sin caso" = mismo criterio de estado "nuevo" que ya usa el badge de cada fila y el <select>
  // de estado (ni vinculado ni respondido): es el trabajo pendiente real por atender.
  const kpis = useMemo(() => {
    const lista = porBuzon || [];
    let sinCaso = 0, vinculados = 0, respondidos = 0;
    lista.forEach(c => {
      const esVinculado = c.estado === "vinculado" || !!c.reclamo_vinculado;
      const esRespondido = c.estado === "respondido";
      if (esRespondido) respondidos++;
      else if (esVinculado) vinculados++;
      else sinCaso++;
    });
    return { total: lista.length, sinCaso, vinculados, respondidos };
  }, [porBuzon]);

  // Clic en un chip: alterna el filtro de estado existente (mismo <select> de arriba) — clic de
  // nuevo sobre el chip activo lo desactiva (vuelve a "Todos").
  function toggleEstado_(valor){
    setEstadoFiltro(prev => prev === valor ? "Todos" : valor);
  }

  if (noDisponible) {
    return <Card>
      <h3>📧 Bandeja de correos</h3>
      <div className="note" style={{ background: "rgba(30,58,95,.08)", border: "1px solid var(--navy)", color: "var(--tx)" }}>
        La sincronización de correos se activa tras el próximo redeploy. Esta pestaña quedará lista automáticamente en cuanto el backend responda <code>action=correos</code>.
      </div>
    </Card>;
  }

  return <>
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <h3 style={{ margin: 0 }}>📧 Bandeja de correos {correosLimpios ? `(${correosLimpios.length})` : ""}</h3>
          <span style={{ fontSize: 12, color: "var(--tx)" }}>Mostrando {filtrados.length} de {porBuzon.length}</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {verTodo && buzones.length > 1 && (
            <select className="flt" value={buzon} onChange={e => setBuzon(e.target.value)}>
              {buzones.map(b => <option key={b} value={b}>{b === "Todos" ? "Todos los buzones" : b}</option>)}
            </select>
          )}
          <button className="btn-ghost" onClick={onRecargar} title="Recargar correos">↻ Recargar</button>
        </div>
      </div>

      <div style={S.kpiRow}>
        <button
          style={{ ...S.kpiChip, ...(estadoFiltro === "Todos" ? S.kpiChipActiva : {}), cursor: "default" }}
          onClick={() => setEstadoFiltro("Todos")}
          title="Ver todos los correos del buzón seleccionado"
        >
          <span style={S.kpiNum}>{kpis.total}</span>
          <span style={S.kpiLbl}>📥 Total</span>
        </button>
        <button
          style={{
            ...S.kpiChip,
            ...(estadoFiltro === "nuevo" ? S.kpiChipActiva : {}),
            borderColor: estadoFiltro === "nuevo" ? "var(--acc)" : (kpis.sinCaso > 10 ? "var(--acc)" : "#B45309"),
            background: kpis.sinCaso > 10 ? "rgba(227,0,27,.08)" : "rgba(180,83,9,.08)",
          }}
          onClick={() => toggleEstado_("nuevo")}
          title="Correos sin expediente vinculado y sin responder — trabajo pendiente real"
        >
          <span style={{ ...S.kpiNum, color: kpis.sinCaso > 10 ? "var(--acc)" : "#B45309" }}>{kpis.sinCaso}</span>
          <span style={{ ...S.kpiLbl, color: kpis.sinCaso > 10 ? "var(--acc)" : "#B45309", fontWeight: 700 }}>⚠ Sin caso</span>
        </button>
        <button
          style={{ ...S.kpiChip, ...(estadoFiltro === "vinculado" ? S.kpiChipActiva : {}) }}
          onClick={() => toggleEstado_("vinculado")}
          title="Correos ya vinculados a un expediente existente"
        >
          <span style={{ ...S.kpiNum, color: "var(--navy)" }}>{kpis.vinculados}</span>
          <span style={S.kpiLbl}>🔗 Vinculados</span>
        </button>
        <button
          style={{ ...S.kpiChip, ...(estadoFiltro === "respondido" ? S.kpiChipActiva : {}) }}
          onClick={() => toggleEstado_("respondido")}
          title="Correos ya respondidos desde el buzón TELCOM"
        >
          <span style={{ ...S.kpiNum, color: "#15803D" }}>{kpis.respondidos}</span>
          <span style={S.kpiLbl}>↩ Respondidos</span>
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>
        <input className="flt" type="text" placeholder="🔎 Buscar remitente / asunto / resumen…" value={q} onChange={e => setQ(e.target.value)} style={{ minWidth: 240, flex: "1 1 240px" }}/>
        <label className="muted" style={{ fontSize: 11.5, display: "flex", alignItems: "center", gap: 4 }}>
          Desde <input className="flt" type="date" value={desde} onChange={e => setDesde(e.target.value)} />
        </label>
        <label className="muted" style={{ fontSize: 11.5, display: "flex", alignItems: "center", gap: 4 }}>
          Hasta <input className="flt" type="date" value={hasta} onChange={e => setHasta(e.target.value)} />
        </label>
        <select className="flt" value={estadoFiltro} onChange={e => setEstadoFiltro(e.target.value)}>
          {ESTADOS_FILTRO.map(e => <option key={e} value={e}>{e === "Todos" ? "Todos los estados" : e}</option>)}
        </select>
        {hayFiltrosActivos && (
          <button className="btn-ghost sm" onClick={() => { setQ(""); setDesde(""); setHasta(""); setEstadoFiltro("Todos"); }}>✕ limpiar filtros</button>
        )}
      </div>

      {cargando && <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>Cargando correos…</div>}
      {!cargando && !(correosLimpios || []).length && <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>Sin correos por ahora.</div>}
    </Card>

    {/* Gerente/Coordinador con "Todos": vista paralela agrupada por buzón */}
    {agrupado
      ? <div style={{ ...S.buzonColsWrap, marginTop: 14 }}>
          <div style={{ ...S.buzonCols, gridTemplateColumns: `repeat(${Math.max(colsBuzon, Object.keys(agrupado).length)},minmax(340px,1fr))` }}>
            {Object.entries(agrupado).map(([bz, items]) => {
              const sinCasoCol = items.filter(c => !(c.estado === "vinculado" || c.reclamo_vinculado) && c.estado !== "respondido").length;
              return (
                <Card key={bz} style={{ padding: 12, minWidth: 340 }}>
                  <div style={S.buzonColHd}>
                    <span style={S.buzonColNombre} title={bz}>{(bz.split("@")[0] || bz)}</span>
                    <span style={{ ...S.buzonColCount, ...(sinCasoCol > 0 ? { color: "#B45309", borderColor: "#B45309", background: "rgba(180,83,9,.08)" } : {}) }} title={sinCasoCol > 0 ? `${sinCasoCol} sin caso` : "Sin pendientes"}>
                      {items.length}{sinCasoCol > 0 ? ` · ⚠${sinCasoCol}` : ""}
                    </span>
                  </div>
                  <div style={S.buzonColBody}>
                    <ListaCorreos items={items} existentes={existentes} onConvertir={onConvertir} verExpediente={verExpediente} separadores={false} compacto />
                    {!items.length && <div className="muted" style={{ fontSize: 12 }}>Sin correos.</div>}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      : <div style={{ marginTop: 14 }}>
          <Card>
            <ListaCorreos items={filtrados} existentes={existentes} onConvertir={onConvertir} verExpediente={verExpediente} separadores={true} />
            {!filtrados.length && !cargando && <div className="muted" style={{ fontSize: 12 }}>Sin correos que coincidan con los filtros.</div>}
          </Card>
        </div>}
  </>;
}

// Lista de correos ya ordenada desc. Opcionalmente inserta separadores de día ("— Hoy —", "— Ayer —").
function ListaCorreos({ items, existentes, onConvertir, verExpediente, separadores, compacto }){
  let diaAnterior = null;
  return items.map(c => {
    const dia = separadores ? claveDia_(c.fecha) : null;
    const mostrarSeparador = separadores && dia !== diaAnterior;
    if (separadores) diaAnterior = dia;
    return (
      <FragmentoConSeparador key={c.id} mostrarSeparador={mostrarSeparador} dia={dia}>
        <CorreoRow correo={c} existentes={existentes} onConvertir={onConvertir} verExpediente={verExpediente} compacto={compacto} />
      </FragmentoConSeparador>
    );
  });
}

function FragmentoConSeparador({ mostrarSeparador, dia, children }){
  return <>
    {mostrarSeparador && <div style={S.diaSep}><span style={S.diaSepLine} /><span>{dia}</span><span style={S.diaSepLine} /></div>}
    {children}
  </>;
}

function CorreoRow({ correo, existentes, onConvertir, verExpediente = () => {}, compacto }){
  const [abrirVinc, setAbrirVinc] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [busy, setBusy] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [respondido, setRespondido] = useState(false);
  const [hover, setHover] = useState(false);
  const vinculado = correo.estado === "vinculado" || !!correo.reclamo_vinculado;

  let adjuntos = [];
  try { adjuntos = typeof correo.adjuntos_json === "string" ? JSON.parse(correo.adjuntos_json) : (correo.adjuntos_json || []); } catch (e) { adjuntos = []; }
  adjuntos = soloAdjuntosDeTrabajo_(adjuntos);

  async function vincular(){
    if (!codigo.trim()) { toast("Indica el código/OSINERG del expediente"); return; }
    setBusy(true);
    const r = await vincularCorreo(correo.id, codigo.trim());
    setBusy(false);
    if (r?.ok) { toast("Correo vinculado a " + codigo.trim()); setAbrirVinc(false); }
    else toast("No se pudo vincular: " + (r?.error || ""));
  }

  const estado = respondido ? "respondido" : vinculado ? "vinculado" : "nuevo";
  const estadoInfo = {
    respondido: { color: "#6D28D9", txt: "Respondido" },
    vinculado: { color: "#15803D", txt: "Vinculado" + (correo.reclamo_vinculado ? ` · exp. ${correo.reclamo_vinculado}` : "") },
    nuevo: { color: "var(--navy)", txt: "Nuevo" },
  }[estado];

  const remitente = nombreRemitente_(correo.de);

  return (
    <>
      <div
        style={{ ...S.mailRow, padding: compacto ? "8px 9px" : "10px 12px", borderLeft: `3px solid ${estBorde[estado]}`, background: hover ? "var(--hoverBg)" : "var(--card2)" }}
        onClick={() => setAbierto(true)}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        <div style={S.mailTop}>
          <div style={{ ...S.mailDot, background: estadoInfo.color }} title={estadoInfo.txt} />

          <div style={S.mailMain}>
            <div style={S.mailLinea1}>
              <span style={{ ...S.mailRemitente, maxWidth: compacto ? "40%" : "50%" }} title={correo.de || "—"}>{remitente}</span>
              {correo.buzon && <span style={S.mailBuzonChip} title={correo.buzon}>{correo.buzon.split("@")[0]}</span>}
              <span style={S.mailFecha}>{fechaHumana_(correo.fecha)}</span>
            </div>
            <div style={S.mailAsunto} title={correo.asunto || "(sin asunto)"}>{correo.asunto || "(sin asunto)"}</div>
            {correo.resumen && <div style={{ ...S.mailResumen, WebkitLineClamp: 1 }} title={correo.resumen}>{correo.resumen}</div>}
          </div>

          <div style={S.mailAcciones} onClick={e => e.stopPropagation()}>
            <button style={S.mailBtn} onClick={() => setAbierto(true)} title="Abrir el correo completo">👁 Abrir</button>
            {!vinculado && (
              <button style={S.mailBtn} onClick={() => setAbrirVinc(v => !v)} title="Vincular este correo a un expediente ya existente">🔗 Vincular</button>
            )}
            {vinculado && correo.reclamo_vinculado && (
              <button className="btn-ghost sm" onClick={() => verExpediente(correo.reclamo_vinculado)} title="Abrir la Sala del expediente vinculado">📂 Ver expediente</button>
            )}
            <button style={{ ...S.mailBtn, ...S.mailBtnAcc }} onClick={() => onConvertir?.(correo)} title="Crear un expediente nuevo a partir de este correo">➕ Caso nuevo</button>
          </div>
        </div>

        {!!adjuntos.length && (
          <div style={S.mailAdjuntos} onClick={e => e.stopPropagation()}>
            {adjuntos.map((a, i) => (
              adjuntoNoDescargado_(a)
                ? <span key={i} style={{ fontSize: 10.5, color: "#B45309" }}>
                    ⚠ {a.nombre || "adjunto"} (no descargado — {" "}
                    <a href={WEBMAIL_URL} target="_blank" rel="noreferrer"
                      title="Abrir webmail de Hostinger (inicia sesión con tu buzón TELCOM)"
                      style={{ color: "#B45309", textDecoration: "underline" }}>
                      ábrelo en el webmail
                    </a>)
                  </span>
                : <a key={i} className="link" href={a.url} target="_blank" rel="noreferrer" style={{ fontSize: 10.5 }}>{iconoAdjunto_(a)} {a.nombre || "adjunto"}</a>
            ))}
          </div>
        )}

        {abrirVinc && (
          <div style={S.mailVinc} onClick={e => e.stopPropagation()}>
            <input className="flt" list={"exp-" + correo.id} placeholder="Código / N° OSINERG" value={codigo} onChange={e => setCodigo(e.target.value)} style={{ minWidth: 180 }} autoFocus/>
            <datalist id={"exp-" + correo.id}>
              {existentes.slice(0, 300).map(x => <option key={x.id} value={x.osinerg || x.codigo}>{x.solicitante}</option>)}
            </datalist>
            <button className="btn sm" onClick={vincular} disabled={busy}>{busy ? "Vinculando…" : "Confirmar"}</button>
            <button className="btn-ghost sm" onClick={() => setAbrirVinc(false)}>cancelar</button>
          </div>
        )}
      </div>

      {abierto && <CorreoModal correo={correo} verExpediente={verExpediente} onClose={() => setAbierto(false)} onRespondido={() => setRespondido(true)} />}
    </>
  );
}

// Vista traducida de un adjunto .eml (correo reenviado como archivo): cabecera limpia (Asunto en
// bold; De/Para/Fecha en líneas grises) + cuerpo en iframe sandbox (html) o <pre> (text). Cachea
// por (idCorreo, nombre) para no repetir la llamada si el usuario vuelve a seleccionar el mismo
// adjunto. Si el backend falla, cae a la nota simple con link a Drive (nunca deja la vista rota).
const CACHE_EML_ = new Map();
function VistaCorreoEml({ idCorreo, nombre, url, alto }){
  const clave = idCorreo + "||" + nombre;
  const [estado, setEstado] = useState(() => CACHE_EML_.get(clave) ? "listo" : "cargando");
  const [detalle, setDetalle] = useState(() => CACHE_EML_.get(clave) || null);

  useEffect(() => {
    let vivo = true;
    const cache = CACHE_EML_.get(clave);
    if (cache) { setDetalle(cache); setEstado("listo"); return; }
    setEstado("cargando"); setDetalle(null);
    (async () => {
      const r = await verEml(idCorreo, nombre);
      if (!vivo) return;
      if (r && r.ok) { CACHE_EML_.set(clave, r); setDetalle(r); setEstado("listo"); }
      else setEstado("error");
    })();
    return () => { vivo = false; };
  }, [clave, idCorreo, nombre]);

  if (estado === "cargando") {
    return <div style={{ textAlign: "center", color: "var(--tx)", padding: 20, fontSize: 12.5 }}>
      <span style={{ display: "inline-block", width: 16, height: 16, border: "2px solid var(--bd)", borderTopColor: "var(--navy)", borderRadius: "50%", animation: "girar .8s linear infinite", verticalAlign: "middle" }}/>
      <div style={{ marginTop: 8 }}>Traduciendo correo adjunto…</div>
    </div>;
  }

  if (estado === "error") {
    return <div style={{ textAlign: "center", color: "var(--tx)", padding: 20, fontSize: 12 }}>
      <div style={{ fontSize: 32 }}>📧</div>
      <div style={{ marginTop: 8, lineHeight: 1.5 }}>No se pudo traducir este correo adjunto. Ábrelo en Drive para verlo completo.</div>
      {url && <a className="link" style={{ fontSize: 11.5, marginTop: 6, display: "inline-block" }} href={url} target="_blank" rel="noreferrer">🔗 abrir en Drive ↗</a>}
    </div>;
  }

  return <div style={{ width: "100%", height: "100%", overflowY: "auto", background: "#fff", color: "#111827", display: "flex", flexDirection: "column" }}>
    <div style={{ padding: "10px 12px", borderBottom: "1px solid #e2e8f0", flexShrink: 0 }}>
      <div style={{ fontWeight: 700, fontSize: 13, color: "#111827" }}>✉ {detalle.asunto || "(sin asunto)"}</div>
      <div style={{ fontSize: 11.5, color: "#6b7280", marginTop: 4, lineHeight: 1.5 }}>
        <div>De: {detalle.de || "—"}</div>
        <div>Para: {detalle.para || "—"}{detalle.cc ? ` · Cc: ${detalle.cc}` : ""}</div>
        <div>Fecha: {detalle.fecha || "—"}</div>
      </div>
    </div>
    <div style={{ flex: 1, minHeight: 0 }}>
      {detalle.html
        ? <iframe title="cuerpo-eml" srcDoc={detalle.html} sandbox="" style={{ width: "100%", height: alto || "100%", minHeight: alto ? undefined : 200, border: 0, background: "#fff" }} />
        : <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0, padding: 14, fontFamily: "inherit", fontSize: 12.5, color: "#111827" }}>{detalle.text || "(sin contenido)"}</pre>}
    </div>
  </div>;
}

// Modal de lectura completa del correo: carga el cuerpo (html/text) vía correo_completo y permite
// responder desde el buzón TELCOM. Si el backend aún no implementa el endpoint, avisa sin romper.
// Incluye panel lateral de previsualización de adjuntos (2 columnas en desktop, apilado en móvil).
function CorreoModal({ correo, verExpediente = () => {}, onClose, onRespondido }){
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
          <div className="note" style={{ background: "rgba(30,58,95,.08)", border: "1px solid var(--navy)", color: "var(--tx)" }}>
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
                      color: i === adjSel ? "#fff" : (adjuntoNoDescargado_(a) ? "#B45309" : "var(--tx)"), border: `1px solid ${i === adjSel ? "var(--navy)" : "var(--bd)"}`,
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
                      ? <div style={{ textAlign: "center", color: "#B45309", padding: 20 }}>
                        <div style={{ fontSize: 32 }}>⚠</div>
                        <div style={{ fontSize: 12.5, marginTop: 6, fontWeight: 600 }}>{adjActivo.nombre || "adjunto"}</div>
                        <div style={{ fontSize: 11.5, marginTop: 4, color: "var(--tx)" }}>
                          No se pudo descargar automáticamente ({motivoAdjuntoNoDescargado_(adjActivo)}). Sin vista previa — {" "}
                          <a href={WEBMAIL_URL} target="_blank" rel="noreferrer"
                            title="Abrir webmail de Hostinger (inicia sesión con tu buzón TELCOM)"
                            style={{ color: "#B45309", textDecoration: "underline" }}>
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
        {iaAnalisis && <div style={{ marginTop: 8, background: "rgba(109,40,217,.08)", border: "1px solid #6D28D9", borderRadius: 8, padding: "10px 12px", fontSize: 12.5, color: "var(--tx)", whiteSpace: "pre-wrap", lineHeight: 1.5, flexShrink: 0 }}>
          <b style={{ color: "#6D28D9" }}>🤖 Análisis IA del correo:</b><br />{iaAnalisis}</div>}

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
