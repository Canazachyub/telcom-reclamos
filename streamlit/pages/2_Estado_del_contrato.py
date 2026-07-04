# -*- coding: utf-8 -*-
"""
📊 Estado del contrato
=======================
Lee la API Apps Script (GET ?action=tickets|reclamos|penalidades) y muestra:
  - KPIs: casos, abiertos, vencidos, exposición S/ total.
  - Tabla por trabajador (tickets abiertos / vencidos / exposición).
  - Tabla de casos con semáforo por urgencia (etapa activa = primera no-hecha).
  - Catálogo de penalidades del contrato.
  - Gráfico simple (tickets por prioridad / estado).
"""
import sys
from pathlib import Path

import pandas as pd
import streamlit as st

STREAMLIT_DIR = Path(__file__).resolve().parent.parent
if str(STREAMLIT_DIR) not in sys.path:
    sys.path.insert(0, str(STREAMLIT_DIR))

from api_client import api_get  # noqa: E402
from config import ETAPAS_ORDEN, NOMBRE_BY_RESP, api_url, render_sidebar  # noqa: E402

st.set_page_config(page_title="Estado del contrato — TELCOM", page_icon="📊", layout="wide")
render_sidebar()

st.title("📊 Estado del contrato")
st.caption("Datos en vivo desde la API del contrato CP-026-2026-ELSE (Google Apps Script).")

with st.expander("🔌 Conexión", expanded=False):
    st.code(api_url(), language="text")
    st.caption("Si ves un error de SSL, la app reintenta automáticamente con verify=False.")

if st.button("🔄 Recargar datos"):
    st.cache_data.clear()


@st.cache_data(ttl=60, show_spinner=False)
def _cargar(action: str):
    data, err = api_get(action)
    return data, err


with st.spinner("Consultando tickets, reclamos y penalidades..."):
    tickets, err_t = _cargar("tickets")
    reclamos, err_r = _cargar("reclamos")
    penalidades, err_p = _cargar("penalidades")

errores = [e for e in (err_t, err_r, err_p) if e]
if errores:
    st.error(
        "⚠️ No se pudo consultar la API completa. Revisa la conexión o vuelve a intentar "
        "con **🔄 Recargar datos**."
    )
    for e in errores:
        st.caption(f"Detalle: {e}")
    if not tickets and not reclamos:
        st.stop()

df_t = pd.DataFrame(tickets or [])
df_r = pd.DataFrame(reclamos or [])
df_p = pd.DataFrame(penalidades or [])

if df_t.empty and df_r.empty:
    st.warning("La API no devolvió datos (¿ya corriste `setup_v2` + `generar_tickets` en el backend?).")
    st.stop()

# --------------------------------------------------------------- helpers ---
def _num(s):
    return pd.to_numeric(s, errors="coerce").fillna(0)


if not df_t.empty:
    if "exposicion_soles" in df_t.columns:
        df_t["exposicion_soles"] = _num(df_t["exposicion_soles"])
    if "dias_restantes" in df_t.columns:
        df_t["dias_restantes"] = pd.to_numeric(df_t["dias_restantes"], errors="coerce")
    for col in ("estado", "vencido", "prioridad", "responsable", "reclamo"):
        if col not in df_t.columns:
            df_t[col] = ""

# ------------------------------------------------------------------ KPIs ---
n_casos = df_r["CodigoReclamo"].nunique() if "CodigoReclamo" in df_r.columns else df_r.shape[0]

if not df_t.empty:
    abiertos = df_t[df_t["estado"] != "hecho"]
    vencidos = abiertos[abiertos["vencido"].astype(str).str.lower().isin(["sí", "si", "true", "1"])]
    exposicion_total = abiertos["exposicion_soles"].sum() if "exposicion_soles" in abiertos.columns else 0
else:
    abiertos = pd.DataFrame()
    vencidos = pd.DataFrame()
    exposicion_total = 0

col1, col2, col3, col4 = st.columns(4)
col1.metric("📁 Casos (reclamos)", f"{n_casos:,}")
col2.metric(
    "🟡 Tickets abiertos",
    f"{len(abiertos):,}",
    delta="en trámite" if len(abiertos) else "sin pendientes",
    delta_color="off",
)
col3.metric(
    "🔴 Tickets vencidos",
    f"{len(vencidos):,}",
    delta=None if len(vencidos) == 0 else "revisar hoy",
    delta_color="inverse" if len(vencidos) else "off",
)
col4.metric(
    "💰 Exposición S/ (abiertos)",
    f"S/ {exposicion_total:,.2f}",
    delta="riesgo económico" if exposicion_total > 0 else "S/ 0.00",
    delta_color="inverse" if exposicion_total > 0 else "off",
)

st.divider()

# ------------------------------------------------------- tabla por trabajador ---
st.subheader("👥 Carga por trabajador")

if df_t.empty:
    st.info("Sin datos de tickets todavía.")
