# -*- coding: utf-8 -*-
"""
ENSAMBLADOR DEL EXPEDIENTE FOLIADO — Contrato CP-026-2026-ELSE
================================================================
Une los PDF por etapa de `90_Dashboard/expedientes_fuente/_split/cNN/`
(orden 01_Recepcion → 10_Cierre) y produce el expediente final:

    90_Dashboard/data/expedientes_out/Expediente_cNN.pdf

con:
  1. CARÁTULA generada (código de reclamo, solicitante, datos SIELSE).
  2. ÍNDICE con cada documento y su folio de inicio (usa _split/cNN.json
     si existe; si no, una fila por PDF de etapa).
  3. Las piezas unidas en orden de etapa.
  4. FOLIO correlativo estampado en la esquina superior derecha de CADA
     página (carátula = folio 1).

Uso:
    python ensamblar_expediente.py c03 c13     # casos puntuales
    python ensamblar_expediente.py --all       # los 13 casos

Requiere PyMuPDF:  python -m pip install pymupdf
(El python de Inkscape NO sirve; usar p.ej.
 C:\\Users\\User\\AppData\\Local\\Programs\\Python\\Python312\\python.exe)
"""

import json
import math
import re
import sys
from datetime import date
from pathlib import Path

import fitz  # PyMuPDF

# ----------------------------------------------------------------- rutas ---
SCRIPT_DIR = Path(__file__).resolve().parent            # 90_Dashboard/data
DASHBOARD = SCRIPT_DIR.parent                           # 90_Dashboard
SPLIT_DIR = DASHBOARD / "expedientes_fuente" / "_split"
OUT_DIR = SCRIPT_DIR / "expedientes_out"
RECLAMOS_JSON = SCRIPT_DIR / "reclamos_modelo.json"

# ------------------------------------------------------------- constantes ---
ETAPA_LABEL = {
    "01_Recepcion": "01 Recepción",
    "02_Evaluacion": "02 Evaluación",
    "03_Campo": "03 Inspección de campo",
    "04_SIELSE": "04 SIELSE / Refacturación",
    "05_Resolucion": "05 Resolución / Trato directo",
    "06_Firmas": "06 Firmas",
    "07_Notificacion": "07 Notificación",
    "08_Apelacion": "08 Apelación (2.ª instancia)",
    "09_Foliado": "09 Foliado / Anexos",
    "10_Cierre": "10 Cierre",
}

A4 = fitz.paper_rect("a4")          # 595 x 842 pt
MARGEN = 56
FUENTE = "helv"
FUENTE_B = "hebo"
GRIS = (0.35, 0.35, 0.35)
NEGRO = (0, 0, 0)
AZUL = (0.10, 0.20, 0.45)


_TRANS = str.maketrans({"—": "-", "–": "-", "’": "'", "‘": "'",
                        "“": '"', "”": '"', "…": "...", " ": " "})


def _txt(s):
    """PyMuPDF con fuentes base-14 solo acepta Latin-1: sanea el texto."""
    if s is None:
        return ""
    return str(s).translate(_TRANS).encode("latin-1", "replace").decode("latin-1")


def _ancho(texto, size, font=FUENTE):
    return fitz.get_text_length(texto, fontname=font, fontsize=size)


def _wrap(texto, size, ancho_max, font=FUENTE):
    """Corte greedy por palabras para que quepa en ancho_max puntos."""
    palabras = texto.split()
    lineas, actual = [], ""
    for p in palabras:
        prueba = (actual + " " + p).strip()
        if _ancho(prueba, size, font) <= ancho_max or not actual:
            actual = prueba
        else:
            lineas.append(actual)
            actual = p
    if actual:
        lineas.append(actual)
    return lineas or [""]


# -------------------------------------------------------- datos del caso ---
def cargar_reclamos():
    with open(RECLAMOS_JSON, encoding="utf-8-sig") as f:
        return json.load(f)


def datos_caso(caso):
    """Mapea cNN → registro del JSON por orden (c01 = primer registro)."""
    idx = int(caso[1:]) - 1
    reclamos = cargar_reclamos()
    if not 0 <= idx < len(reclamos):
        raise SystemExit(f"[ERROR] {caso}: fuera de rango (JSON tiene {len(reclamos)} reclamos)")
    return reclamos[idx]


