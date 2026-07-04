# -*- coding: utf-8 -*-
"""
Herramientas TELCOM — Contrato CP-026-2026-ELSE
================================================
App Streamlit interna para Gerente/Coordinador. Punto de entrada.

Correr local:
    streamlit run app.py

Páginas (carpeta pages/):
    1_Ensamblador_foliado.py  -> genera Expediente_X.pdf foliado
    2_Estado_del_contrato.py -> KPIs desde la API Apps Script
    3_Mantenimiento.py       -> reset_simulacion / recalcular (con setupKey)
"""
import streamlit as st

from config import render_sidebar

st.set_page_config(
    page_title="Herramientas TELCOM — CP-026-2026-ELSE",
    page_icon="🛠️",
    layout="wide",
    initial_sidebar_state="expanded",
)
render_sidebar()

st.title("🛠️ Herramientas TELCOM")
st.caption("Contrato CP-026-2026-ELSE · Servicio de Atención de Procedimiento Administrativo de Reclamos · INGENIERIA TELCOM E.I.R.L. — Electro Sur Este S.A.A.")

st.markdown(
    """
Usa el menú de la izquierda (**pages**) para navegar:

- **🧷 Ensamblador foliado** — arma el `Expediente_X.pdf` (carátula + índice + folios) de un caso modelo
  o de PDFs sueltos que subas en orden.
- **📊 Estado del contrato** — KPIs en vivo desde la API (casos, abiertos, vencidos, exposición S/),
  tabla por trabajador y gráfico.
- **🔄 Mantenimiento** — `reset_simulacion` y `recalcular` (requiere la `setupKey` del contrato).

> Pensado para **Gerente / Coordinación** de INGENIERIA TELCOM E.I.R.L. Responsive por defecto
> (se adapta a celular/tablet/PC vía el layout `wide` de Streamlit).
"""
)

with st.expander("ℹ️ Acerca de esta app", expanded=False):
    st.markdown(
        """
        - **Cliente:** Electro Sur Este S.A.A. (ELSE) · **Regulador:** OSINERGMIN
        - **Empresa:** INGENIERIA TELCOM E.I.R.L.
        - Esta app **no reemplaza** el dashboard React de producción (`90_Dashboard/app`);
          es una herramienta interna rápida para el equipo de coordinación.
        - Los datos del "Estado del contrato" vienen de la **misma API Apps Script** que usa el dashboard.
        """
    )
