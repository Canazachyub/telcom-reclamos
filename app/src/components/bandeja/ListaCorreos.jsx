import { useState } from "react";
import { vincularCorreo } from "../../lib/api.js";
import { toast } from "../ui.jsx";
import { claveDia_, fechaHumana_, nombreRemitente_, soloAdjuntosDeTrabajo_, adjuntoNoDescargado_, iconoAdjunto_ } from "./utils.js";
import { S, estBorde } from "./estilos.js";
import { CorreoModal } from "./CorreoModal.jsx";
import { WEBMAIL_URL } from "./utils.js";

// Lista de correos ya ordenada desc. Opcionalmente inserta separadores de día ("— Hoy —", "— Ayer —").
export function ListaCorreos({ items, existentes, onConvertir, verExpediente, separadores, compacto }){
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
    respondido: { color: "var(--purple)", txt: "Respondido" },
    vinculado: { color: "var(--green)", txt: "Vinculado" + (correo.reclamo_vinculado ? ` · exp. ${correo.reclamo_vinculado}` : "") },
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
                ? <span key={i} style={{ fontSize: 10.5, color: "var(--tint-amber-tx)" }}>
                    ⚠ {a.nombre || "adjunto"} (no descargado — {" "}
                    <a href={WEBMAIL_URL} target="_blank" rel="noreferrer"
                      title="Abrir webmail de Hostinger (inicia sesión con tu buzón TELCOM)"
                      style={{ color: "var(--tint-amber-tx)", textDecoration: "underline" }}>
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