def piezas_del_caso(caso):
    """PDFs por etapa en orden 01→10, con su conteo de páginas."""
    carpeta = SPLIT_DIR / caso
    if not carpeta.is_dir():
        raise SystemExit(f"[ERROR] no existe {carpeta}")
    piezas = []
    for pdf in sorted(carpeta.glob("*.pdf")):
        if not re.match(r"^\d{2}_", pdf.name):
            continue
        with fitz.open(pdf) as d:
            n = d.page_count
        piezas.append({"etapa": pdf.stem, "ruta": pdf, "paginas": n})
    if not piezas:
        raise SystemExit(f"[ERROR] {carpeta} no contiene PDFs de etapa")
    return piezas


def filas_indice(caso, piezas):
    """Filas del índice: (etiqueta_etapa, descripcion_doc, paginas_que_ocupa).

    Usa el manifiesto _split/cNN.json (una fila por documento). Si falta,
    degrada a una fila por PDF de etapa.
    """
    manifest = SPLIT_DIR / f"{caso}.json"
    filas = []
    if manifest.exists():
        with open(manifest, encoding="utf-8-sig") as f:
            entradas = json.load(f)
        for e in entradas:  # los manifiestos usan 'doc' o 'documento'
            e.setdefault("doc", e.get("documento", "Documento"))
        por_etapa = {}
        for e in entradas:
            por_etapa.setdefault(e["etapa"], []).append(e)
        for pz in piezas:
            docs = sorted(por_etapa.get(pz["etapa"], []), key=lambda e: e["page"])
            if len(docs) == pz["paginas"]:
                # agrupa páginas consecutivas con la misma descripción
                for d in docs:
                    if filas and filas[-1][0] == pz["etapa"] and filas[-1][1] == d["doc"]:
                        filas[-1][2] += 1
                    else:
                        filas.append([pz["etapa"], d["doc"], 1])
            else:  # manifiesto desincronizado → fila única por etapa
                filas.append([pz["etapa"], f"Documentos de la etapa ({pz['paginas']} pág.)",
                              pz["paginas"]])
    else:
        for pz in piezas:
            filas.append([pz["etapa"], f"Documentos de la etapa ({pz['paginas']} pág.)",
                          pz["paginas"]])
    return filas


