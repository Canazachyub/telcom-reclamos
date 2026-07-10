import { Tag } from "../ui.jsx";
import { valCuaderno } from "../../lib/cuadernosDef.js";
import { hoyISO } from "./defs.js";

// métrica compacta del resumen del hub (etiqueta pequeña + número grande tabular)
export const Metric = ({ label, value }) => (
  <div>
    <div style={{ fontSize: 19, fontWeight: 800, color: "var(--titulo)", fontVariantNumeric: "tabular-nums", lineHeight: 1.1 }}>{value}</div>
    <div className="muted" style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: .4, marginTop: 2 }}>{label}</div>
  </div>
);

export function semaforoElev(fila) {          // solo APELACION: plazo máx de elevación (5 d.h. — pen. 5.10)
  const plazo = String(fila.f2 || "").slice(0, 10);
  const elevada = valCuaderno(fila, "extra.siged");
  if (!plazo || elevada) return null;
  const dif = Math.round((new Date(plazo) - new Date(hoyISO())) / 86400000);
  if (dif < 0) return <Tag bg="var(--tint-red-bg)" color="var(--tint-red-tx)">vencido {plazo.slice(5)}</Tag>;
  if (dif <= 2) return <Tag bg="var(--tint-amber-bg)" color="var(--tint-amber-tx)">vence {plazo.slice(5)}</Tag>;
  return <Tag bg="var(--tint-green-bg)" color="var(--tint-green-tx)">{plazo.slice(5)}</Tag>;
}
