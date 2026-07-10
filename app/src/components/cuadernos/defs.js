import { CUADERNOS, MESES_NOMBRE, valCuaderno } from "../../lib/cuadernosDef.js";
import { parseFecha } from "../../lib/model.js";

// Definiciones, constantes y helpers puros de Cuadernos.jsx. Extraído tal cual.

export const fmtF = v => {
  if (!v) return "";
  const d = parseFecha(String(v).slice(0, 10));
  return d ? d.toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" }) : String(v);
};
export const hoyISO = () => new Date().toISOString().slice(0, 10);

// ¿el valor parece una fecha/fecha-hora ISO? -> se muestra como dd/mm/yyyy (nunca "2026-06-18T05:00:00.000Z")
export const esISO = v => /^\d{4}-\d{2}-\d{2}/.test(String(v || ""));
export const fmtCel = v => (esISO(v) ? fmtF(v) : (v == null ? "" : String(v)));

// Campos que son FECHA (llevan date-picker en el editor y se muestran dd/mm/yyyy).
export const CAMPOS_FECHA = new Set(["fecha_evento", "f2", "f3", "f4"]);
// No se ofrecen para editar (autogenerados o de solo lectura).
export const NO_EDITABLES = new Set(["item", "usuario", "origen", "cod_reclamo", "numero_osinerg"]);

// Campos editables de un cuaderno, derivados de SUS columnas reales (etiquetas de siempre):
// así el formulario de «1ra Inspección» dice EJECUTADO/DEVUELTO en vez de «Fecha 2/3».
export function camposEditables(def) {
  const vistos = new Set(), out = [];
  (def.cols || []).forEach(([label, path]) => {
    if (!path || NO_EDITABLES.has(path) || vistos.has(path)) return;
    vistos.add(path);
    out.push({ path, label, fecha: CAMPOS_FECHA.has(path), extra: path.indexOf("extra.") === 0 });
  });
  if (!vistos.has("observaciones")) out.push({ path: "observaciones", label: "Observaciones", ancho: true });
  return out;
}
// extra{} de una fila (para no PISAR los demás campos extra al guardar uno).
export const extraDe = fila => {
  try { return typeof fila.extra === "string" ? JSON.parse(fila.extra || "{}") : (fila.extra || {}); }
  catch (e) { return {}; }
};

// Número con separador de miles (es-PE); "" si es nulo.
export const nMil = v => (v == null || v === "") ? "" : Number(v).toLocaleString("es-PE");

// Agrupación de los cuadernos por FASE del trabajo (organiza el hub, en vez de 19 tarjetas sueltas).
export const GRUPOS = [
  { titulo: "Padrón mensual", keys: ["mensual"] },
  { titulo: "Campo e inspección", keys: ["1ra_inspeccion", "contrastes", "contraste_resultado", "cambios_medidor"] },
  { titulo: "Resoluciones y envíos", keys: ["resol_oficina", "correlativos", "cartas_cvr", "cargo_consorcio", "notaria", "notaria_retorno", "oposiciones"] },
  { titulo: "Apelaciones (JARU)", keys: ["apelaciones", "cargos_apelacion"] },
  { titulo: "Cierre y control", keys: ["cerrados", "espera_cedula", "suspendidos", "reintegros", "sectores"] },
];
export const DEF_POR_KEY = {}; CUADERNOS.forEach(d => { DEF_POR_KEY[d.key] = d; });
export const DEF_POR_FUENTE = {}; CUADERNOS.forEach(d => { DEF_POR_FUENTE[d.fuente] = d; });
export const nombreCuaderno = tipo => (DEF_POR_FUENTE[tipo] ? DEF_POR_FUENTE[tipo].nombre : tipo);
// Cuadernos temáticos (todos menos el padrón) — para el filtro de la vista unificada.
export const TIPOS_TEMATICOS = CUADERNOS.filter(d => d.fuente !== "mensual");

// 🗂 VISTA UNIFICADA: todas las hojas de control en UNA sola tabla, con su Cuaderno/etapa visible.
export const DEF_TODOS = {
  key: "todos", fuente: "todos", nombre: "Todos los cuadernos (vista unificada)",
  titulo: "VISTA UNIFICADA — todos los registros de control, con su cuaderno y etapa",
  cols: [["Cuaderno", "__cuaderno"], ["Fecha", "fecha_evento"], ["Reclamo", "reclamo"],
    ["Suministro", "suministro"], ["Estado", "estado"], ["Correlativo", "correlativo"],
    ["Resolución", "resolucion"], ["Observaciones", "observaciones"]],
};

export { CUADERNOS, MESES_NOMBRE, valCuaderno };
