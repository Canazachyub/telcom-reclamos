// Estilos/helpers compartidos por los pasos del wizard NuevoCaso. Extraído tal cual.

export const badgeDudoso = { marginLeft: 5, fontSize: 9, background: "var(--tint-amber-bg)", color: "var(--tint-amber-tx)", border: "1px solid var(--tint-amber-bd)", borderRadius: 4, padding: "1px 4px" };
export const inp = sug => ({
  width: "100%", marginTop: 3, padding: "7px 9px", borderRadius: 8, fontSize: 13, fontFamily: "inherit",
  background: "var(--card2)", color: "var(--tx)", border: `1px solid ${sug ? "var(--amber)" : "var(--bd)"}`, boxSizing: "border-box",
  outline: "none", transition: "outline-color .1s",
});
// label uniforme: texto 10.5px mayúsculas espaciadas (patrón SIELSE de campo obligatorio)
export const lbl = (maxWidth) => ({ fontSize: 12, display: "block", ...(maxWidth ? { maxWidth, flex: "1 1 " + maxWidth + "px" } : {}) });
export const lblSpan = { color: "var(--mut)", fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".05em", fontWeight: 600 };
// aplica el foco navy 2px a todos los inputs/selects/textareas del wizard sin tocar la lógica
if (typeof document !== "undefined" && !document.getElementById("nuevocaso-focus-style")) {
  const st = document.createElement("style");
  st.id = "nuevocaso-focus-style";
  st.textContent = ".overlay input:focus, .overlay select:focus, .overlay textarea:focus { outline: 2px solid var(--navy); outline-offset: 1px; }";
  document.head.appendChild(st);
}