else:
    t = abiertos.copy()
    if "responsable" in t.columns:
        t["responsable_"] = t["responsable"].replace("", pd.NA)
    else:
        t["responsable_"] = pd.NA
    if "responsable_id" in t.columns:
        t["responsable_"] = t["responsable_"].fillna(
            pd.to_numeric(t["responsable_id"], errors="coerce").map(NOMBRE_BY_RESP)
        )
    t["responsable_"] = t["responsable_"].fillna("Sin asignar")

    resumen = (
        t.groupby("responsable_")
        .agg(
            tickets_abiertos=("responsable_", "size"),
            vencidos=("vencido", lambda s: s.astype(str).str.lower().isin(["sí", "si", "true", "1"]).sum()),
            exposicion_soles=("exposicion_soles", "sum") if "exposicion_soles" in t.columns else ("responsable_", "size"),
        )
        .reset_index()
        .rename(columns={"responsable_": "Trabajador"})
        .sort_values("tickets_abiertos", ascending=False)
    )
    resumen["exposicion_soles"] = resumen["exposicion_soles"].round(2)

    st.dataframe(
        resumen,
        use_container_width=True,
        hide_index=True,
        column_config={
            "Trabajador": st.column_config.TextColumn("Trabajador"),
            "tickets_abiertos": st.column_config.NumberColumn("Tickets abiertos"),
            "vencidos": st.column_config.NumberColumn("Vencidos"),
            "exposicion_soles": st.column_config.NumberColumn("Exposición S/", format="S/ %.2f"),
        },
    )

st.divider()

# --------------------------------------------------------- semáforo por caso ---
st.subheader("🚦 Casos por urgencia (etapa activa)")
st.caption(
    "La **etapa activa** de cada reclamo es la primera etapa no marcada como `hecho` "
    "(orden del flujo: " + " → ".join(ETAPAS_ORDEN) + ")."
)

if df_t.empty or "reclamo" not in df_t.columns:
    st.info("Sin datos de tickets para armar la tabla de casos.")
else:
    orden_map = {et: i for i, et in enumerate(ETAPAS_ORDEN)}

    def _etapa_rank(et):
        return orden_map.get(et, len(ETAPAS_ORDEN))  # etapas desconocidas van al final

    pendientes_caso = abiertos.copy()
    if pendientes_caso.empty:
        casos_semaforo = pd.DataFrame()
    else:
        pendientes_caso["_rank"] = pendientes_caso["etapa"].map(_etapa_rank)
        pendientes_caso = pendientes_caso.sort_values(["reclamo", "_rank"])
        casos_semaforo = pendientes_caso.groupby("reclamo", as_index=False).first()

    def _semaforo(row):
        vencido = str(row.get("vencido", "")).strip().lower() in ("sí", "si", "true", "1")
        dias = row.get("dias_restantes", None)
        if vencido:
            return "🔴 Vencido"
        try:
            dias = float(dias)
        except (TypeError, ValueError):
            return "⚪ Sin plazo"
        if dias <= 2:
            return "🟠 Urgente (≤2 días)"
        return "🟢 En plazo"

    if casos_semaforo.empty:
        st.info("No hay casos con tickets abiertos: todo al día.")
    else:
        casos_semaforo["Urgencia"] = casos_semaforo.apply(_semaforo, axis=1)
        orden_urgencia = {"🔴 Vencido": 0, "🟠 Urgente (≤2 días)": 1, "🟢 En plazo": 2, "⚪ Sin plazo": 3}
        casos_semaforo["_orden_urg"] = casos_semaforo["Urgencia"].map(orden_urgencia)
        casos_semaforo = casos_semaforo.sort_values(["_orden_urg", "dias_restantes"])

        cols_caso = [c for c in [
            "reclamo", "etapa", "responsable", "Urgencia", "dias_restantes",
            "fecha_limite", "prioridad", "exposicion_soles",
        ] if c in casos_semaforo.columns or c == "Urgencia"]

        resumen_urg = casos_semaforo["Urgencia"].value_counts()
        u1, u2, u3, u4 = st.columns(4)
        u1.metric("🔴 Vencidos", int(resumen_urg.get("🔴 Vencido", 0)))
        u2.metric("🟠 Urgentes (≤2 días)", int(resumen_urg.get("🟠 Urgente (≤2 días)", 0)))
        u3.metric("🟢 En plazo", int(resumen_urg.get("🟢 En plazo", 0)))
        u4.metric("⚪ Sin plazo", int(resumen_urg.get("⚪ Sin plazo", 0)))

        st.dataframe(
            casos_semaforo[cols_caso].rename(columns={
                "reclamo": "Reclamo",
                "etapa": "Etapa activa",
                "responsable": "Responsable",
                "dias_restantes": "Días restantes",
                "fecha_limite": "Fecha límite",
                "prioridad": "Prioridad",
                "exposicion_soles": "Exposición S/",
            }),
            use_container_width=True,
            hide_index=True,
            column_config={
                "Exposición S/": st.column_config.NumberColumn("Exposición S/", format="S/ %.2f"),
            },
        )

st.divider()

# ------------------------------------------------------------ gráfico simple ---
st.subheader("📈 Tickets abiertos por prioridad")
if df_t.empty or "prioridad" not in df_t.columns:
    st.info("Sin datos suficientes para el gráfico.")
else:
    conteo = abiertos["prioridad"].replace("", "sin prioridad").value_counts()
    st.bar_chart(conteo)

with st.expander("📋 Ver detalle de tickets abiertos"):
    if df_t.empty:
        st.write("—")
    else:
        cols_mostrar = [c for c in [
            "ticket_id", "reclamo", "etapa", "responsable", "estado",
            "fecha_limite", "dias_restantes", "vencido", "prioridad", "exposicion_soles",
        ] if c in abiertos.columns]
        st.dataframe(abiertos[cols_mostrar], use_container_width=True, hide_index=True)

with st.expander("⚖️ Penalidades del contrato"):
    st.caption(
        "Catálogo de penalidades aplicables (Anexo del contrato CP-026-2026-ELSE). "
        "Tope acumulado: **10% del monto del contrato** (más allá, ELSE puede resolverlo)."
    )
    if df_p.empty:
        st.write("Sin datos de penalidades (la API no devolvió el catálogo).")
    else:
        st.dataframe(df_p, use_container_width=True, hide_index=True)
