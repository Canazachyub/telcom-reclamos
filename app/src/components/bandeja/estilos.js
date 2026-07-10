// Estilos inline compartidos por la Bandeja (patrón dominante del proyecto: Drawer.jsx, Ticket.jsx).
// Extraído tal cual desde Bandeja.jsx.

export const S = {
  kpiRow: { display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 },
  kpiChip: { display: "flex", alignItems: "center", gap: 7, background: "var(--card2)", border: "1px solid var(--bd)", borderRadius: 10, padding: "8px 14px", cursor: "pointer", fontSize: 12.5, color: "var(--tx)", lineHeight: 1.2 },
  kpiChipActiva: { borderColor: "var(--acc)", boxShadow: "0 0 0 1px var(--acc) inset" },
  kpiNum: { fontSize: 17, fontWeight: 800, color: "var(--titulo)" },
  kpiLbl: { fontSize: 11, color: "var(--mut)", whiteSpace: "nowrap" },
  buzonColsWrap: { overflowX: "auto", paddingBottom: 4 },
  buzonCols: { display: "grid", gap: 14 },
  buzonColHd: { position: "sticky", top: 0, zIndex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, paddingBottom: 8, marginBottom: 8, borderBottom: "1px solid var(--bd)", background: "var(--card)" },
  buzonColNombre: { fontSize: 12.5, fontWeight: 700, color: "var(--titulo)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textTransform: "lowercase" },
  buzonColCount: { fontSize: 10.5, color: "var(--mut)", background: "var(--card2)", border: "1px solid var(--bd)", borderRadius: 999, padding: "1px 8px", flexShrink: 0 },
  buzonColBody: { maxHeight: 640, overflowY: "auto", paddingRight: 2 },
  diaSep: { display: "flex", alignItems: "center", gap: 10, margin: "14px 0 8px", color: "var(--mut)", fontSize: 11, textTransform: "uppercase", letterSpacing: ".06em" },
  diaSepLine: { flex: 1, height: 1, background: "var(--bd)" },
  mailRow: { position: "relative", display: "flex", flexDirection: "column", gap: 6, background: "var(--card2)", border: "1px solid var(--bd)", borderRadius: 10, padding: "10px 12px", marginBottom: 6, cursor: "pointer" },
  mailTop: { display: "flex", gap: 10, alignItems: "flex-start" },
  mailDot: { width: 8, height: 8, borderRadius: "50%", flexShrink: 0, marginTop: 6 },
  mailMain: { minWidth: 0, flex: 1 },
  mailLinea1: { display: "flex", alignItems: "baseline", gap: 8, minWidth: 0, flexWrap: "wrap" },
  mailRemitente: { fontWeight: 700, fontSize: 13, color: "var(--titulo)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "50%" },
  mailBuzonChip: { fontSize: 10, color: "var(--mut)", background: "var(--card2)", border: "1px solid var(--bd)", borderRadius: 5, padding: "1px 6px", whiteSpace: "nowrap", flexShrink: 0 },
  mailFecha: { marginLeft: "auto", paddingLeft: 8, fontSize: 11, color: "var(--mut)", whiteSpace: "nowrap", flexShrink: 0, textAlign: "right" },
  mailAsunto: { fontSize: 12.5, color: "var(--tx)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  mailResumen: { fontSize: 11.5, color: "var(--mut)", marginTop: 2, display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden", lineHeight: 1.4 },
  mailAdjuntos: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 },
  mailVinc: { display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginTop: 8 },
  mailAcciones: { display: "flex", gap: 6, alignItems: "center", flexShrink: 0, flexWrap: "wrap" },
  mailBtn: { background: "var(--card2)", border: "1px solid var(--bd)", color: "var(--tx)", borderRadius: 7, padding: "5px 9px", fontSize: 11.5, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, lineHeight: 1, flexShrink: 0, whiteSpace: "nowrap" },
  mailBtnAcc: { borderColor: "var(--acc)", color: "var(--acc)" },
};
export const estBorde = { nuevo: "var(--navy)", vinculado: "var(--green)", respondido: "var(--purple)" };
