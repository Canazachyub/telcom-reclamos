// ===== QR por SUMINISTRO — genera e imprime hojas de etiquetas =====
// El QR codifica una URL de la app con ?sum=<suministro>. Al escanear (cámara del celular),
// abre la plataforma → login → resuelve el suministro (1 reclamo entra directo · varios elige ·
// ninguno permite crear). Nada sensible en el QR: solo el nº de suministro; el acceso exige login.
import QRCode from "qrcode";

// URL base de la app SIN query (sirve en dev y en GitHub Pages).
const baseURL = () => window.location.origin + window.location.pathname;
export const urlSuministro = sum => baseURL() + "?sum=" + encodeURIComponent(String(sum || "").trim());

// PNG (data-URL) del QR de UN suministro — para mostrarlo o descargarlo.
export async function qrDataURL(sum, size = 240) {
  return QRCode.toDataURL(urlSuministro(sum), { margin: 1, width: size, errorCorrectionLevel: "M" });
}
// Descarga el QR de un suministro como archivo PNG.
export async function descargarQR(sum, nombre) {
  const url = await qrDataURL(sum, 512);
  const a = document.createElement("a");
  a.href = url; a.download = (nombre || ("QR_" + String(sum || "").trim())) + ".png";
  a.click();
}

// items: [{ suministro, reclamante, osinerg, reclamo }]. Deduplica por suministro (1 etiqueta por medidor).
export async function imprimirQRs(items, titulo = "Etiquetas QR") {
  const seen = new Set(), lista = [];
  (items || []).forEach(it => {
    const s = String(it.suministro || "").trim();
    if (!s || seen.has(s)) return;
    seen.add(s); lista.push({ ...it, suministro: s });
  });
  if (!lista.length) { alert("No hay suministros en la vista actual para generar QRs."); return; }
  // genera los data-URL de cada QR (rápido, en memoria; sin red)
  const etq = await Promise.all(lista.map(async it => ({
    ...it,
    img: await QRCode.toDataURL(urlSuministro(it.suministro), { margin: 1, width: 200, errorCorrectionLevel: "M" }),
  })));
  const celda = e => `<div class="lbl">
      <img src="${e.img}"/>
      <div class="sum">${e.suministro}</div>
      <div class="nom">${String(e.reclamante || "").slice(0, 32)}</div>
      <div class="rec">${e.osinerg || e.reclamo || ""}</div>
    </div>`;
  const w = window.open("", "_blank");
  w.document.write(`<html><head><title>${titulo}</title><style>
    @page{margin:7mm}
    *{box-sizing:border-box}
    body{font-family:Arial,Helvetica,sans-serif;margin:0;color:#000}
    h2{margin:6px 8px 2px;font-size:12px}
    .sub{margin:0 8px 6px;font-size:9px;color:#555}
    .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;padding:6px}
    .lbl{border:1px dashed #888;border-radius:6px;padding:6px 4px;text-align:center;page-break-inside:avoid}
    .lbl img{width:100%;max-width:140px;height:auto}
    .sum{font-family:ui-monospace,monospace;font-weight:bold;font-size:11px;margin-top:2px}
    .nom{font-size:8.5px;color:#333;line-height:1.1;min-height:20px}
    .rec{font-size:8px;color:#666}
  </style></head><body>
    <h2>INGENIERIA TELCOM E.I.R.L. · ${titulo}</h2>
    <div class="sub">CP-026-2026-ELSE · ${lista.length} suministro(s) · escanea el QR para documentar el reclamo desde el celular</div>
    <div class="grid">${etq.map(celda).join("")}</div>
  </body></html>`);
  w.document.close();
  setTimeout(() => { try { w.focus(); w.print(); } catch (e) {} }, 350);
}
