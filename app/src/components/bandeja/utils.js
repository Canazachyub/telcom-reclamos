// Helpers puros de la Bandeja de correos (Bandeja.jsx). Extraído tal cual, sin cambios de lógica.

// Parse tolerante de la fecha del correo: acepta Date, ISO ("2026-07-02T10:00:00.000Z"),
// "yyyy-MM-dd HH:mm:ss" u otro formato reconocible por Date(). Devuelve null si no se puede parsear.
export function parseFechaCorreo_(v){
  if (!v) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

// Convierte cualquier fecha parseable a milisegundos para ordenar desc (más nuevo arriba).
// Sin fecha parseable → va al fondo (no rompe el orden de lo que sí tiene fecha).
export function tsCorreo_(c){
  const f = parseFechaCorreo_(c?.fecha);
  return f ? f.getTime() : -Infinity;
}

export function ordenarDesc_(lista){
  return [...(lista || [])].sort((a, b) => tsCorreo_(b) - tsCorreo_(a));
}

// Quita duplicados: primero por `id` único; luego, si dos correos con id distinto comparten
// (buzon+de+asunto+fecha), se conserva solo uno. Esto cubre el caso de resincronizaciones que
// reinsertan el mismo correo con otro id. Conserva el orden de entrada.
export function dedupCorreos_(lista){
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
export function fechaHumana_(v){
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
export function claveDia_(v){
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
export function nombreRemitente_(de){
  if (!de) return "—";
  const m = String(de).match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (m && m[1].trim()) return m[1].trim();
  if (m && m[2]) return m[2].trim();
  return String(de).trim();
}

// URL de previsualización embebible de un archivo de Drive (mismo patrón que Drawer.jsx).
export function previewUrl_(url) {
  const m = String(url || "").match(/\/d\/([^/]+)/) || String(url || "").match(/[?&]id=([^&]+)/);
  return m ? `https://drive.google.com/file/d/${m[1]}/preview` : url;
}
export const esImg_ = n => /\.(jpg|jpeg|png|gif|webp)$/i.test(String(n || ""));
export const esEml_ = (n, a) => a?.tipo === "eml" || /\.eml$/i.test(String(n || "")) || String(a?.contentType || "").indexOf("message/rfc822") === 0;
export const esPdf_ = (n, a) => a?.tipo === "pdf" || /\.pdf$/i.test(String(n || "")) || a?.contentType === "application/pdf";
export const esHojaCalculo_ = n => /\.(xlsx?|csv)$/i.test(String(n || ""));

// Filtra los adjuntos "de trabajo" para mostrar en listas: oculta los inline:true (logos/firma
// embebidos en el cuerpo). Tolerante con adjuntos viejos que no tengan el campo `inline`.
export const soloAdjuntosDeTrabajo_ = lista => (lista || []).filter(a => !a?.inline);

// Un adjunto quedó SIN descargar si el backend le puso un `estado` distinto de 'ok' (fallo de
// descarga o "muy_grande") y no tiene `url` para abrir. Tolerante con registros viejos que no
// traían el campo `estado` (esos se consideran 'ok' siempre que tengan url).
export const adjuntoNoDescargado_ = a => !!(a?.estado && a.estado !== "ok" && !a?.url);
export function motivoAdjuntoNoDescargado_(a){
  if (a?.estado === "muy_grande") return "muy grande para descargar automáticamente";
  if (a?.estado === "error_descarga") return "falló la descarga";
  return "no descargado";
}

// Ícono + etiqueta amable según tipo de adjunto (usa `tipo`/`contentType` si vienen del backend
// actualizado; si no, cae a heurística por extensión del nombre — tolera adjuntos viejos).
export function iconoAdjunto_(a){
  const nombre = a?.nombre || "";
  if (esEml_(nombre, a)) return "📧";
  if (esImg_(nombre) || a?.tipo === "imagen") return "🖼";
  if (esPdf_(nombre, a)) return "📄";
  if (esHojaCalculo_(nombre)) return "📊";
  return "📎";
}

// Cuerpo del correo en texto plano para mandar a la IA: prioriza `text`; si solo hay `html`,
// le quita etiquetas/entidades básicas (mismo patrón que enviarCorreo/EmailSync.gs en el backend).
export function cuerpoTextoPlano_(detalle) {
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

export const ESTADOS_FILTRO = ["Todos", "nuevo", "vinculado", "respondido"];

// Webmail Hostinger: el trabajador inicia sesión con su buzón @ingeneriatelcom.com para abrir
// adjuntos que el backend no pudo descargar automáticamente (error_descarga / muy_grande).
export const WEBMAIL_URL = "https://mail.hostinger.com";
