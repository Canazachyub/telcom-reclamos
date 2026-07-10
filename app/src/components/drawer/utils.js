// Helpers y estilos puros del Drawer (Drawer.jsx). Extraído tal cual, sin cambios de lógica.

export const humaniza = k => String(k).replace(/_/g, " ").toLowerCase().replace(/^\w/, c => c.toUpperCase());
// URL de previsualización embebible de un archivo de Drive.
export function previewUrl(url) {
  const m = String(url || "").match(/\/d\/([^/]+)/) || String(url || "").match(/[?&]id=([^&]+)/);
  return m ? `https://drive.google.com/file/d/${m[1]}/preview` : url;
}
export const esImg = n => /\.(jpg|jpeg|png|gif|webp)$/i.test(String(n || ""));

// Mismo mapa de iconos por etapa que SalaExpediente (copiado como constante local — no se importa
// porque SalaExpediente no lo exporta, solo exporta fmtCuando/humanizarRegistro).
export const ICONO_ETAPA = { "Recepción": "📥", "Evaluación": "🔍", "Campo": "🚙", "SIELSE": "💻", "Resolución": "⚖️", "Firmas": "✍️", "Notificación": "📨", "Apelación (JARU)": "🏛️", "Foliado": "📚", "Cierre": "✅" };

// fecha ISO ("2026-03-31T05:00:00.000Z") -> "31/03/2026"; el resto se muestra tal cual (mismo
// patrón fmtValor de FichaSielse.jsx, duplicado aquí porque no se exporta desde allá).
const ISO_RE = /^\d{4}-\d{2}-\d{2}T/;
export function fmtValor(v) {
  if (v == null || v === "") return v;
  const s = String(v);
  if (ISO_RE.test(s)) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      const dd = String(d.getUTCDate()).padStart(2, "0");
      const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
      const yy = d.getUTCFullYear();
      return `${dd}/${mm}/${yy}`;
    }
  }
  return s;
}

export const wrap = { width: "96vw", maxWidth: 1500, height: "92vh", background: "var(--bg)", border: "1px solid var(--bd)", borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "var(--shadow-modal)" };
export const cols = { flex: 1, display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr", overflow: "hidden" };
export const col = { padding: 14, overflowY: "auto" };
export const chip = { background: "var(--card2)", color: "var(--tx)", border: "1px solid var(--bd)", borderRadius: 7, padding: "4px 8px", fontSize: 11, cursor: "pointer" };
export const chipOn = { background: "var(--acc)", color: "#fff", borderColor: "var(--accHover)" };
