import { Fragment } from "react";
import { Card } from "../ui.jsx";
import { DEF_POR_FUENTE, fmtF, valCuaderno, nombreCuaderno } from "./defs.js";

// pares [label, valor] de un registro para el detalle expandible (usa las columnas reales del cuaderno)
function paresRegistro(tipo, r) {
  const def = DEF_POR_FUENTE[tipo];
  if (!def) return [];
  return def.cols
    .filter(([lbl, path]) => path && !["item", "fecha_evento", "reclamo", "suministro"].includes(path))
    .map(([lbl, path]) => { let v = valCuaderno(r, path); v = String(v == null ? "" : v).trim(); if (/^\d{4}-\d{2}-\d{2}/.test(v)) v = fmtF(v.slice(0, 10)); return { lbl, v }; })
    .filter(x => x.v);
}

// ===== VISTA UNIFICADA: 1 fila por EXPEDIENTE, con los cuadernos por los que pasó =====
export function VistaUnificada({ porExpediente, tipoTodos, filtradas, recDe, setSelExp, tope, setTope, expUnif, setExpUnif }) {
  return (
    <Card>
      <div className="muted" style={{ fontSize: 11.5, marginBottom: 8 }}>
        <b>{porExpediente.filas.length}</b> expediente(s){tipoTodos ? " en «" + nombreCuaderno(tipoTodos) + "»" : ""} · cada fila es UN caso.
        Clic en un caso para <b>desplegar el detalle de cada hoja</b> abajo; «↗ Sala» abre el expediente completo.
        {porExpediente.sinReclamo > 0 && <> · {porExpediente.sinReclamo} registro(s) sin reclamo asociado no se listan aquí.</>}
      </div>
      <div style={{ overflowX: "auto" }}>
        <table className="tbl">
          <thead><tr><th></th><th>Reclamo</th><th>Suministro</th><th>Reclamante</th><th>Cuadernos por los que pasó</th><th>Últ. fecha</th><th></th></tr></thead>
          <tbody>
            {porExpediente.filas.slice(0, tope).map(g => {
              const rec = recDe({ reclamo: g.reclamo });
              const abierto = expUnif === g.reclamo;
              const detalle = abierto ? filtradas.filter(r => String(r.reclamo || "").trim() === g.reclamo) : [];
              const porTp = {}; detalle.forEach(r => { (porTp[r.tipo] = porTp[r.tipo] || []).push(r); });
              return <Fragment key={g.reclamo}>
                <tr className="clk" onClick={() => setExpUnif(cur => cur === g.reclamo ? "" : g.reclamo)}
                  style={abierto ? { background: "var(--card2)" } : undefined}>
                  <td style={{ color: "var(--mut)", width: 16, textAlign: "center" }}>{abierto ? "▾" : "▸"}</td>
                  <td className="mono" style={{ whiteSpace: "nowrap" }}>{rec ? rec.osinerg : g.reclamo}</td>
                  <td className="mono">{g.suministro || (rec ? rec.suministro : "—")}</td>
                  <td>{rec ? rec.solicitante : "—"}</td>
                  <td><div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {Object.keys(g.cuadernos).map(tp => <span key={tp} title={nombreCuaderno(tp)}
                      style={{ fontSize: 10, background: "var(--card)", border: "1px solid var(--bd)", borderRadius: 6, padding: "1px 6px", whiteSpace: "nowrap" }}>
                      {nombreCuaderno(tp)}{g.cuadernos[tp] > 1 ? " ×" + g.cuadernos[tp] : ""}</span>)}
                  </div></td>
                  <td style={{ whiteSpace: "nowrap" }}>{g.ultima ? fmtF(g.ultima) : "—"}</td>
                  <td onClick={e => e.stopPropagation()}>{rec && <button className="btn sm" title="Abrir la Sala del expediente" onClick={() => setSelExp(rec.id)}>↗ Sala</button>}</td>
                </tr>
                {abierto && <tr><td colSpan={7} style={{ background: "var(--card2)", padding: "4px 14px 12px" }}>
                  {Object.keys(porTp).map(tp => <div key={tp} style={{ borderLeft: "3px solid var(--linkTx)", paddingLeft: 10, margin: "8px 0" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--titulo)" }}>{nombreCuaderno(tp)} <span className="muted" style={{ fontWeight: 400 }}>· {porTp[tp].length} registro(s)</span></div>
                    {porTp[tp].map((r, j) => {
                      const pares = paresRegistro(tp, r);
                      return <div key={j} style={{ fontSize: 11, marginTop: 3, display: "flex", flexWrap: "wrap", gap: "1px 12px", alignItems: "baseline" }}>
                        <span className="muted" style={{ minWidth: 66 }}>{r.fecha_evento ? fmtF(String(r.fecha_evento).slice(0, 10)) : "sin fecha"}</span>
                        {pares.length ? pares.map((p, k) => <span key={k}><span className="muted">{p.lbl}:</span> <b style={{ fontWeight: 600 }}>{p.v}</b></span>) : <span className="muted">(sin datos)</span>}
                      </div>;
                    })}
                  </div>)}
                </td></tr>}
              </Fragment>;
            })}
            {!porExpediente.filas.length && <tr><td colSpan={7} className="muted">Sin expedientes para ese filtro.</td></tr>}
          </tbody>
        </table>
      </div>
      {porExpediente.filas.length > tope &&
        <button className="btn sm" style={{ marginTop: 8 }} onClick={() => setTope(tope + 500)}>Mostrar 500 más ({porExpediente.filas.length - tope} restantes)</button>}
    </Card>
  );
}
