import { useEffect, useMemo, useState } from "react";
import { Card, toast, SkeletonRow } from "./ui.jsx";
import { puedeVerTodo } from "../lib/auth.js";
import { parseFechaCorreo_, ordenarDesc_, dedupCorreos_, ESTADOS_FILTRO } from "./bandeja/utils.js";
import { S } from "./bandeja/estilos.js";
import { ListaCorreos } from "./bandeja/ListaCorreos.jsx";

// "📧 Bandeja": correos sincronizados de los buzones (ELSE/OSINERGMIN). El Gerente/Coordinador
// ve todos los buzones (con selector); el resto ve lo que el backend ya le filtró.
// Barra de filtros (client-side, sobre la lista ya cargada): texto libre, rango de fechas y estado.
// Acciones por correo: vincular a un expediente existente o convertir en caso nuevo (abre NuevoCaso).
export default function Bandeja({ perfil, correos, cargando, noDisponible, onRecargar, existentes = [], onConvertir, verExpediente = () => {} }){
  const [buzon, setBuzon] = useState("Todos");
  const [q, setQ] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("Todos");
  const verTodo = puedeVerTodo(perfil?.rol);
  const [w, setW] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
  useEffect(() => { const f = () => setW(window.innerWidth); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); }, []);
  const colsBuzon = w < 980 ? 1 : 2;

  // Dedup al cargar: por id único, y si ids distintos pero (buzon+de+asunto+fecha) coinciden, deja uno solo.
  const correosLimpios = useMemo(() => dedupCorreos_(correos), [correos]);

  const buzones = useMemo(() => {
    const set = new Set((correosLimpios || []).map(c => c.buzon).filter(Boolean));
    return ["Todos", ...Array.from(set).sort()];
  }, [correosLimpios]);

  const porBuzon = useMemo(() => {
    if (!verTodo || buzon === "Todos") return correosLimpios || [];
    return (correosLimpios || []).filter(c => c.buzon === buzon);
  }, [correosLimpios, buzon, verTodo]);

  const filtrados = useMemo(() => {
    const texto = q.trim().toLowerCase();
    const dDesde = desde ? new Date(desde + "T00:00:00") : null;
    const dHasta = hasta ? new Date(hasta + "T23:59:59") : null;
    const lista = (porBuzon || []).filter(c => {
      if (estadoFiltro !== "Todos") {
        // Mismo criterio que el badge de CorreoRow: respondido > vinculado (estado o reclamo_vinculado) > nuevo.
        const estado = c.estado === "respondido"
          ? "respondido"
          : (c.estado === "vinculado" || c.reclamo_vinculado) ? "vinculado" : "nuevo";
        if (estado !== estadoFiltro) return false;
      }
      if (texto) {
        const haystack = [c.de, c.asunto, c.resumen].filter(Boolean).join(" ").toLowerCase();
        if (!haystack.includes(texto)) return false;
      }
      if (dDesde || dHasta) {
        const f = parseFechaCorreo_(c.fecha);
        if (!f) return false; // sin fecha parseable: no pasa un filtro de rango activo
        if (dDesde && f < dDesde) return false;
        if (dHasta && f > dHasta) return false;
      }
      return true;
    });
    return ordenarDesc_(lista); // más nuevo arriba, siempre
  }, [porBuzon, q, desde, hasta, estadoFiltro]);

  const agrupado = useMemo(() => {
    if (!verTodo || buzon !== "Todos") return null;
    const g = {};
    (filtrados || []).forEach(c => { const k = c.buzon || "Sin buzón"; (g[k] = g[k] || []).push(c); });
    // cada columna ya hereda el orden desc de `filtrados`, pero se re-ordena por si acaso
    Object.keys(g).forEach(k => { g[k] = ordenarDesc_(g[k]); });
    return g;
  }, [filtrados, buzon, verTodo]);

  const hayFiltrosActivos = !!(q.trim() || desde || hasta || estadoFiltro !== "Todos");

  // KPIs de la cabecera: se calculan sobre `porBuzon` (ya filtrado por buzón, pero ANTES del
  // filtro de estado/texto/fecha) para que los chips reflejen el universo real del buzón elegido
  // y no colapsen a 0 cuando el usuario ya tiene un filtro de estado activo.
  // "Sin caso" = mismo criterio de estado "nuevo" que ya usa el badge de cada fila y el <select>
  // de estado (ni vinculado ni respondido): es el trabajo pendiente real por atender.
  const kpis = useMemo(() => {
    const lista = porBuzon || [];
    let sinCaso = 0, vinculados = 0, respondidos = 0;
    lista.forEach(c => {
      const esVinculado = c.estado === "vinculado" || !!c.reclamo_vinculado;
      const esRespondido = c.estado === "respondido";
      if (esRespondido) respondidos++;
      else if (esVinculado) vinculados++;
      else sinCaso++;
    });
    return { total: lista.length, sinCaso, vinculados, respondidos };
  }, [porBuzon]);

  // Clic en un chip: alterna el filtro de estado existente (mismo <select> de arriba) — clic de
  // nuevo sobre el chip activo lo desactiva (vuelve a "Todos").
  function toggleEstado_(valor){
    setEstadoFiltro(prev => prev === valor ? "Todos" : valor);
  }

  if (noDisponible) {
    return <Card>
      <h3>📧 Bandeja de correos</h3>
      <div className="note st-acc">
        La sincronización de correos se activa tras el próximo redeploy. Esta pestaña quedará lista automáticamente en cuanto el backend responda <code>action=correos</code>.
      </div>
    </Card>;
  }

  return <>
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <h3 style={{ margin: 0 }}>📧 Bandeja de correos {correosLimpios ? `(${correosLimpios.length})` : ""}</h3>
          <span style={{ fontSize: 12, color: "var(--tx)" }}>Mostrando {filtrados.length} de {porBuzon.length}</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {verTodo && buzones.length > 1 && (
            <select className="flt" value={buzon} onChange={e => setBuzon(e.target.value)}>
              {buzones.map(b => <option key={b} value={b}>{b === "Todos" ? "Todos los buzones" : b}</option>)}
            </select>
          )}
          <button className="btn-ghost" onClick={onRecargar} title="Recargar correos">↻ Recargar</button>
        </div>
      </div>

      <div style={S.kpiRow}>
        <button
          style={{ ...S.kpiChip, ...(estadoFiltro === "Todos" ? S.kpiChipActiva : {}), cursor: "default" }}
          onClick={() => setEstadoFiltro("Todos")}
          title="Ver todos los correos del buzón seleccionado"
        >
          <span style={S.kpiNum}>{kpis.total}</span>
          <span style={S.kpiLbl}>📥 Total</span>
        </button>
        <button
          style={{
            ...S.kpiChip,
            ...(estadoFiltro === "nuevo" ? S.kpiChipActiva : {}),
            borderColor: estadoFiltro === "nuevo" ? "var(--acc)" : (kpis.sinCaso > 10 ? "var(--acc)" : "var(--tint-amber-bd)"),
            background: kpis.sinCaso > 10 ? "var(--tint-amber-bg)" : "var(--tint-amber-bg)",
          }}
          onClick={() => toggleEstado_("nuevo")}
          title="Correos sin expediente vinculado y sin responder — trabajo pendiente real"
        >
          <span style={{ ...S.kpiNum, color: kpis.sinCaso > 10 ? "var(--acc)" : "var(--tint-amber-tx)" }}>{kpis.sinCaso}</span>
          <span style={{ ...S.kpiLbl, color: kpis.sinCaso > 10 ? "var(--acc)" : "var(--tint-amber-tx)", fontWeight: 700 }}>⚠ Sin caso</span>
        </button>
        <button
          style={{ ...S.kpiChip, ...(estadoFiltro === "vinculado" ? S.kpiChipActiva : {}) }}
          onClick={() => toggleEstado_("vinculado")}
          title="Correos ya vinculados a un expediente existente"
        >
          <span style={{ ...S.kpiNum, color: "var(--navy)" }}>{kpis.vinculados}</span>
          <span style={S.kpiLbl}>🔗 Vinculados</span>
        </button>
        <button
          style={{ ...S.kpiChip, ...(estadoFiltro === "respondido" ? S.kpiChipActiva : {}) }}
          onClick={() => toggleEstado_("respondido")}
          title="Correos ya respondidos desde el buzón TELCOM"
        >
          <span style={{ ...S.kpiNum, color: "var(--green)" }}>{kpis.respondidos}</span>
          <span style={S.kpiLbl}>↩ Respondidos</span>
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>
        <input className="flt" type="text" placeholder="🔎 Buscar remitente / asunto / resumen…" value={q} onChange={e => setQ(e.target.value)} style={{ minWidth: 240, flex: "1 1 240px" }}/>
        <label className="muted" style={{ fontSize: 11.5, display: "flex", alignItems: "center", gap: 4 }}>
          Desde <input className="flt" type="date" value={desde} onChange={e => setDesde(e.target.value)} />
        </label>
        <label className="muted" style={{ fontSize: 11.5, display: "flex", alignItems: "center", gap: 4 }}>
          Hasta <input className="flt" type="date" value={hasta} onChange={e => setHasta(e.target.value)} />
        </label>
        <select className="flt" value={estadoFiltro} onChange={e => setEstadoFiltro(e.target.value)}>
          {ESTADOS_FILTRO.map(e => <option key={e} value={e}>{e === "Todos" ? "Todos los estados" : e}</option>)}
        </select>
        {hayFiltrosActivos && (
          <button className="btn-ghost sm" onClick={() => { setQ(""); setDesde(""); setHasta(""); setEstadoFiltro("Todos"); }}>✕ limpiar filtros</button>
        )}
      </div>

      {cargando && (
        <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
          {Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)}
        </div>
      )}
      {!cargando && !(correosLimpios || []).length && (
        <div className="muted" style={{ marginTop: 8, fontSize: 12, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          Ningún correo por ahora.
          <button className="btn-ghost sm" onClick={onRecargar}>🔄 Actualizar</button>
        </div>
      )}
    </Card>

    {/* Gerente/Coordinador con "Todos": vista paralela agrupada por buzón */}
    {agrupado
      ? <div style={{ ...S.buzonColsWrap, marginTop: 14 }}>
          <div style={{ ...S.buzonCols, gridTemplateColumns: `repeat(${Math.max(colsBuzon, Object.keys(agrupado).length)},minmax(340px,1fr))` }}>
            {Object.entries(agrupado).map(([bz, items]) => {
              const sinCasoCol = items.filter(c => !(c.estado === "vinculado" || c.reclamo_vinculado) && c.estado !== "respondido").length;
              return (
                <Card key={bz} style={{ padding: 12, minWidth: 340 }}>
                  <div style={S.buzonColHd}>
                    <span style={S.buzonColNombre} title={bz}>{(bz.split("@")[0] || bz)}</span>
                    <span style={{ ...S.buzonColCount, ...(sinCasoCol > 0 ? { color: "#B45309", borderColor: "#B45309", background: "rgba(180,83,9,.08)" } : {}) }} title={sinCasoCol > 0 ? `${sinCasoCol} sin caso` : "Sin pendientes"}>
                      {items.length}{sinCasoCol > 0 ? ` · ⚠${sinCasoCol}` : ""}
                    </span>
                  </div>
                  <div style={S.buzonColBody}>
                    <ListaCorreos items={items} existentes={existentes} onConvertir={onConvertir} verExpediente={verExpediente} separadores={false} compacto />
                    {!items.length && <div className="muted" style={{ fontSize: 12 }}>Sin correos.</div>}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      : <div style={{ marginTop: 14 }}>
          <Card>
            <ListaCorreos items={filtrados} existentes={existentes} onConvertir={onConvertir} verExpediente={verExpediente} separadores={true} />
            {!filtrados.length && !cargando && (
              <div className="muted" style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                Ningún correo coincide con los filtros.
                {hayFiltrosActivos && <button className="btn-ghost sm" onClick={() => { setQ(""); setDesde(""); setHasta(""); setEstadoFiltro("Todos"); }}>✕ Limpiar filtros</button>}
              </div>
            )}
          </Card>
        </div>}
  </>;
}