# ------------------------------------------------------------- carátula ---
def dibujar_caratula(doc, rec, caso, total_folios):
    pg = doc.new_page(width=A4.width, height=A4.height)
    x0, x1 = MARGEN, A4.width - MARGEN

    # marco doble
    pg.draw_rect(fitz.Rect(30, 30, A4.width - 30, A4.height - 30), color=AZUL, width=1.6)
    pg.draw_rect(fitz.Rect(36, 36, A4.width - 36, A4.height - 36), color=AZUL, width=0.6)

    y = 90
    for linea, size, font, col in (
        ("INGENIERIA TELCOM E.I.R.L.", 13, FUENTE_B, NEGRO),
        ("Servicio de Atención del Procedimiento Administrativo de Reclamos", 9.5, FUENTE, GRIS),
        ("Contrato CP-026-2026-ELSE  —  ELECTRO SUR ESTE S.A.A.", 9.5, FUENTE, GRIS),
    ):
        pg.insert_text((A4.width / 2 - _ancho(_txt(linea), size, font) / 2, y),
                       _txt(linea), fontsize=size, fontname=font, color=col)
        y += size + 6

    y += 30
    pg.draw_line((x0, y), (x1, y), color=AZUL, width=1.2)
    y += 46
    titulo = "EXPEDIENTE DE RECLAMO"
    pg.insert_text((A4.width / 2 - _ancho(titulo, 26, FUENTE_B) / 2, y),
                   titulo, fontsize=26, fontname=FUENTE_B, color=AZUL)
    y += 34
    codigo = _txt(rec.get("CodigoReclamo", ""))
    pg.insert_text((A4.width / 2 - _ancho(codigo, 17, FUENTE_B) / 2, y),
                   codigo, fontsize=17, fontname=FUENTE_B, color=NEGRO)
    y += 22
    pg.draw_line((x0, y), (x1, y), color=AZUL, width=1.2)

    # ficha de datos
    y += 40
    ubic = " / ".join(_txt(rec.get(k, "")).title() for k in
                      ("NombreDistrito", "NombreProvincia", "NombreDepartamento")
                      if rec.get(k))
    campos = [
        ("Solicitante", _txt(rec.get("NombreSolicitante", ""))),
        ("Dirección", _txt(rec.get("DireccionSolicitante", "")).title()),
        ("Ubicación", ubic),
        ("Clase de reclamo", _txt(rec.get("NombreClaseReclamo", "")).title()),
        ("Forma de presentación", _txt(rec.get("NombreFormaReclamo", "")).title()),
        ("Fecha de registro", _txt(rec.get("FechaRegistroReclamo", "")).split(" ")[0]),
        ("Fecha límite de atención", _txt(rec.get("FechaLimiteAtencion", "")).split(" ")[0]),
        ("Estado", _txt(rec.get("NombreEstadoReclamoComercial", ""))),
        ("Tipo de resolución", _txt(rec.get("NombreTipoResolucionReclamo", ""))),
    ]
    col_x = x0 + 8
    val_x = x0 + 165
    for etiqueta, valor in campos:
        if not valor:
            continue
        pg.insert_text((col_x, y), etiqueta.upper(), fontsize=8, fontname=FUENTE_B, color=GRIS)
        for ln in _wrap(valor, 10.5, x1 - val_x - 8, FUENTE):
            pg.insert_text((val_x, y), ln, fontsize=10.5, fontname=FUENTE, color=NEGRO)
            y += 15
        y += 7

    # total de folios
    y = A4.height - 150
    caja = fitz.Rect(A4.width / 2 - 130, y, A4.width / 2 + 130, y + 40)
    pg.draw_rect(caja, color=AZUL, width=1.0)
    leyenda = f"El presente expediente consta de {total_folios} folios"
    pg.insert_text((A4.width / 2 - _ancho(leyenda, 10.5, FUENTE_B) / 2, y + 25),
                   leyenda, fontsize=10.5, fontname=FUENTE_B, color=NEGRO)

    pie = f"Caso {caso}  ·  Expediente ensamblado el {date.today().strftime('%d/%m/%Y')}"
    pg.insert_text((A4.width / 2 - _ancho(pie, 8, FUENTE) / 2, A4.height - 60),
                   pie, fontsize=8, fontname=FUENTE, color=GRIS)


# --------------------------------------------------------------- índice ---
def dibujar_indice(doc, filas, folio_inicio_piezas):
    """Dibuja el índice. `filas` = [etapa, doc, n_paginas]. Devuelve nº de
    páginas usadas. Los folios se calculan desde folio_inicio_piezas."""
    n_paginas = 0
    pg = None
    y = 0
    x0, x1 = MARGEN, A4.width - MARGEN
    col_doc = x0 + 150          # inicio col. documento
    col_fol = x1 - 60           # inicio col. folio
    ancho_doc = col_fol - col_doc - 10

    def nueva_pagina():
        nonlocal pg, y, n_paginas
        pg = doc.new_page(width=A4.width, height=A4.height)
        n_paginas += 1
        t = "ÍNDICE DEL EXPEDIENTE" if n_paginas == 1 else "ÍNDICE (continuación)"
        t = _txt(t)
        pg.insert_text((A4.width / 2 - _ancho(t, 15, FUENTE_B) / 2, 70),
                       t, fontsize=15, fontname=FUENTE_B, color=AZUL)
        y = 105
        pg.insert_text((x0, y), "ETAPA", fontsize=8.5, fontname=FUENTE_B, color=GRIS)
        pg.insert_text((col_doc, y), "DOCUMENTO", fontsize=8.5, fontname=FUENTE_B, color=GRIS)
        pg.insert_text((col_fol, y), "FOLIO", fontsize=8.5, fontname=FUENTE_B, color=GRIS)
        y += 6
        pg.draw_line((x0, y), (x1, y), color=AZUL, width=0.8)
        y += 16

    nueva_pagina()
    folio = folio_inicio_piezas
    etapa_previa = None
    for etapa, docu, npag in filas:
        lineas = _wrap(_txt(docu), 9.5, ancho_doc)
        alto = max(len(lineas) * 12, 12) + 8
        if y + alto > A4.height - 70:
            nueva_pagina()
            etapa_previa = None
        if etapa != etapa_previa:
            pg.insert_text((x0, y), _txt(ETAPA_LABEL.get(etapa, etapa)),
                           fontsize=9, fontname=FUENTE_B, color=NEGRO)
            etapa_previa = etapa
        yy = y
        for ln in lineas:
            pg.insert_text((col_doc, yy), ln, fontsize=9.5, fontname=FUENTE, color=NEGRO)
            yy += 12
        etiqueta_folio = str(folio) if npag == 1 else f"{folio}-{folio + npag - 1}"
        pg.insert_text((col_fol, y), etiqueta_folio, fontsize=9.5, fontname=FUENTE_B, color=NEGRO)
        pg.draw_line((x0, y + alto - 12), (x1, y + alto - 12), color=(0.85, 0.85, 0.85), width=0.4)
        y += alto
        folio += npag
    return n_paginas


