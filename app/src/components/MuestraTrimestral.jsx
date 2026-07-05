import { useState } from "react";
import { toast } from "./ui.jsx";
import { postAction } from "../lib/api.js";
import { ETAPAS, fmtFecha } from "../lib/model.js";

// ===================== Muestra Trimestral OSINERGMIN (ACT-04) =====================
// OSINERGMIN pide trimestralmente una muestra de expedientes; ELSE la traslada a TELCOM.
// Penalidad 5.11: S/2,000 por muestra incumplida. Hay que: revisar/ordenar/foliar cada
// expediente (sin importar su etapa), elaborar un "Informe de estado de reclamo" por
// expediente, nombrar los archivos "N°ITEM.suministro" (ej. "1.10010430330.pdf"), incluir
// audios de reclamos telefónicos con igual nomenclatura, y entregar por USB o Drive.

function copiar(txt, etiqueta) {
  try { navigator.clipboard.writeText(String(txt)); toast("Copiado: " + (etiqueta || txt)); }
  catch (e) { toast("No se pudo copiar"); }
}

function detalleObj(r) {
  try { const d = typeof r.detalle === "string" ? JSON.parse(r.detalle) : (r.detalle || {}); return d && typeof d === "object" ? d : {}; }
  catch (e) { return {}; }
}

// etapa actual del caso: deriva del ticket activo (no-hecho) en orden de flujo; si no hay
// tickets del caso, cae al respaldo v1 (x.etapa)
function etapaActualDe(codigo, tickets, fallback) {
  const propios = (tickets || []).filter(t => String(t.reclamo) === String(codigo))
    .sort((a, b) => ETAPAS.indexOf(a.etapa) - ETAPAS.indexOf(b.etapa));
  if (!propios.length) return fallback || "—";
  const act = propios.find(t => !t.hecho);
  return act ? act.etapa : "Cierre";
}

function nombreArchivo(item, suministro) {
  return item + "." + (suministro || "SINSUM") + ".pdf";
}

