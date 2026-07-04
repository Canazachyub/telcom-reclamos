# -*- coding: utf-8 -*-
"""
🧷 Ensamblador foliado
======================
Reusa la lógica de `90_Dashboard/data/ensamblar_expediente.py`:
  - Caso modelo (c01..c13): toma los PDFs por etapa de `expedientes_fuente/_split/cNN/`
    y arma carátula + índice + folios, igual que el script de línea de comandos.
  - PDFs sueltos: el usuario sube uno o varios PDF y los ordena manualmente;
    se generan carátula + índice genéricos + folios (sin datos SIELSE del caso).

Descarga el PDF resultante ("Expediente_X.pdf") sin escribir nada a disco
(se arma en memoria con BytesIO). Incluye previsualización (miniaturas de
piezas y de las primeras páginas del resultado).
"""
import io
import re
import sys
from datetime import date
from pathlib import Path

import streamlit as st

st.set_page_config(page_title="Ensamblador foliado — TELCOM", page_icon="🧷", layout="wide")

# ---------------------------------------------------------------- rutas ----
STREAMLIT_DIR = Path(__file__).resolve().parent.parent   # 90_Dashboard/streamlit
DASHBOARD_DIR = STREAMLIT_DIR.parent                      # 90_Dashboard
DATA_DIR = DASHBOARD_DIR / "data"
SPLIT_DIR = DASHBOARD_DIR / "expedientes_fuente" / "_split"

# Permite importar `config.py` (sidebar) y `ensamblar_expediente.py` (90_Dashboard/data/).
if str(STREAMLIT_DIR) not in sys.path:
    sys.path.insert(0, str(STREAMLIT_DIR))
if str(DATA_DIR) not in sys.path:
    sys.path.insert(0, str(DATA_DIR))

from config import render_sidebar  # noqa: E402

render_sidebar()

st.title("🧷 Ensamblador foliado")
st.caption("Genera el expediente único foliado (carátula + índice + folios) listo para SIELSE/OSINERGMIN.")

try:
    import fitz  # PyMuPDF
except ImportError:
    st.error(
        "Falta **PyMuPDF**. Instala con:\n\n"
        "`python -m pip install pymupdf`\n\n"
        "(usa el Python312 indicado en el README de esta carpeta)."
    )
    st.stop()

try:
    import ensamblar_expediente as ee
except Exception as e:
    st.error(f"No se pudo importar `ensamblar_expediente.py` desde `{DATA_DIR}`: {e}")
    st.stop()


def _casos_disponibles():
    if not SPLIT_DIR.is_dir():
        return []
    return sorted(p.name for p in SPLIT_DIR.iterdir() if p.is_dir() and re.fullmatch(r"c\d{2}", p.name))


def _es_pdf_valido(raw: bytes) -> bool:
    """Intenta abrir los bytes con fitz; True si es un PDF legible."""
    try:
        with fitz.open(stream=raw, filetype="pdf") as d:
            return d.page_count > 0
    except Exception:
        return False


def _miniatura_png(raw_pdf: bytes, pagina: int = 0, zoom: float = 0.35) -> bytes:
    """Renderiza una página de un PDF (bytes) a PNG (bytes) para st.image."""
    with fitz.open(stream=raw_pdf, filetype="pdf") as d:
        pg = d.load_page(pagina)
        mat = fitz.Matrix(zoom, zoom)
        pix = pg.get_pixmap(matrix=mat)
        return pix.tobytes("png")


def _mostrar_preview_resultado(pdf_bytes: bytes, max_paginas: int = 4):
    """Muestra las primeras `max_paginas` páginas del PDF ensamblado como imágenes."""
    with fitz.open(stream=pdf_bytes, filetype="pdf") as d:
        n = min(max_paginas, d.page_count)
        cols = st.columns(n) if n > 0 else []
        for i in range(n):
            png = _miniatura_png(pdf_bytes, pagina=i, zoom=0.9)
            with cols[i]:
                st.image(png, caption=f"Folio {i + 1}", use_container_width=True)