def paginas_indice_estimadas(filas, folio_inicio):
    """Renderiza el índice en un doc descartable solo para contar páginas."""
    tmp = fitz.open()
    n = dibujar_indice(tmp, filas, folio_inicio)
    tmp.close()
    return n


# ---------------------------------------------------------------- folios ---
def estampar_folio(pg, numero):
    """Sello 'FOLIO N°' en la esquina superior derecha (respeta rotación)."""
    r = pg.rect  # rect visible (ya rotado)
    w, h = 66, 20
    caja_vis = fitz.Rect(r.x1 - 10 - w, r.y0 + 10, r.x1 - 10, r.y0 + 10 + h)
    caja = caja_vis * pg.derotation_matrix
    caja.normalize()
    pg.draw_rect(caja, color=(0.25, 0.25, 0.25), fill=(1, 1, 1),
                 fill_opacity=0.92, width=0.8)
    pg.insert_textbox(caja, f"FOLIO {numero}", fontsize=9.5, fontname=FUENTE_B,
                      color=NEGRO, align=fitz.TEXT_ALIGN_CENTER,
                      rotate=pg.rotation)


# -------------------------------------------------------------- ensamble ---
def ensamblar(caso):
    rec = datos_caso(caso)
    piezas = piezas_del_caso(caso)
    filas = filas_indice(caso, piezas)
    total_piezas = sum(p["paginas"] for p in piezas)

    # nº de páginas del índice: iterar hasta converger (afecta los folios)
    n_indice = 1
    while True:
        n = paginas_indice_estimadas(filas, folio_inicio=1 + n_indice + 1)
        if n == n_indice:
            break
        n_indice = n

    total_folios = 1 + n_indice + total_piezas
    folio_inicio_piezas = 1 + n_indice + 1

    doc = fitz.open()
    dibujar_caratula(doc, rec, caso, total_folios)
    dibujar_indice(doc, filas, folio_inicio_piezas)
    for pz in piezas:
        with fitz.open(pz["ruta"]) as src:
            doc.insert_pdf(src)

    if doc.page_count != total_folios:
        raise SystemExit(f"[ERROR] {caso}: paginas={doc.page_count} != folios={total_folios}")

    for i, pg in enumerate(doc, start=1):
        estampar_folio(pg, i)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    salida = OUT_DIR / f"Expediente_{caso}.pdf"
    doc.save(salida, garbage=3, deflate=True)
    doc.close()

    print(f"[OK] {caso} -> {salida}")
    print(f"     codigo={rec.get('CodigoReclamo')}  caratula=1  indice={n_indice} pag."
          f"  piezas={len(piezas)} PDFs / {total_piezas} pag.  TOTAL={total_folios} folios")
    return salida, total_folios


# ------------------------------------------------------------------ main ---
def main(argv):
    args = [a.lower() for a in argv[1:]]
    if not args:
        print(__doc__)
        return 1
    if "--all" in args or "todos" in args:
        casos = sorted(p.name for p in SPLIT_DIR.iterdir()
                       if p.is_dir() and re.fullmatch(r"c\d{2}", p.name))
    else:
        casos = args
    for caso in casos:
        if not re.fullmatch(r"c\d{2}", caso):
            print(f"[AVISO] '{caso}' no es un caso valido (formato cNN) - omitido")
            continue
        ensamblar(caso)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
