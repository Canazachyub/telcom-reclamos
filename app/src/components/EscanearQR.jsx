import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

// 📷 Escáner de QR DENTRO de la app — abre la cámara trasera, detecta el QR del libro y devuelve su
// texto (una URL con ?sum=…). No sale del app. Requiere HTTPS (GitHub Pages ok; dev localhost ok).
export default function EscanearQR({ onDetect, onClose }) {
  const videoRef = useRef();
  const canvasRef = useRef();
  const rafRef = useRef();
  const streamRef = useRef();
  const [error, setError] = useState("");

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (!vivo) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        const v = videoRef.current;
        v.srcObject = stream; v.setAttribute("playsinline", "true"); await v.play();
        tick();
      } catch (e) {
        setError(String(e && e.name === "NotAllowedError"
          ? "Permiso de cámara denegado. Actívalo en el navegador."
          : "No se pudo abrir la cámara (¿otro app la usa? ¿sin HTTPS?)."));
      }
    })();
    function tick() {
      const v = videoRef.current, c = canvasRef.current;
      if (v && c && v.readyState === v.HAVE_ENOUGH_DATA) {
        c.width = v.videoWidth; c.height = v.videoHeight;
        const ctx = c.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(v, 0, 0, c.width, c.height);
        const img = ctx.getImageData(0, 0, c.width, c.height);
        const code = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
        if (code && code.data) { detener(); onDetect(code.data); return; }
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    function detener() {
      cancelAnimationFrame(rafRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    }
    return () => { vivo = false; detener(); };
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000", zIndex: 100, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", color: "#fff" }}>
        <b style={{ fontSize: 15 }}>📷 Escanear QR del reclamo</b>
        <button onClick={onClose} style={{ background: "transparent", border: "1px solid #fff6", color: "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 14, cursor: "pointer" }}>✕ Cerrar</button>
      </div>
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <video ref={videoRef} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted />
        <canvas ref={canvasRef} style={{ display: "none" }} />
        {/* marco guía */}
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
          <div style={{ width: "70vmin", maxWidth: 320, aspectRatio: "1", border: "3px solid #1F4E8C", borderRadius: 16, boxShadow: "0 0 0 9999px rgba(0,0,0,.35)" }} />
        </div>
        {error && <div style={{ position: "absolute", left: 16, right: 16, bottom: 24, background: "#C0392B", color: "#fff", padding: 12, borderRadius: 10, fontSize: 13, textAlign: "center" }}>{error}</div>}
      </div>
      <div style={{ color: "#fff", opacity: .85, textAlign: "center", padding: "12px 16px", fontSize: 13 }}>Apunta al QR pegado en el libro. Se detecta solo.</div>
    </div>
  );
}
