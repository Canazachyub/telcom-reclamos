// Guía de transcripción a SIELSE, por ETAPA del flujo interno.
//
// Nuestro sistema (este dashboard) es la logística interna del equipo: quién hace qué,
// cuánto plazo queda, qué evidencia falta. SIELSE es el sistema oficial de ELSE donde
// TODO reclamo debe quedar transcrito — es el registro que audita OSINERGMIN.
//
// Esta guía NO reemplaza la capacitación en SIELSE: es un recordatorio rápido, en el
// punto de trabajo, de qué clics dar allá para que lo hecho aquí quede reflejado allá.

import { useState } from "react";

export const GUIA_SIELSE = {
  "Recepción": {
    resumen: "Registrar la solicitud",
    pasos: [
      "Botón Nuevo → pantalla Solicitud",
      "Suministro (autollena sucursal/zona/libro) y reclamante (buscar por DNI)",
      "Clase y Tipo de Reclamo, Forma de Presentación, Sector Típico",
      "Descripción, dirección frontis y referencia de ubicación",
      "Guardar → queda EN SOLICITUD; anota el Nº de Solicitud aquí en la plataforma",
    ],
    plazo: "registrar el mismo día",
  },
  "Evaluación": {
    resumen: "Admitir el reclamo",
    pasos: [
      "Botón Admisión → Admitir (indica la fecha)",
      "Se genera el correlativo OSINERG — anótalo en la plataforma",
      "Pestaña Reclamo: dirección de notificación, representante (si aplica) y documentación sustentatoria",
    ],
    plazo: "",
  },
  "Campo": {
    resumen: "OT e informar el resultado",
    pasos: [
      "Generar la OT (módulo Generar OT para Reclamos o botón OT Mantenimiento)",
      "Al volver el resultado de campo: INFORMARLO en SIELSE",
    ],
    plazo: "≤2 días hábiles (Cusco) — penalidad 5.1 (S/50) si se pasa",
  },
  "SIELSE": {
    resumen: "Recibo en reclamo y procedencia",
    pasos: [
      "Pestaña Recibo en Reclamo: agregar comprobantes en disputa y monto (botón Promedio = últimos 6 meses)",
      "Refacturar si corresponde (genera devolución + distribución automáticas)",
      "Botón Procedencia → Procedente (pasa a EN ATENCIÓN)",
    ],
    plazo: "digitalizar ≤2 días hábiles — penalidad 5.2",
  },
  "Resolución": {
    resumen: "Registrar la resolución emitida",
    pasos: [
      "Atención → Con Resolución",
      "Registrar Nº de resolución, fecha de emisión y Tipo de Resolución (Fundado / Fundado en Parte / Infundado…)",
    ],
    plazo: "entrega ≤8º día (reclamo de 10) o ≤27º (de 30)",
  },
  "Firmas": {
    resumen: "SIELSE no modela esta etapa",
    pasos: [
      "Verificar que el Nº y la fecha de la resolución FIRMADA coincidan con lo registrado en 'Con Resolución'",
    ],
    plazo: "",
  },
  "Notificación": {
    resumen: "Registrar la notificación",
    pasos: [
      "Anotar la fecha de recepción por el cliente en el informe 'Con Resolución'",
      "Notarial (ACT-05): cédulas a notaría ≤4º día desde emisión, notificación ≤5º",
    ],
    plazo: "penalidad 5.12 (S/300 + monto) si es tardía",
  },
  "Apelación (JARU)": {
    resumen: "Segunda instancia",
    pasos: [
      "Reconsideración: Atención → Reconsideración (resolverla ≤10 días — penalidad 5.9)",
      "Apelación: Atención → Apelación (registrar Nº de expediente)",
      "ELEVAR a JARU ≤5 días hábiles con el Formato 6 — penalidad 5.10 (S/300 + monto)",
      "Después: Atención → Resolución JARU y → Cumplimiento Resolución JARU",
    ],
    plazo: "elevación ≤5 días hábiles",
  },
  "Foliado": {
    resumen: "Expediente único en PDF",
    pasos: [
      "Ensamblar el PDF foliado (Herramientas → Ensamblador foliado)",
      "Adjuntarlo en Archivos Digitales del informe correspondiente (vía oficial: confirmar con ELSE)",
    ],
    plazo: "≤2 días hábiles — penalidades 5.2/5.3",
  },
  "Cierre": {
    resumen: "Acto firme y cierre económico",
    pasos: [
      "Sin impugnación: a los 15 días hábiles → Atención → Acto Firme",
      "Ventana Cierre: Infundado → el monto en disputa se cobra el siguiente periodo; Fundado / Fundado en Parte → Facturación de ELSE refactura",
      "Verificar Estado = CERRADO",
    ],
    plazo: "cierre ≤16 días hábiles desde la notificación",
  },
};

// Caja compacta/expandible con la guía de transcripción a SIELSE de una etapa.
// `compacta`: arranca plegada (solo título con "▸"), se expande al click.
export function GuiaSielseBox({ etapa, compacta }) {
  const [abierta, setAbierta] = useState(!compacta);
  const g = GUIA_SIELSE[etapa];
  if (!g) return null;

  const caja = { border: "1px solid var(--bd)", background: "#EAF1F9", borderRadius: 10, padding: 10 };
  const titulo = { fontSize: 12.5, fontWeight: 700, color: "var(--navy)", cursor: compacta ? "pointer" : "default" };

  if (compacta && !abierta) {
    return (
      <div style={caja}>
        <div style={titulo} onClick={() => setAbierta(true)}>▸ 📘 En SIELSE — {g.resumen}</div>
      </div>
    );
  }

  return (
    <div style={caja}>
      <div style={titulo} onClick={() => compacta && setAbierta(false)}>
        {compacta ? "▾ " : ""}📘 En SIELSE — {g.resumen}
      </div>
      <ol style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 12, color: "var(--tx)", display: "grid", gap: 3 }}>
        {g.pasos.map((p, i) => <li key={i}>{p}</li>)}
      </ol>
      {g.plazo && <div style={{ marginTop: 6, fontSize: 11.5, fontWeight: 700, color: "#B45309" }}>⏱ {g.plazo}</div>}
    </div>
  );
}
