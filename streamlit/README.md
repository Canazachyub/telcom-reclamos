# Herramientas TELCOM (Streamlit)

App interna para **Gerente / Coordinación** del contrato **CP-026-2026-ELSE**
(INGENIERIA TELCOM E.I.R.L. — Electro Sur Este S.A.A.). Complementa el dashboard
React de producción (`90_Dashboard/app`) con 3 herramientas rápidas:

1. **🧷 Ensamblador foliado** — arma `Expediente_X.pdf` (carátula + índice + folios)
   de un caso modelo (`c01`–`c13`) o de PDFs sueltos que subas y ordenes tú mismo.
   Reusa `90_Dashboard/data/ensamblar_expediente.py` tal cual está.
2. **📊 Estado del contrato** — KPIs en vivo desde la API Apps Script
   (casos, abiertos, vencidos, exposición S/), tabla por trabajador y gráfico.
3. **🔄 Mantenimiento** — `reset_simulacion` y `recalcular` contra el backend,
   con confirmación explícita (checkbox) porque afectan datos de todo el equipo.

## Estructura

```
streamlit/
├── app.py                          # página de inicio
├── config.py                       # URL de la API + setupKey (con fallback a st.secrets)
├── api_client.py                   # cliente HTTP (GET/POST, fallback verify=False)
├── requirements.txt
├── README.md                       # este archivo
├── .streamlit/
│   └── secrets.toml.example        # plantilla de secrets (copiar a secrets.toml)
└── pages/
    ├── 1_Ensamblador_foliado.py
    ├── 2_Estado_del_contrato.py
    └── 3_Mantenimiento.py
```

## Cómo correr en local (Windows, Python312)

Este proyecto ya tiene un Python 3.12 dedicado (el mismo que usa
`ensamblar_expediente.py`, porque el Python de Inkscape NO sirve):

```powershell
# 1) Instalar dependencias (una sola vez)
C:\Users\User\AppData\Local\Programs\Python\Python312\python.exe -m pip install -r requirements.txt

# 2) Pararse en esta carpeta
cd "c:\PROGRAMACION\CUSCO RECLAMOS\90_Dashboard\streamlit"

# 3) Correr la app
C:\Users\User\AppData\Local\Programs\Python\Python312\python.exe -m streamlit run app.py
```

Se abre en `http://localhost:8501`. Si el PATH ya apunta a ese Python, también
funciona simplemente `streamlit run app.py` desde esta carpeta.

### Secrets en local (opcional)

Si quieres apuntar a otra API o cambiar la `setupKey` sin tocar código, copia
`.streamlit/secrets.toml.example` a `.streamlit/secrets.toml` (mismo folder) y
edita los valores. Sin ese archivo, la app usa los valores por defecto de
`config.py` (los mismos que ya usa el resto del proyecto).

## Cómo desplegar GRATIS en Streamlit Community Cloud (desde GitHub)

1. **El repo ya existe**: `Canazachyub/telcom-reclamos` (espejo público, sin
   datos ni claves; se actualiza con `90_Dashboard/sync_a_nube.ps1`).
2. Entra a **https://share.streamlit.io** (Streamlit Community Cloud) e inicia
   sesión con tu cuenta de GitHub.
3. Clic en **"New app"** (o **"Create app"**).
4. Elige:
   - **Repository**: `Canazachyub/telcom-reclamos` · **Branch**: `main`
   - **Main file path**: `streamlit/app.py`
   - **App URL (subdominio)**: escribe `telcom-herramientas` para que quede
     `https://telcom-herramientas.streamlit.app` (el dashboard ya enlaza ahí).
5. En **"Advanced settings" → Python version**: elige `3.12` (o la más cercana
   disponible) para igualar el entorno local.
6. En **"Advanced settings" → Secrets**, pega el contenido de
   `.streamlit/secrets.toml.example` con tus valores reales:
   ```toml
   API_URL = "https://script.google.com/macros/s/AKfycby.../exec"
   SETUP_KEY = "<clave de mantenimiento del contrato>"
   ```
7. Clic en **"Deploy"**. Streamlit Cloud instala `requirements.txt` solo y
   publica la URL pública (tipo `https://tu-app.streamlit.app`).
8. Cada vez que hagas `git push` a la rama configurada, la app se **redespliega
   sola**.

> Nota: la página **Ensamblador foliado** necesita los PDFs de
> `expedientes_fuente/_split/cNN/` para el modo "Caso modelo". Si esos PDFs
> contienen datos personales de reclamantes, piensa si conviene: (a) mantener
> el repo privado, (b) desplegar solo con el modo "PDFs sueltos" habilitado, o
> (c) no subir esa carpeta y aceptar que ese modo falle con un aviso.

## Nota de seguridad

- La **`setupKey`** da acceso a operaciones de
  mantenimiento del backend (reset, recálculo, carga de datos). **No la dejes
  como texto plano en un repositorio público.**
- Esta app la lee así, en orden de prioridad:
  1. `st.secrets["SETUP_KEY"]` (recomendado: `.streamlit/secrets.toml` local o
     "Secrets" en Streamlit Community Cloud).
  2. Valor por defecto en `config.py` (el mismo que ya está documentado en
     `90_Dashboard/ESTADO.md` — o sea, no es un secreto nuevo, es el que ya
     usa todo el equipo).
- Antes de pasar a producción real (fuera de la simulación), la lista de
  pendientes de `90_Dashboard/ESTADO.md` (§8c, checklist) incluye **rotar la
  `SETUP_KEY`**; si la rotas, actualiza el secret en Streamlit Cloud y/o tu
  `secrets.toml` local.
- `api_client.py` intenta primero con verificación TLS normal; si falla por
  SSL (típico en redes corporativas con proxy/antivirus MITM), reintenta una
  vez con `verify=False`. Es un *fallback* pensado para desarrollo/uso interno,
  no para exponer la app a internet sin más cuidado.

## Pendientes / ideas futuras

- Página 2 muestra la API tal cual (`tickets`, `reclamos`, `penalidades`); si
  el backend cambia nombres de columnas, ajustar `pages/2_Estado_del_contrato.py`.
- El modo "PDFs sueltos" del Ensamblador genera una carátula genérica (sin datos
  SIELSE) porque no hay un `reclamo` asociado; si se necesita, se le puede
  agregar un formulario para capturar Solicitante/Código a mano.
- No hay autenticación propia en esta app (asume uso interno/confiable). Si se
  publica la URL, considerar `st.secrets` + un PIN simple o restringir el
  acceso en Streamlit Cloud ("Viewers" por email de Google).
