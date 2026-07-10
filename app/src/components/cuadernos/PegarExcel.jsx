import { useState, useMemo } from "react";
import { esISO, fmtF } from "./defs.js";

/* ===== 📋 PEGAR DESDE EXCEL: crear un día y subir filas copiadas del Excel local =====
 * El usuario copia celdas de su Excel (separadas por TAB) y las pega. Cada columna se
 * mapea, EN ORDEN, a las columnas del cuaderno (def.cols). El «día del cargo» se aplica
 * como fecha_evento a las filas que no traigan la suya. Subida = upsert idempotente. */
export function PegarExcel({ def, diaInicial, onCerrar, onSubir }) {
  const esMensual = def.fuente === "mensual";
  // columnas a pegar: sin «N°» (item) ni «Origen» (lo pone el sistema). El resto, en orden.
  const cols = (def.cols || []).filter(c => c[1] && c[1] !== "item" && c[1] !== "origen");
  const [dia, setDia] = useState(diaInicial);
  const [texto, setTexto] = useState("");
  const [subiendo, setSubiendo] = useState(false);

  const filas = useMemo(() => {
    return String(texto || "").split(/\r?\n/).filter(l => l.trim()).map(linea => {
      const celdas = linea.split("\t");
      const row = {}, extra = {};
      cols.forEach((c, i) => {
        const path = c[1], val = (celdas[i] == null ? "" : String(celdas[i])).trim();
        if (path.indexOf("extra.") === 0) { if (val) extra[path.slice(6)] = val; }
        else if (val) row[path] = val;
      });
      if (Object.keys(extra).length) row.extra = extra;
      if (!esMensual && !row.fecha_evento && dia) row.fecha_evento = dia;
      return row;
    });
  }, [texto, dia]);

  const valFila = (row, path) => path.indexOf("extra.") === 0 ? (row.extra ? row.extra[path.slice(6)] || "" : "") : (row[path] || "");
  const subir = async () => { setSubiendo(true); await onSubir(filas); setSubiendo(false); };

  return <div className="modal-bg" onClick={onCerrar} style={{ position: "fixed", inset: 0, background: "rgba(22,41,75,.45)", zIndex: 90, display: "flex", alignItems: "center", justifyContent: "center" }}>
    <div onClick={e => e.stopPropagation()} style={{ background: "var(--card)", borderRadius: 12, padding: 18, width: "min(900px,96vw)", maxHeight: "90vh", overflowY: "auto", boxShadow: "var(--shadow-modal)" }}>
      <h3 style={{ marginTop: 0 }}>📋 Pegar desde Excel — {def.nombre}</h3>
      <div className="muted" style={{ fontSize: 11.5, marginBottom: 8 }}>
        Copia de tu Excel <b>solo estas columnas, en este orden</b> (NO copies la columna «N°», y pega SIN encabezado).
        Pegar dos veces la misma fila la <b>actualiza</b>, no la duplica.
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 10 }}>
        {cols.map((c, i) => <span key={c[0]} style={{ fontSize: 10.5, background: "var(--card2)", border: "1px solid var(--bd)", borderRadius: 6, padding: "2px 7px" }}>{i + 1}. {c[0]}</span>)}
      </div>
      {!esMensual &&
        <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <span className="muted">📅 Día del cargo (fecha del evento):</span>
          <input type="date" value={dia} onChange={e => setDia(e.target.value)} />
          <span className="muted" style={{ fontSize: 10.5 }}>se aplica a las filas sin fecha propia</span>
        </label>}
      {esMensual &&
        <div className="muted" style={{ fontSize: 10.5, marginBottom: 8 }}>El mes del padrón se toma solo de la columna «FechaRegistroReclamo».</div>}
      <textarea value={texto} onChange={e => setTexto(e.target.value)} placeholder="Pega aquí (Ctrl+V) las filas copiadas de tu Excel…"
        style={{ width: "100%", minHeight: 120, fontFamily: "ui-monospace,monospace", fontSize: 12, boxSizing: "border-box" }} />
      {filas.length > 0 && <>
        <div className="muted" style={{ fontSize: 11.5, margin: "10px 0 4px" }}>Vista previa — {filas.length} fila(s) a subir:</div>
        <div style={{ overflowX: "auto", maxHeight: 240, border: "1px solid var(--bd)", borderRadius: 8 }}>
          <table className="tbl"><thead><tr><th>N°</th>{cols.map(c => <th key={c[0]}>{c[0]}</th>)}</tr></thead>
            <tbody>{filas.slice(0, 100).map((row, i) => <tr key={i}>
              <td>{i + 1}</td>{cols.map(c => { const v = valFila(row, c[1]); return <td key={c[0]}>{esISO(v) ? fmtF(v) : v}</td>; })}
            </tr>)}</tbody></table>
        </div>
      </>}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12, alignItems: "center" }}>
        <span className="muted" style={{ fontSize: 10.5, marginRight: "auto" }}>Pegar el mismo día otra vez actualiza, no duplica.</span>
        <button className="btn sm" onClick={onCerrar}>Cancelar</button>
        <button className="btn sm primary" disabled={!filas.length || subiendo} onClick={subir}>{subiendo ? "Subiendo…" : `Subir ${filas.length} fila(s)`}</button>
      </div>
    </div>
  </div>;
}