// ===== Modal: Informe de estado de reclamo (imprimible) =====
function ModalInforme({ item, exp, etapa, evidenciasCaso, onClose }) {
  const fechaHoy = new Date().toLocaleDateString("es-PE");
  const nombreArch = nombreArchivo(item, exp.suministro);
  const texto = [
    "INFORME DE ESTADO DE RECLAMO — MUESTRA TRIMESTRAL OSINERGMIN",
    "Ítem de muestra: " + item,
    "Archivo: " + nombreArch,
    "",
    "Código de reclamo: " + (exp.codigo || "—"),
    "Nº OSINERGMIN: " + (exp.osinerg || "—"),
    "Solicitante: " + (exp.solicitante || "—"),
    "Suministro: " + (exp.suministro || "—"),
    "Materia: " + ((exp.clase || "—").replace("RECLAMOS ", "")),
    "Etapa actual: " + etapa,
    "Estado: " + (exp.estado || "—"),
    "",
    "Fecha de registro: " + fmtFecha(exp.fechaReg),
    "Fecha de admisión: " + fmtFecha(exp.fechaAdm),
    "Fecha límite de atención: " + fmtFecha(exp.fechaLim),
    "Fecha de solución: " + fmtFecha(exp.fechaSol),
    "",
    "Documentos del expediente (" + evidenciasCaso.length + "):",
    ...(evidenciasCaso.length ? evidenciasCaso.map((d, i) => "  " + (i + 1) + ". " + (d.nombre || "documento") + (d.etapa ? " — " + d.etapa : "")) : ["  (sin documentos subidos registrados en la plataforma)"]),
    "",
    "Expediente foliado y digitalizado conforme a bases.",
  ].join("\n");

  function imprimir() {
    const w = window.open("", "_blank", "width=800,height=900");
    if (!w) { toast("El navegador bloqueó la ventana de impresión"); return; }
    w.document.write(
      "<html><head><title>Informe " + nombreArch + "</title>" +
      "<style>body{font-family:ui-monospace,Consolas,monospace;font-size:13px;white-space:pre-wrap;padding:28px;color:#16294B}h1{font-size:15px}</style>" +
      "</head><body>" + texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\n/g, "<br/>") + "</body></html>"
    );
    w.document.close();
    w.focus();
    setTimeout(() => { try { w.print(); } catch (e) {} }, 250);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(22,41,75,.45)", zIndex: 120, display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "4vh 12px", overflowY: "auto" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ width: "min(640px,100%)", background: "var(--bg)", border: "1px solid var(--bd)", borderRadius: 16, padding: 18, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 24px 70px rgba(22,41,75,.28)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <h3 style={{ margin: 0, fontSize: 15.5, color: "var(--titulo)" }}>📋 Informe de estado de reclamo</h3>
          <button className="btn-ghost" onClick={onClose}>✕ Cerrar</button>
        </div>
        <div style={{ background: "var(--card)", border: "1px solid var(--bd)", borderRadius: 12, padding: 14, fontFamily: "ui-monospace,Consolas,monospace", fontSize: 12, color: "var(--tx)", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
          {texto}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <button className="btn sec" onClick={() => copiar(texto, "informe")}>Copiar texto</button>
          <button className="btn" onClick={imprimir}>🖨 Imprimir</button>
        </div>
      </div>
    </div>
  );
}

export default function MuestraTrimestral({ data, tickets, evidencias, registros, perfil, setSelExp }) {
  const [q, setQ] = useState("");
  const [selCods, setSelCods] = useState([]); // orden de selección = orden del ITEM
  const [modalItem, setModalItem] = useState(null); // {item, exp}
  const [linkEntrega, setLinkEntrega] = useState("");
  const [audiosAplica, setAudiosAplica] = useState(false);
  const [audiosOk, setAudiosOk] = useState(false);
  const puedeRegistrar = ["GERENTE", "COORDINADOR"].includes(perfil?.rol);

  const filt = (data || []).filter(x => {
    if (!q) return true;
    const s = q.toLowerCase();
    return `${x.codigo} ${x.osinerg} ${x.solicitante} ${x.suministro}`.toLowerCase().includes(s);
  });

  function toggle(codigo) {
    setSelCods(prev => prev.includes(codigo) ? prev.filter(c => c !== codigo) : [...prev, codigo]);
  }

  const muestra = selCods.map((codigo, i) => {
    const exp = (data || []).find(x => String(x.codigo) === String(codigo));
    return { item: i + 1, codigo, exp };
  }).filter(m => m.exp);

  function evidenciasDe(codigo) {
    return (evidencias || []).filter(e => String(e.exp || "") === String(codigo));
  }
  function foliadoOk(codigo) {
    const evs = evidenciasDe(codigo);
    return evs.some(e => String(e.nombre || "").includes("Expediente_") || String(e.etapa || "").includes("Foliado"));
  }

  const historial = (registros || []).filter(r => {
    if (String(r.tipo) !== "reporte") return false;
    const d = detalleObj(r);
    return !!d.tipo_muestra;
  }).map(r => ({ ...detalleObj(r), fecha: String(r.fecha || "").slice(0, 10), usuario: r.usuario }))
    .sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));

  function registrarEntrega() {
    if (!muestra.length) { toast("Arma la muestra primero (marca al menos un expediente)"); return; }
    const payload = {
      tipo_muestra: "entrega",
      items: muestra.length,
      expedientes: muestra.map(m => m.codigo),
      link: linkEntrega || "",
      fecha_entrega: new Date().toISOString().slice(0, 10),
    };
    postAction("reporte", payload).then(r => {
      if (r && r.ok !== false) toast("Entrega de muestra registrada ✓ (" + muestra.length + " ítems)");
      else toast("⚠ No se guardó: " + ((r && r.error) || "error"));
    });
  }

  const S = {
    sec: { background: "var(--card)", border: "1px solid var(--bd)", borderRadius: 16, padding: 16, marginTop: 14 },
    tit: { margin: "0 0 8px", fontSize: 14, color: "var(--titulo)", fontWeight: 700 },
    th: { fontSize: 10.5, textTransform: "uppercase", color: "var(--mut)" },
    itemCard: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, background: "var(--card2)", border: "1px solid var(--bd)", borderRadius: 12, padding: "10px 12px", marginBottom: 8 },
    badge: { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, borderRadius: "50%", background: "var(--navy)", color: "#fff", fontSize: 12, fontWeight: 700, flexShrink: 0 },
  };

  return (
    <div>
      {/* ===== cabecera ===== */}
      <div style={S.sec}>
        <h3 style={S.tit}>📦 Muestra trimestral OSINERGMIN — ACT-04</h3>
        <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.6 }}>
          OSINERGMIN solicita trimestralmente una muestra de expedientes; ELSE la traslada a TELCOM. Hay que revisar, ordenar y foliar cada expediente elegido (sin importar su etapa), elaborar un <b>Informe de estado de reclamo</b> por cada uno, nombrar los archivos como <b className="mono">N°ITEM.suministro</b> (ej. <span className="mono">1.10010430330.pdf</span>) —incluidos los audios de reclamos telefónicos con igual nomenclatura— y entregarlos por USB o Drive en el plazo que fije ELSE.
        </div>
        <div className="note" style={{ background: "#FDE7E7", border: "1px solid #F3B4B4", color: "#B91C1C", marginTop: 10 }}>
          ⚠ Penalidad 5.11: <b>S/2,000</b> por muestra trimestral incumplida.
        </div>
      </div>

      {/* ===== selección de expedientes ===== */}
      <div style={S.sec}>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8, alignItems: "center", marginBottom: 8 }}>
          <h3 style={{ ...S.tit, margin: 0 }}>Selección de expedientes ({selCods.length} marcado(s))</h3>
          <input className="flt" placeholder="Buscar código / OSINERG / solicitante / suministro" value={q} onChange={e => setQ(e.target.value)} style={{ minWidth: 260 }} />
        </div>
        <div style={{ overflowX: "auto", maxHeight: 360, overflowY: "auto" }}>
          <table className="tbl">
            <thead><tr>
              <th style={S.th}></th><th style={S.th}>Código</th><th style={S.th}>OSINERG</th>
              <th style={S.th}>Solicitante</th><th style={S.th}>Suministro</th><th style={S.th}>Etapa actual</th>
            </tr></thead>
            <tbody>
              {filt.slice(0, 300).map(x => {
                const marcado = selCods.includes(x.codigo);
                const etapa = etapaActualDe(x.codigo, tickets, x.etapa);
                return (
                  <tr key={x.id} style={marcado ? { background: "var(--selBg)" } : null}>
                    <td><input type="checkbox" checked={marcado} onChange={() => toggle(x.codigo)} /></td>
                    <td className="mono">{String(x.codigo).slice(-10)}</td>
                    <td className="mono">{x.osinerg || "—"}</td>
                    <td>{x.solicitante}</td>
                    <td className="mono">{x.suministro}</td>
                    <td>{etapa}</td>
                  </tr>
                );
              })}
              {!filt.length && <tr><td colSpan={6} className="muted" style={{ textAlign: "center", padding: 14 }}>Sin expedientes que coincidan.</td></tr>}
            </tbody>
          </table>
        </div>
        {filt.length > 300 && <div className="muted" style={{ fontSize: 11.5, marginTop: 6 }}>Mostrando 300 de {filt.length} — usa el buscador para acotar.</div>}
      </div>

      {/* ===== muestra armada ===== */}
      <div style={S.sec}>
        <h3 style={S.tit}>Muestra armada ({muestra.length})</h3>
        {!muestra.length && <div className="muted" style={{ fontSize: 12.5 }}>Marca expedientes en la tabla de arriba — el ítem correlativo se asigna en el orden en que los marques.</div>}
        {muestra.map(m => {
          const nombreArch = nombreArchivo(m.item, m.exp.suministro);
          return (
            <div key={m.codigo} style={S.itemCard}>
              <span style={S.badge}>{m.item}</span>
              <div style={{ minWidth: 160 }}>
                <div style={{ fontWeight: 700, color: "var(--titulo)", fontSize: 12.5 }}>{m.exp.solicitante || "—"}</div>
                <div className="muted" style={{ fontSize: 11 }}>{m.exp.osinerg || String(m.exp.codigo).slice(-10)}</div>
              </div>
              <span className="mono" style={{ fontSize: 12.5, background: "var(--card)", border: "1px solid var(--bd)", borderRadius: 8, padding: "4px 9px" }}>{nombreArch}</span>
              <button className="btn-ghost" style={{ fontSize: 11.5 }} onClick={() => copiar(nombreArch, "nombre de archivo")}>📋 copiar nombre</button>
              <button className="btn-ghost" style={{ fontSize: 11.5, marginLeft: "auto" }} onClick={() => setModalItem(m)}>📋 Informe de estado</button>
              {setSelExp && <button className="btn sm" onClick={() => setSelExp(m.exp.id)}>Ver expediente</button>}
            </div>
          );
        })}
      </div>

      {/* ===== checklist de entrega ===== */}
      <div style={S.sec}>
        <h3 style={S.tit}>Checklist de entrega</h3>
        <div style={{ display: "grid", gap: 8 }}>
          {muestra.map(m => {
            const folOk = foliadoOk(m.codigo);
            return (
              <div key={m.codigo} className="chk" style={{ fontSize: 12.5 }}>
                <span style={{ color: folOk ? "#15803D" : "#DC2626", fontWeight: 700 }}>{folOk ? "✓" : "✗"}</span>
                Ítem {m.item} — {m.exp.solicitante || m.codigo}: expediente foliado {folOk ? "detectado" : "no detectado"} <span className="muted">(evidencia con "Expediente_" o etapa Foliado)</span>
              </div>
            );
          })}
          {!muestra.length && <div className="muted" style={{ fontSize: 12 }}>Arma la muestra para ver el checklist por expediente.</div>}
          <label className="chk" style={{ fontSize: 12.5, marginTop: 6 }}>
            <input type="checkbox" checked={audiosAplica} onChange={e => { setAudiosAplica(e.target.checked); if (!e.target.checked) setAudiosOk(false); }} />
            Audios de reclamos telefónicos: aplica en esta muestra
          </label>
          {audiosAplica && (
            <label className="chk" style={{ fontSize: 12.5, paddingLeft: 20 }}>
              <input type="checkbox" checked={audiosOk} onChange={e => setAudiosOk(e.target.checked)} />
              Audios nombrados y anexados con la misma nomenclatura (N°ITEM.suministro)
            </label>
          )}
          <div style={{ marginTop: 6 }}>
            <label style={{ display: "block", fontSize: 11, textTransform: "uppercase", letterSpacing: ".04em", color: "var(--mut)", marginBottom: 5 }}>USB entregado o link de Drive</label>
            <input className="flt" style={{ width: "100%" }} placeholder="Pega el link de Drive (o anota 'USB entregado en mano')" value={linkEntrega} onChange={e => setLinkEntrega(e.target.value)} />
          </div>
        </div>
      </div>

      {/* ===== registrar entrega ===== */}
      <div style={S.sec}>
        <h3 style={S.tit}>Registrar entrega de la muestra</h3>
        {puedeRegistrar ? (
          <>
            <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>Guarda la evidencia de que la muestra ({muestra.length} ítems) fue entregada a ELSE, con fecha y link/USB.</div>
            <button className="btn" onClick={registrarEntrega} disabled={!muestra.length}>Registrar entrega de la muestra</button>
          </>
        ) : (
          <div className="muted" style={{ fontSize: 12 }}>Solo Gerencia/Coordinación puede registrar la entrega formal.</div>
        )}

        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--titulo)", marginBottom: 6 }}>Historial de entregas</div>
          <div style={{ overflowX: "auto" }}>
            <table className="tbl">
              <thead><tr><th style={S.th}>Fecha</th><th style={S.th}>Ítems</th><th style={S.th}>Link / USB</th></tr></thead>
              <tbody>
                {historial.map((h, i) => (
                  <tr key={i}>
                    <td>{h.fecha_entrega || h.fecha || "—"}</td>
                    <td>{h.items ?? "—"}</td>
                    <td>{h.link ? <a className="link" href={h.link} target="_blank" rel="noreferrer">{h.link}</a> : <span className="muted">—</span>}</td>
                  </tr>
                ))}
                {!historial.length && <tr><td colSpan={3} className="muted" style={{ textAlign: "center", padding: 12 }}>Sin entregas registradas todavía.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {modalItem && (
        <ModalInforme item={modalItem.item} exp={modalItem.exp} etapa={etapaActualDe(modalItem.codigo, tickets, modalItem.exp.etapa)}
          evidenciasCaso={evidenciasDe(modalItem.codigo)} onClose={() => setModalItem(null)} />
      )}
    </div>
  );
}
