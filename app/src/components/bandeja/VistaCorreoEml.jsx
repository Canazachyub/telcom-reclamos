import { useState, useEffect } from "react";
import { verEml } from "../../lib/api.js";

// Vista traducida de un adjunto .eml (correo reenviado como archivo): cabecera limpia (Asunto en
// bold; De/Para/Fecha en líneas grises) + cuerpo en iframe sandbox (html) o <pre> (text). Cachea
// por (idCorreo, nombre) para no repetir la llamada si el usuario vuelve a seleccionar el mismo
// adjunto. Si el backend falla, cae a la nota simple con link a Drive (nunca deja la vista rota).
const CACHE_EML_ = new Map();
export function VistaCorreoEml({ idCorreo, nombre, url, alto }){
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
