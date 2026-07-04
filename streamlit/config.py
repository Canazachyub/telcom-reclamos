# -*- coding: utf-8 -*-
"""Configuración compartida por las páginas de Herramientas TELCOM."""
import streamlit as st

# --- API Apps Script (Code.gs / Tickets.gs) --------------------------------
# Se puede sobrescribir con st.secrets["API_URL"] / ["SETUP_KEY"] sin tocar código.
API_URL_DEFAULT = (
    "https://script.google.com/macros/s/"
    "AKfycby873l5XjLOfkrjwl7R0E-lqN7FcWzwVruQOM9T0W8FU7lP_mz6nkKkcI3CcKdry8im/exec"
)
# La clave de mantenimiento NUNCA va en el código: se lee de st.secrets["SETUP_KEY"]
# (local: .streamlit/secrets.toml, que está en .gitignore; nube: Settings > Secrets).
SETUP_KEY_DEFAULT = ""

# --- Dashboard operativo (React, 90_Dashboard/app) --------------------------
# Enlace que se muestra en el sidebar de todas las páginas.
# Por defecto apunta al dashboard publicado en GitHub Pages; para desarrollo
# local se puede sobrescribir con st.secrets["DASHBOARD_URL"] sin tocar código.
DASHBOARD_URL_DEFAULT = "https://canazachyub.github.io/telcom-reclamos/"


def api_url() -> str:
    try:
        return st.secrets["API_URL"]
    except Exception:
        return API_URL_DEFAULT


def setup_key() -> str:
    try:
        return st.secrets["SETUP_KEY"]
    except Exception:
        return SETUP_KEY_DEFAULT


def dashboard_url() -> str:
    try:
        return st.secrets["DASHBOARD_URL"]
    except Exception:
        return DASHBOARD_URL_DEFAULT


# Orden canónico de etapas del flujo (igual a `app/src/lib/model.js` ETAPAS).
# Sirve para hallar la "etapa activa" de un caso: la primera no-hecha.
ETAPAS_ORDEN = [
    "Recepción",
    "Evaluación",
    "Campo",
    "SIELSE",
    "Resolución",
    "Firmas",
    "Notificación",
    "Apelación (JARU)",
    "Foliado",
    "Cierre",
]


# Nombres del equipo (para la tabla "por trabajador") — respaldo si la API
# no trae 'usuarios' o el campo 'responsable' viene vacío.
NOMBRE_BY_RESP = {
    0: "Externo / Call Center",
    1: "Andre Araujo Alvarez",
    2: "Diego Marroquín Concha",
    3: "Juan Vargas Miranda",
    4: "Dalia Cayllahua Zárate",
    5: "Milagros León Umeres",
    6: "Abraham Jiménez Latorre",
    7: "Mhyalhu Zárate Castañeda",
    8: "Marilyn Hurtado Vega",
}


def render_sidebar() -> None:
    """Sidebar común a todas las páginas: logo-texto + enlace al dashboard operativo.

    Llamar una vez al inicio de cada página (después de `st.set_page_config`).
    """
    with st.sidebar:
        st.markdown(
            """
            <div style="line-height:1.15; margin-bottom:0.5rem;">
                <span style="font-size:1.35rem;">🛠️⚡</span>
                <b style="font-size:1.05rem;"> TELCOM</b><br/>
                <span style="font-size:0.8rem; color:#8a8f98;">CP-026-2026-ELSE</span>
            </div>
            """,
            unsafe_allow_html=True,
        )
        st.markdown(f"[📊 Dashboard operativo]({dashboard_url()})")
        st.caption("Reportes en vivo del contrato (React, `90_Dashboard/app`).")
        st.divider()
