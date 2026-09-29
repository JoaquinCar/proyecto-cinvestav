#!/usr/bin/env python3
"""Construye `src/lib/word/plantilla-informe-sesion.docx` a partir de un informe real.

POR QUÉ ESTE SCRIPT EXISTE
--------------------------
La plantilla es un .docx binario. Un .docx binario commiteado sin decir de dónde
salió es imposible de revisar y de rehacer: nadie sabe qué se borró, ni cómo
volver a generarlo si el cliente manda un formato nuevo el año que viene. Este
script ES esa explicación, y es ejecutable.

QUÉ HACE
--------
Toma uno de los informes reales de 2026 (por omisión el de la sesión 3, ver
abajo), le quita TODO el contenido de esa sesión concreta y deja los huecos
marcados. NO reconstruye el documento: conserva byte a byte los estilos, las
fuentes, los márgenes, los bordes de tabla, el tema y —sobre todo— el banner
institucional `word/media/image1.png`, que es lo único que el cliente pidió
expresamente conservar (ECOSUR, Cinvestav, IPN, UMAR, Centro de Geociencias,
UNAM, REAC, Renacimiento Maya Yucatán y SECIHTI).

POR QUÉ LA SESIÓN 3
-------------------
Los 12 informes comparten la misma estructura, pero 8 de ellos traen ADEMÁS un
segundo bloque («Actividad de Lectura») y dos traen un tercero («Celebración Día
del Niño», «Clausura del Pasaporte»). En el modelo de datos esos bloques son
OTRAS `Clase` —de tipo LECTURA y EVENTO— y se exportan cada una en su propio
documento, así que la plantilla tiene que ser la de un informe de UNA sola
actividad. Los informes 3 y 10 son los únicos con esa forma limpia y con el
mínimo de fotos (banner + portada + 4). Se toma el 3.

CÓMO SE MARCAN LOS HUECOS
-------------------------
Dos mecanismos, y ninguno puede colisionar con un texto real:

  · `{{NOMBRE}}`   — un hueco de texto. Word parte el texto en muchos `<w:r>`
                     («Fecha: » / «21» / « de » / «febrero»), así que un
                     marcador escrito a mano en Word podría no existir como
                     cadena contigua en el XML. Aquí no pasa: este script
                     FUSIONA los runs del párrafo en uno solo antes de escribir
                     el marcador, de modo que `{{FECHA}}` está garantizado
                     dentro de un único `<w:t>`.

  · `<!--{{BLOQUE:NOMBRE:INICIO}}-->` … `<!--{{BLOQUE:NOMBRE:FIN}}-->`
                     — una región que se repite (cada foto) o que se quita
                     entera (la sección de fotos cuando no hay ninguna). Son
                     comentarios XML: no se ven en Word, no afectan al
                     renderizado y se localizan por coincidencia literal exacta.

USO
---
    python3 scripts/construir-plantilla-word.py \\
        "~/Downloads/sesiones/Informe_sesion_3 Pasaporte 2026.docx" \\
        src/lib/word/plantilla-informe-sesion.docx
"""

from __future__ import annotations

import os
import shutil
import sys
import zipfile
from xml.dom import minidom, Node

W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"

# Extensiones de imagen que el documento generado puede llegar a llevar. Son las
# cuatro que acepta `subirImagenClaseSchema`; el original solo declara png y
# jpeg porque es lo único que usó el coordinador.
DEFAULTS_IMAGEN = {
    "jpeg": "image/jpeg",
    "jpg": "image/jpeg",
    "png": "image/png",
    "gif": "image/gif",
    "webp": "image/webp",
}


# ── Utilidades de DOM ─────────────────────────────────────────────────────────


def elementos(nodo):
    return [h for h in nodo.childNodes if h.nodeType == Node.ELEMENT_NODE]


def hijos_por_nombre(nodo, nombre):
    return [h for h in elementos(nodo) if h.tagName == nombre]


def descendientes(nodo, nombre):
    return nodo.getElementsByTagName(nombre)


def texto_de(nodo):
    return "".join(
        t.firstChild.nodeValue if t.firstChild else ""
        for t in descendientes(nodo, "w:t")
    )