def _dibujar_caratula_generica(doc, titulo, referencia, total_folios):
    """Carátula minimalista para el modo 'PDFs sueltos' (sin datos de un caso SIELSE)."""
    A4 = ee.A4
    pg = doc.new_page(width=A4.width, height=A4.height)
    x0, x1 = ee.MARGEN, A4.width - ee.MARGEN

    pg.draw_rect(fitz.Rect(30, 30, A4.width - 30, A4.height - 30), color=ee.AZUL, width=1.6)
    pg.draw_rect(fitz.Rect(36, 36, A4.width - 36, A4.height - 36), color=ee.AZUL, width=0.6)

    y = 100
    for linea, size, font, col in (
        ("INGENIERIA TELCOM E.I.R.L.", 13, ee.FUENTE_B, ee.NEGRO),
        ("Servicio de Atención del Procedimiento Administrativo de Reclamos", 9.5, ee.FUENTE, ee.GRIS),
        ("Contrato CP-026-2026-ELSE  —  ELECTRO SUR ESTE S.A.A.", 9.5, ee.FUENTE, ee.GRIS),
    ):
        t = ee._txt(linea)
        pg.insert_text((A4.width / 2 - ee._ancho(t, size, font) / 2, y), t, fontsize=size, fontname=font, color=col)
        y += size + 6

    y += 40
    pg.draw_line((x0, y), (x1, y), color=ee.AZUL, width=1.2)
    y += 50
    t = ee._txt(titulo or "EXPEDIENTE")
    pg.insert_text((A4.width / 2 - ee._ancho(t, 24, ee.FUENTE_B) / 2, y), t, fontsize=24, fontname=ee.FUENTE_B, color=ee.AZUL)
    y += 26

    if referencia:
        y += 20
        t = ee._txt(referencia)
        pg.insert_text((A4.width / 2 - ee._ancho(t, 13, ee.FUENTE_B) / 2, y), t, fontsize=13, fontname=ee.FUENTE_B, color=ee.NEGRO)

    y = A4.height - 150
    caja = fitz.Rect(A4.width / 2 - 130, y, A4.width / 2 + 130, y + 40)
    pg.draw_rect(caja, color=ee.AZUL, width=1.0)
    leyenda = f"El presente expediente consta de {total_folios} folios"
    pg.insert_text(
        (A4.width / 2 - ee._ancho(leyenda, 10.5, ee.FUENTE_B) / 2, y + 25),
        leyenda, fontsize=10.5, fontname=ee.FUENTE_B, color=ee.NEGRO,
    )
    pie = f"Expediente ensamblado el {date.today().strftime('%d/%m/%Y')}"
    pg.insert_text((A4.width / 2 - ee._ancho(pie, 8, ee.FUENTE) / 2, A4.height - 60), pie, fontsize=8, fontname=ee.FUENTE, color=ee.GRIS)


def ensamblar_sueltos(piezas, titulo="EXPEDIENTE DE RECLAMO", referencia=""):
    """Arma carátula + índice genéricos + folios para PDFs sueltos subidos,
    reusando los dibujantes de bajo nivel de `ensamblar_expediente.py`
    (dibujar_indice, estampar_folio) para mantener el mismo estilo visual.

    `piezas`: lista de dicts {"nombre": str, "raw": bytes, "paginas": int},
    ya en el orden final deseado.

    Devuelve (pdf_bytes, total_folios) sin escribir nada a disco.
    """
    if not piezas:
        raise ValueError("no hay piezas para ensamblar (sube al menos un PDF)")

    total_piezas = sum(p["paginas"] for p in piezas)
    filas = [["00_Documento", p["nombre"], p["paginas"]] for p in piezas]

    # nº de páginas del índice (misma lógica iterativa que el script original)
    n_indice = 1
    while True:
        n = ee.paginas_indice_estimadas(filas, folio_inicio=1 + n_indice + 1)
        if n == n_indice:
            break
        n_indice = n
    total_folios = 1 + n_indice + total_piezas
    folio_inicio_piezas = 1 + n_indice + 1

    # carátula simple (sin datos SIELSE, solo título + referencia + total de folios)
    doc = fitz.open()
    _dibujar_caratula_generica(doc, titulo, referencia, total_folios)
    ee.dibujar_indice(doc, filas, folio_inicio_piezas)
    for p in piezas:
        with fitz.open(stream=p["raw"], filetype="pdf") as src:
            doc.insert_pdf(src)

    if doc.page_count != total_folios:
        doc.close()
        raise RuntimeError(f"paginas={doc.page_count} != folios={total_folios}")

    for i, pg in enumerate(doc, start=1):
        ee.estampar_folio(pg, i)

    out = io.BytesIO()
    doc.save(out, garbage=3, deflate=True)
    doc.close()
    return out.getvalue(), total_folios


