import { Card } from "../ui.jsx";
import { fmtF } from "./defs.js";
import { semaforoElev } from "./MetricYSemaforo.jsx";

// ===== vista clásica de UN cuaderno (tabla con sus columnas reales) =====
export function VistaCuaderno({ sel, filas, filtradas, colsVista, celdaValor, recDe, setSelExp, setEdit, filtro, tope, setTope }) {
  return (
    <Card>
      <div style={{ overflowX: "auto" }}>
        <table className="tbl">
          <thead><tr>
            <th>N°</th>
            {sel.semaforoElev && <th>⚠ ELEV</th>}
            {colsVista.map(c => <th key={c[0]}>{c[0]}</th>)}
            {sel.fuente !== "mensual" && <th></th>}
          </tr></thead>
          <tbody>
            {filas && filtradas.slice(0, tope).map((f, i) => {
              const rec = recDe(f);
              return <tr key={f.id || i} className={rec ? "clk" : ""}
                onClick={() => rec && setSelExp(rec.id)}
                title={rec ? "Abrir la Sala del expediente" : "Caso aún no cargado en la plataforma (2025 / ene-mar 2026)"}>
                <td>{i + 1}</td>
                {sel.semaforoElev && <td>{semaforoElev(f)}</td>}
                {colsVista.map(c => {
                  const v = celdaValor(f, c[1]);
                  const esFecha = /^(\d{4})-(\d{2})-(\d{2})/.test(v);
                  return <td key={c[0]} style={!v ? { background: "var(--tint-amber-bg)" } : undefined}>{esFecha ? fmtF(v) : v}</td>;
                })}
                {sel.fuente !== "mensual" &&
                  <td onClick={e => e.stopPropagation()}>
                    <button className="btn sm" title="Editar registro" onClick={() => setEdit({ ...f })}>✏</button>
                  </td>}
              </tr>;
            })}
            {filas && !filtradas.length && <tr><td colSpan={colsVista.length + 3} className="muted">Sin filas {filtro ? "para ese período" : "aún"}.</td></tr>}
          </tbody>
        </table>
      </div>
      {filas && filtradas.length > tope &&
        <button className="btn sm" style={{ marginTop: 8 }} onClick={() => setTope(tope + 500)}>Mostrar 500 más ({filtradas.length - tope} restantes)</button>}
      <div className="muted" style={{ fontSize: 10.5, marginTop: 6 }}>
        Celda ámbar = hueco (esa etapa aún no registró el dato — §9.4). Si un dato existe también en la etapa
        (datos_etapa), la vista generada del Google Sheet prefiere el de la etapa (primera fuente, firmada).
      </div>
    </Card>
  );
}