def poner_marcador(dom, parrafo, texto):
    """Deja el párrafo con UN solo run cuyo texto es exactamente `texto`.

    Es el remedio al problema de los runs partidos: el formato del primer run
    manda (es el que Word aplicó al principio de la línea) y el resto se tira.
    """
    runs = hijos_por_nombre(parrafo, "w:r")
    if not runs:
        run = dom.createElement("w:r")
        parrafo.appendChild(run)
        runs = [run]

    primero = runs[0]
    for sobrante in runs[1:]:
        parrafo.removeChild(sobrante)

    for hijo in list(primero.childNodes):
        if hijo.nodeType != Node.ELEMENT_NODE or hijo.tagName != "w:rPr":
            primero.removeChild(hijo)

    t = dom.createElement("w:t")
    t.setAttribute("xml:space", "preserve")
    t.appendChild(dom.createTextNode(texto))
    primero.appendChild(t)


def envolver(dom, nodos, nombre):
    """Rodea una lista de nodos hermanos con los comentarios del bloque."""
    padre = nodos[0].parentNode
    padre.insertBefore(dom.createComment(f"{{{{BLOQUE:{nombre}:INICIO}}}}"), nodos[0])
    ultimo = nodos[-1]
    if ultimo.nextSibling:
        padre.insertBefore(
            dom.createComment(f"{{{{BLOQUE:{nombre}:FIN}}}}"), ultimo.nextSibling
        )
    else:
        padre.appendChild(dom.createComment(f"{{{{BLOQUE:{nombre}:FIN}}}}"))


def parametrizar_dibujo(nodo, prefijo, sufijo_nombre):
    """Sustituye el tamaño, el id y la relación de UNA imagen por marcadores."""
    extent = descendientes(nodo, "wp:extent")[0]
    extent.setAttribute("cx", f"{{{{{prefijo}_CX}}}}")
    extent.setAttribute("cy", f"{{{{{prefijo}_CY}}}}")

    doc_pr = descendientes(nodo, "wp:docPr")[0]
    doc_pr.setAttribute("id", f"{{{{{prefijo}_DOCPR}}}}")
    doc_pr.setAttribute("name", sufijo_nombre)

    blip = descendientes(nodo, "a:blip")[0]
    blip.setAttribute("r:embed", f"{{{{{prefijo}_REL}}}}")

    # `a:ext` aparece DOS veces: la de `a:xfrm` es el tamaño del dibujo y la de
    # `a:extLst` (dentro de `a:blip`) es una extensión de Microsoft con
    # atributo `uri`. Solo se toca la primera.
    for xfrm in descendientes(nodo, "a:xfrm"):
        for ext in hijos_por_nombre(xfrm, "a:ext"):
            ext.setAttribute("cx", f"{{{{{prefijo}_CX}}}}")
            ext.setAttribute("cy", f"{{{{{prefijo}_CY}}}}")


def vaciar_celda(dom, celda):
    """Deja una celda de tabla con un único párrafo vacío."""
    for hijo in list(elementos(celda)):
        if hijo.tagName != "w:tcPr":
            celda.removeChild(hijo)
    celda.appendChild(dom.createElement("w:p"))


# ── El trabajo ────────────────────────────────────────────────────────────────


