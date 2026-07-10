import { Card, SkeletonCard } from "../ui.jsx";
import { GRUPOS, DEF_POR_KEY, CUADERNOS, nMil, fmtF } from "./defs.js";
import { Metric } from "./MetricYSemaforo.jsx";
import { ComoFunciona } from "./ComoFunciona.jsx";

/* ============================== HUB ================================== */
export function HubCuadernos({ resumen, esJefe, regen, regenerar, verFlujo, setVerFlujo, onAbrirCuaderno, onAbrirTodos }) {
  const porTipo = (resumen && resumen.registros && resumen.registros.porTipo) || {};
  const men = (resumen && resumen.mensual) || { total: 0, porMes: {}, huecos: 0 };
  const estDe = def => def.fuente === "mensual"
    ? { total: men.total, huecos: men.huecos, cruzan: null }
    : (porTipo[def.fuente] || { total: 0, huecos: 0, cruzan: 0 });
  const totalReg = Object.values(porTipo).reduce((s, o) => s + (o.total || 0), 0);
  return <>
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div>
          <h3 style={{ margin: 0 }}>Cuadernos de Control 2026</h3>
          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
            Los cuadernos de siempre, dentro de la plataforma. Clic en un cuaderno para verlo, editar o imprimir su cargo.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn sm primary" title="Ver TODOS los cuadernos en una sola tabla, con buscador y filtros" onClick={onAbrirTodos}>🗂 Vista unificada</button>
          <button className="btn sm" onClick={() => setVerFlujo(v => !v)}>{verFlujo ? "▲ Ocultar" : "ⓘ ¿Cómo funciona?"}</button>
          {resumen && resumen.sheetUrl &&
            <a className="btn sm" href={resumen.sheetUrl} target="_blank" rel="noreferrer">🔗 Google Sheet</a>}
          {esJefe && <button className="btn sm" disabled={regen} onClick={regenerar}>{regen ? "Regenerando…" : "🔄 Regenerar"}</button>}
        </div>
      </div>
      {/* resumen general */}
      {resumen && <div style={{ display: "flex", flexWrap: "wrap", gap: 22, marginTop: 12, paddingTop: 11, borderTop: "1px solid var(--bd)" }}>
        <Metric label="Padrón (reclamos)" value={nMil(men.total)} />
        <Metric label="Registros de control" value={nMil(totalReg)} />
        <Metric label="Cuadernos" value={CUADERNOS.length} />
        {resumen.generado && <Metric label="Actualizado" value={fmtF(resumen.generado)} />}
      </div>}
      {verFlujo && <ComoFunciona />}
      {!resumen && <div style={{ marginTop: 12 }}><SkeletonCard rows={3}/></div>}
    </Card>

    {/* cuadernos AGRUPADOS por fase del trabajo */}
    {GRUPOS.map(g => {
      const defs = g.keys.map(k => DEF_POR_KEY[k]).filter(Boolean);
      const sub = defs.reduce((s, d) => s + (estDe(d).total || 0), 0);
      return <div key={g.titulo} style={{ marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: "1px solid var(--bd)", paddingBottom: 5, marginBottom: 9 }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: .6, textTransform: "uppercase", color: "var(--mut)" }}>{g.titulo}</span>
          {resumen && <span className="muted" style={{ fontSize: 11 }}>{nMil(sub)} registros</span>}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(215px,1fr))", gap: 10 }}>
          {defs.map(def => {
            const est = estDe(def);
            return <div key={def.key} className="clk" onClick={() => onAbrirCuaderno(def)}
              style={{ cursor: "pointer", background: "var(--card)", border: "1px solid var(--bd)", borderRadius: 10, padding: "11px 13px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--tx)", lineHeight: 1.25 }}>{def.nombre}</span>
                <span style={{ fontSize: 20, fontWeight: 800, color: "var(--titulo)", fontVariantNumeric: "tabular-nums" }}>{resumen ? nMil(est.total) : "—"}</span>
              </div>
              <div style={{ fontSize: 11, marginTop: 4, minHeight: 15 }}>
                {est.cruzan != null && est.cruzan > 0 && <span className="muted">{nMil(est.cruzan)} con expediente</span>}
                {est.huecos > 0 && <span style={{ color: "var(--tint-amber-tx)" }}>{est.cruzan ? " · " : ""}{nMil(est.huecos)} por llenar</span>}
              </div>
            </div>;
          })}
        </div>
      </div>;
    })}
  </>;
}
