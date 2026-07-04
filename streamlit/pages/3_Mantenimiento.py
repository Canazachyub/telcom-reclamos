# -*- coding: utf-8 -*-
"""
🔄 Mantenimiento
=================
Botones para operaciones de backend que requieren la `setupKey` del contrato:
  - reset_simulacion: deja el dashboard en cero (13 casos modelo en Recepción/pendiente).
  - recalcular: recalcula plazos/exposición y regenera el calendario.

Ambas acciones son POST a la API Apps Script y piden confirmación explícita
(checkbox) antes de ejecutarse, porque afectan datos compartidos por todo el equipo.
"""
import sys
from pathlib import Path

import streamlit as st

STREAMLIT_DIR = Path(__file__).resolve().parent.parent
if str(STREAMLIT_DIR) not in sys.path:
    sys.path.insert(0, str(STREAMLIT_DIR))

from api_client import api_post  # noqa: E402
from config import api_url, render_sidebar, setup_key  # noqa: E402

st.set_page_config(page_title="Mantenimiento — TELCOM", page_icon="🔄", layout="wide")
render_sidebar()

st.title("🔄 Mantenimiento")
st.caption("Operaciones de backend para todo el equipo. Requieren la setupKey del contrato.")

st.warning(
    "⚠️ Estas acciones afectan los datos que ve **todo el equipo** en el dashboard. "
    "Úsalas solo si sabes lo que hacen (o si Coordinación te lo pidió)."
)

with st.expander("🔌 Conexión", expanded=False):
    st.code(api_url(), language="text")

st.divider()

clave_ingresada = st.text_input(
    "setupKey",
    type="password",
    help="Clave de mantenimiento del contrato (por defecto se usa la configurada en st.secrets "
    "o la del código; puedes pegar otra aquí si cambió).",
    placeholder="clave de mantenimiento",
)
clave_efectiva = clave_ingresada or setup_key()

col1, col2 = st.columns(2, gap="large")

# ============================================================ reset_simulacion ===
with col1:
    st.subheader("♻️ Reiniciar simulación")
    st.markdown(
        "- Borra los reclamos de prueba (código `NV...`).\n"
        "- Limpia evidencias/datos/archivos y **regenera los tickets** desde `reclamos`.\n"
        "- Pone **todos los tickets en `pendiente`** (cada caso arranca en Recepción).\n"
        "- Recalcula plazos y calendario.\n\n"
        "Úsalo antes de una demo o de caminar los 13 casos modelo desde cero."
    )
    confirmar_reset = st.checkbox("Confirmo que quiero reiniciar la simulación", key="chk_reset")
    if st.button("♻️ Ejecutar reset_simulacion", type="primary", disabled=not confirmar_reset):
        with st.spinner("Reiniciando simulación..."):
            data, err = api_post({"action": "reset_simulacion", "setupKey": clave_efectiva})
        if err:
            st.error(err)
        elif not data or not data.get("ok"):
            st.error(f"El backend respondió con error: {data}")
        else:
            st.success("Simulación reiniciada.")
            st.json(data)

# =================================================================== recalcular ===
with col2:
    st.subheader("🧮 Recalcular plazos")
    st.markdown(
        "- Recalcula `dias_restantes`, `vencido`, `prioridad` y `exposicion_soles` de **todos** "
        "los tickets abiertos.\n"
        "- Regenera el **calendario** de vencimientos + hitos del contrato.\n\n"
        "Es lo mismo que hace el trigger horario en el backend; úsalo si necesitas "
        "los números al día ahora mismo (por ejemplo, antes de un reporte)."
    )
    confirmar_recalc = st.checkbox("Confirmo que quiero recalcular plazos y calendario", key="chk_recalc")
    if st.button("🧮 Ejecutar recalcular", type="primary", disabled=not confirmar_recalc):
        with st.spinner("Recalculando..."):
            data, err = api_post({"action": "recalcular", "setupKey": clave_efectiva})
        if err:
            st.error(err)
        elif not data or not data.get("ok"):
            st.error(f"El backend respondió con error: {data}")
        else:
            st.success("Plazos y calendario recalculados.")
            st.json(data)

st.divider()
st.caption(
    "Nota de seguridad: en producción, guarda la setupKey en `st.secrets` "
    "(`.streamlit/secrets.toml` local, o en *Secrets* de Streamlit Community Cloud) "
    "y no la dejes hardcodeada en el repo público. Ver README.md de esta carpeta."
)