def construir(origen: str, destino: str) -> None:
    with zipfile.ZipFile(origen) as z:
        partes = {n: z.read(n) for n in z.namelist()}

    dom = minidom.parseString(partes["word/document.xml"].decode("utf-8"))
    body = dom.getElementsByTagName("w:body")[0]
    bloques = elementos(body)

    # Índice de los bloques de primer nivel del informe 3. Se resuelven por
    # posición Y se comprueba el texto: si algún día se parte de otro informe y
    # la forma no coincide, esto revienta aquí en vez de producir una plantilla
    # silenciosamente mal marcada.
    def p(indice, contiene):
        nodo = bloques[indice]
        assert nodo.tagName == "w:p", f"[{indice}] se esperaba w:p, hay {nodo.tagName}"
        assert contiene in texto_de(nodo), (
            f"[{indice}] se esperaba un párrafo con {contiene!r}, "
            f"hay {texto_de(nodo)!r}"
        )
        return nodo

    def tbl(indice):
        nodo = bloques[indice]
        assert nodo.tagName == "w:tbl", f"[{indice}] se esperaba w:tbl"
        return nodo

    # ── Portada ───────────────────────────────────────────────────────────────
    poner_marcador(dom, p(0, "Informe:"), "Informe: Pasaporte al camino del conocimiento")
    poner_marcador(dom, p(1, "Sesión:"), "Sesión: {{SESION_NUMERO}}")
    poner_marcador(dom, p(2, "Fecha:"), "Fecha: {{FECHA}}")
    tbl(3)  # banner institucional: NO se toca
    poner_marcador(dom, p(5, "Tema:"), "Tema: {{TITULO}}")

    portada = tbl(6)
    parametrizar_dibujo(portada, "PORTADA", "Portada")
    envolver(dom, [portada], "PORTADA")

    # ── Encabezado del cuerpo ────────────────────────────────────────────────
    poner_marcador(dom, p(8, "Informe:"), "Informe: Pasaporte al camino del conocimiento")
    poner_marcador(dom, p(9, "Sesión:"), "Sesión: {{SESION_NUMERO}}")
    poner_marcador(dom, p(10, "Fecha:"), "Fecha: {{FECHA}}")

    # ── Título / Autor / Objetivo ────────────────────────────────────────────
    tabla_titulo = tbl(12)
    poner_marcador(dom, descendientes(tabla_titulo, "w:p")[1], "{{TITULO}}")

    # El bloque del autor se lleva también el párrafo separador que va detrás:
    # una sesión sin investigador —un evento especial— no debe dejar un hueco
    # en blanco donde estaba la tabla.
    tabla_autor = tbl(14)
    poner_marcador(dom, descendientes(tabla_autor, "w:p")[1], "{{AUTOR}}")
    envolver(dom, [tabla_autor, bloques[15]], "AUTOR")

    tabla_objetivo = tbl(16)
    poner_marcador(dom, descendientes(tabla_objetivo, "w:p")[1], "{{PARRAFO}}")
    envolver(dom, [descendientes(tabla_objetivo, "w:p")[1]], "OBJETIVO_PARRAFO")
    envolver(dom, [tabla_objetivo], "OBJETIVO")

    # ── Desarrollo de actividad ──────────────────────────────────────────────
    #
    # La tabla real trae 6 filas: un encabezado «Descripción», el texto de la
    # charla y hasta cuatro filas más que en los 12 informes se usan de forma
    # distinta (en el 3 llevan la actividad y su objetivo; en el 10 y el 12
    # están vacías). No hay un campo por fila en el modelo ni lo habrá: lo que
    # el coordinador escribe es UN texto. Se conservan las dos primeras filas y
    # se tiran las otras cuatro, que en la mitad de los informes ya salen en
    # blanco.
    encabezado_desarrollo = p(17, "Desarrollo de actividad")
    tabla_desarrollo = tbl(18)
    filas = hijos_por_nombre(tabla_desarrollo, "w:tr")
    for fila in filas[2:]:
        tabla_desarrollo.removeChild(fila)

    celda_texto = hijos_por_nombre(filas[1], "w:tc")[0]
    parrafos_texto = hijos_por_nombre(celda_texto, "w:p")
    for sobrante in parrafos_texto[1:]:
        celda_texto.removeChild(sobrante)
    poner_marcador(dom, parrafos_texto[0], "{{PARRAFO}}")
    envolver(dom, [parrafos_texto[0]], "DESCRIPCION_PARRAFO")
    envolver(dom, [encabezado_desarrollo, tabla_desarrollo, bloques[19]], "DESARROLLO")

    # ── Fotos de la sesión ───────────────────────────────────────────────────
    encabezado_fotos = p(20, "Fotos de la sesión")
    tabla_fotos = tbl(21)
    filas_fotos = hijos_por_nombre(tabla_fotos, "w:tr")
    for fila in filas_fotos[1:]:
        tabla_fotos.removeChild(fila)

    fila_foto = filas_fotos[0]
    propiedades_fila = hijos_por_nombre(fila_foto, "w:trPr")
    if propiedades_fila:
        envolver(dom, [propiedades_fila[0]], "FOTO_FILA_PROPIEDADES")

    celdas = hijos_por_nombre(fila_foto, "w:tc")
    celda_foto, celda_vacia = celdas[0], celdas[1]

    parametrizar_dibujo(celda_foto, "FOTO", "Foto")
    # Dentro de la celda hay dos párrafos con texto: el que acompaña a la
    # imagen (vacío) y el pie. El pie es el último `w:t` de la celda.
    parrafo_pie = None
    for parrafo in descendientes(celda_foto, "w:p"):
        if texto_de(parrafo).strip():
            parrafo_pie = parrafo
    assert parrafo_pie is not None, "no se encontró el pie de foto"
    poner_marcador(dom, parrafo_pie, "{{PIE_FOTO}}")
    envolver(dom, [celda_foto], "FOTO_CELDA")

    vaciar_celda(dom, celda_vacia)
    envolver(dom, [celda_vacia], "FOTO_CELDA_VACIA")

    envolver(dom, [fila_foto], "FOTOS_FILAS")
    envolver(dom, [encabezado_fotos, tabla_fotos, bloques[22]], "FOTOS")

    # ── Comentarios ──────────────────────────────────────────────────────────
    encabezado_comentarios = p(24, "Comentarios")
    tabla_comentarios = tbl(25)
    celda_comentarios = descendientes(tabla_comentarios, "w:tc")[0]
    parrafos_comentarios = hijos_por_nombre(celda_comentarios, "w:p")
    for sobrante in parrafos_comentarios[1:]:
        celda_comentarios.removeChild(sobrante)
    poner_marcador(dom, parrafos_comentarios[0], "{{PARRAFO}}")
    envolver(dom, [parrafos_comentarios[0]], "COMENTARIOS_PARRAFO")
    envolver(dom, [encabezado_comentarios, tabla_comentarios], "COMENTARIOS")

    # ── Anexo ────────────────────────────────────────────────────────────────
    #
    # El anexo (quién asistió y quién impartió) NO existe en los informes
    # reales: es lo que el cliente pidió «anexar». Se marca el sitio donde va,
    # justo antes del `w:sectPr`, y lo construye el generador.
    sect_pr = hijos_por_nombre(body, "w:sectPr")[0]
    body.insertBefore(dom.createComment("{{BLOQUE:ANEXO:AQUI}}"), sect_pr)

    documento = dom.toxml(encoding="UTF-8")

    # ── Partes del paquete ───────────────────────────────────────────────────
    partes["word/document.xml"] = documento
    partes["word/_rels/document.xml.rels"] = limpiar_rels(
        partes["word/_rels/document.xml.rels"]
    )
    partes["[Content_Types].xml"] = declarar_imagenes(partes["[Content_Types].xml"])
    partes["docProps/core.xml"] = anonimizar(partes["docProps/core.xml"])

    # Fuera todas las fotos de la sesión 3. Se queda SOLO el banner.
    for nombre in list(partes):
        if nombre.startswith("word/media/") and nombre != "word/media/image1.png":
            del partes[nombre]

    os.makedirs(os.path.dirname(destino), exist_ok=True)
    # Fechas fijas: el zip tiene que salir idéntico en cada ejecución, o cada
    # regeneración ensucia el diff de git con 350 KB de ruido.
    with zipfile.ZipFile(destino, "w", zipfile.ZIP_DEFLATED) as z:
        for nombre, datos in partes.items():
            info = zipfile.ZipInfo(nombre, date_time=(1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o600 << 16
            z.writestr(info, datos)


def limpiar_rels(datos: bytes) -> bytes:
    """Quita las relaciones de las fotos; conserva la del banner (image1.png)."""
    import re

    texto = datos.decode("utf-8")
    quitadas = []

    def filtrar(m):
        entero = m.group(0)
        if "media/" in entero and "media/image1.png" not in entero:
            quitadas.append(entero)
            return ""
        return entero

    texto = re.sub(r"<Relationship [^>]*/>", filtrar, texto)
    assert len(quitadas) == 5, f"se esperaban 5 fotos, se quitaron {len(quitadas)}"
    return texto.encode("utf-8")


def declarar_imagenes(datos: bytes) -> bytes:
    """Declara las extensiones de imagen que el generador puede llegar a meter."""
    texto = datos.decode("utf-8")
    nuevos = "".join(
        f'<Default Extension="{ext}" ContentType="{tipo}"/>'
        for ext, tipo in DEFAULTS_IMAGEN.items()
        if f'Extension="{ext}"' not in texto
    )
    return texto.replace("<Default", nuevos + "<Default", 1).encode("utf-8")


def anonimizar(datos: bytes) -> bytes:
    """Borra de las propiedades el nombre de quien escribió el informe real."""
    import re

    texto = datos.decode("utf-8")
    for etiqueta, valor in (
        ("dc:title", "Informe de sesión · Pasaporte al camino del conocimiento"),
        ("dc:creator", "Pasaporte Científico"),
        ("cp:lastModifiedBy", "Pasaporte Científico"),
    ):
        texto = re.sub(
            rf"<{etiqueta}>.*?</{etiqueta}>", f"<{etiqueta}>{valor}</{etiqueta}>", texto
        )
    return texto.encode("utf-8")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(__doc__)
        raise SystemExit(2)
    origen = os.path.expanduser(sys.argv[1])
    destino = os.path.expanduser(sys.argv[2])
    construir(origen, destino)
    print(f"Plantilla escrita en {destino} ({os.path.getsize(destino)} bytes)")