modo = st.radio(
    "¿Qué quieres foliar?",
    ["Caso modelo (c01–c13)", "Subir PDFs sueltos (los ordenas tú)"],
    horizontal=True,
)

st.divider()

# =====================================================================
# MODO 1 — caso modelo, reusa ensamblar_expediente.py tal cual
# =====================================================================
if modo == "Caso modelo (c01–c13)":
    casos = _casos_disponibles()
    if not casos:
        st.warning(f"No se encontraron casos en `{SPLIT_DIR}`.")
        st.stop()

    col1, col2 = st.columns([2, 3])
    with col1:
        caso = st.selectbox("Caso", casos, index=0)
    with col2:
        try:
            rec = ee.datos_caso(caso)
            st.markdown(
                f"**{rec.get('NombreSolicitante','—')}** · Código `{rec.get('CodigoReclamo','—')}` · "
                f"{rec.get('NombreClaseReclamo','—')}"
            )
        except Exception as e:
            st.info(f"(no se pudo leer el detalle del caso: {e})")

    try:
        piezas = ee.piezas_del_caso(caso)
        total_pag = sum(p["paginas"] for p in piezas)
        st.write(f"**{len(piezas)}** PDFs por etapa · **{total_pag}** páginas de contenido.")
        with st.expander("Ver piezas / etapas detectadas (miniatura de la 1.ª página)"):
            for p in piezas:
                etiqueta = ee.ETAPA_LABEL.get(p["etapa"], p["etapa"])
                with st.expander(f"`{p['etapa']}` — {etiqueta} — {p['paginas']} pág. ({p['ruta'].name})"):
                    try:
                        raw = p["ruta"].read_bytes()
                        st.image(_miniatura_png(raw), caption="Página 1", width=220)
                    except Exception as e:
                        st.caption(f"(sin miniatura: {e})")
    except SystemExit as e:
        st.error(str(e))
        st.stop()

    if st.button("📎 Ensamblar y foliar", type="primary", key="btn_ensamblar_caso"):
        with st.spinner(f"Ensamblando {caso}..."):
            try:
                salida, total_folios = ee.ensamblar(caso)
                data_bytes = Path(salida).read_bytes()
            except SystemExit as e:
                st.error(str(e))
                st.stop()
            except Exception as e:
                st.error(f"Error al ensamblar: {e}")
                st.stop()

        st.success(f"✅ Expediente ensamblado: **{total_folios} folios**, **{len(piezas)} piezas**.")
        st.download_button(
            "⬇️ Descargar Expediente_" + caso + ".pdf",
            data=data_bytes,
            file_name=f"Expediente_{caso}.pdf",
            mime="application/pdf",
            type="primary",
        )
        st.caption(f"También quedó guardado en `{salida}` (carpeta de salida del script original).")

        st.subheader("Previsualización del resultado")
        _mostrar_preview_resultado(data_bytes, max_paginas=4)

