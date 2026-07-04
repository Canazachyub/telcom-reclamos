# Plataforma TELCOM — Atención de Reclamos

Plataforma operativa de **INGENIERIA TELCOM E.I.R.L.** para la gestión del
procedimiento administrativo de reclamos (contrato con Electro Sur Este,
regulador OSINERGMIN).

| Componente | Carpeta | Despliegue |
|---|---|---|
| **Dashboard operativo** (React + Vite) | [`app/`](app/) | GitHub Pages — se redespliega solo con cada push a `main` |
| **Herramientas TELCOM** (Streamlit) | [`streamlit/`](streamlit/) | Streamlit Community Cloud (main file: `streamlit/app.py`) |
| Ensamblador de expedientes foliados | [`data/ensamblar_expediente.py`](data/ensamblar_expediente.py) | usado por la página Ensamblador de Streamlit |

Los datos viven en Google Sheets/Drive y se sirven por una API de Google Apps
Script; este repositorio **no contiene datos de reclamantes ni credenciales**
(las claves van en `st.secrets` / Script Properties, nunca en el código).

> Repo espejo de publicación. La fuente de verdad del proyecto (documentación,
> backend Apps Script, datos) vive fuera de este repositorio.
