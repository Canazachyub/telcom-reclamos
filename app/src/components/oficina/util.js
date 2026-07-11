// Helpers compartidos entre OficinaPanel (panel completo de jefes, en Expedientes) y
// OficinaSimple (vista rápida de tramitadores, en Mi día → 🗂 Oficina). Extraído 1:1 de
// OficinaPanel.jsx SIN cambiar comportamiento — misma convención de dato: el físico vive en
// datos_etapa "Recepción" vía la action YA EXISTENTE guardar_datos (ver lib/camposEtapa.js,
// claves FISICO_OFICINA/FISICO_FECHA/FISICO_FUENTE). Cero red aquí: son funciones puras sobre
// lo que el padre ya trae por props (data/datos/activoByCode).

export const hoyISO = () => new Date().toISOString().slice(0, 10);

// Clave EXACTA que arma el bundle de datos_etapa (App.jsx: setDatos({[exp+"|"+etapa]:...})).
export const tieneFisico = (datos, codigo) => (datos && datos[codigo + "|Recepción"]?.FISICO_OFICINA) === "sí";
export const fisicoInfo = (datos, codigo) => (datos && datos[codigo + "|Recepción"]) || {};

// rango de urgencia de UN caso activo, vía activoByCode — 0=vencido · 1=por vencer (≤2 d.háb.) ·
// 2=en plazo · 3=activo sin ticket todavía. Ordena tanto listas simples como grupos.
export const rankActivo = (x, activoByCode) => {
  const act = activoByCode[String(x.codigo)];
  if (!act) return 3;
  if (act.vencido) return 0;
  if (act.diasRestantes != null && act.diasRestantes <= 2) return 1;
  return 2;
};