# =====================================================================
# MODO 2 — PDFs sueltos subidos por el usuario, en el orden que él fije
# =====================================================================
else:
    st.markdown(
        "Sube uno o más PDF. Usa los controles de orden para dejarlos en la secuencia "
        "en que deben quedar en el expediente (arriba = primero)."
    )
    archivos = st.file_uploader(
        "PDFs del expediente", type=["pdf"], accept_multiple_files=True, key="uploader_sueltos"
    )

    if archivos:
        # Validación: avisar si algún archivo no es un PDF legible.
        validos, invalidos = [], []
        for a in archivos:
            if _es_pdf_valido(a.getvalue()):
                validos.append(a)
            else:
                invalidos.append(a)

        if invalidos:
            nombres_malos = ", ".join(f"`{a.name}`" for a in invalidos)
            st.warning(
                f"⚠️ {len(invalidos)} archivo(s) no parecen ser PDF válidos y se excluirán: {nombres_malos}"
            )

        if not validos:
            st.error("Ningún archivo subido es un PDF válido. Sube al menos 1 PDF legible para continuar.")
            st.stop()

        nombres = [a.name for a in validos]
        if "orden_sueltos" not in st.session_state or set(st.session_state.orden_sueltos) != set(nombres):
            st.session_state.orden_sueltos = nombres[:]

        st.write("**Orden actual** (usa los selectores para reordenar):")
        orden = st.session_state.orden_sueltos
        for i, nombre in enumerate(orden):
            c1, c2, c3 = st.columns([6, 1, 1])
            c1.write(f"{i + 1}. {nombre}")
            if c2.button("⬆️", key=f"up_{nombre}", disabled=(i == 0)):
                orden[i - 1], orden[i] = orden[i], orden[i - 1]
                st.rerun()
            if c3.button("⬇️", key=f"down_{nombre}", disabled=(i == len(orden) - 1)):
                orden[i + 1], orden[i] = orden[i], orden[i + 1]
                st.rerun()

        by_name = {a.name: a for a in validos}
        with st.expander("Vista previa de las piezas subidas (miniatura de la 1.ª página)"):
            for nombre in orden:
                raw = by_name[nombre].getvalue()
                with st.expander(nombre):
                    try:
                        st.image(_miniatura_png(raw), caption="Página 1", width=220)
                    except Exception as e:
                        st.caption(f"(sin miniatura: {e})")

        st.divider()
        col1, col2 = st.columns(2)
        with col1:
            titulo_exp = st.text_input("Título de la carátula", value="EXPEDIENTE DE RECLAMO")
        with col2:
            nombre_salida = st.text_input("Nombre del solicitante / referencia (opcional)", value="")

        if st.button("📎 Ensamblar y foliar", type="primary", key="btn_ensamblar_sueltos"):
            piezas_ordenadas = []
            for n in st.session_state.orden_sueltos:
                raw = by_name[n].getvalue()
                with fitz.open(stream=raw, filetype="pdf") as d:
                    npag = d.page_count
                piezas_ordenadas.append({"nombre": n, "raw": raw, "paginas": npag})

            with st.spinner("Ensamblando PDFs sueltos..."):
                try:
                    out_bytes, total_folios = ensamblar_sueltos(
                        piezas_ordenadas,
                        titulo=titulo_exp,
                        referencia=nombre_salida,
                    )
                except Exception as e:
                    st.error(f"Error al ensamblar: {e}")
                    st.stop()

            nombre_archivo = f"Expediente_{re.sub(r'[^A-Za-z0-9_-]+', '_', nombre_salida).strip('_') or 'X'}.pdf"
            st.success(f"✅ Expediente ensamblado: **{total_folios} folios**, **{len(piezas_ordenadas)} piezas**.")
            st.download_button(
                "⬇️ Descargar " + nombre_archivo,
                data=out_bytes,
                file_name=nombre_archivo,
                mime="application/pdf",
                type="primary",
            )

            st.subheader("Previsualización del resultado")
            _mostrar_preview_resultado(out_bytes, max_paginas=4)
    else:
        st.info("Sube al menos un PDF para continuar.")
