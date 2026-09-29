// ─────────────────────────────────────────────────────────────────────────────
// Los dos mecanismos de plantilla del informe en Word.
//
// La plantilla (`plantilla-informe-sesion.docx`) es un informe REAL de 2026 al
// que `scripts/construir-plantilla-word.py` le quitó el contenido. Los huecos
// vienen marcados de dos formas, y este módulo es lo único que sabe leerlas:
//
//   {{NOMBRE}}
//       Un hueco de texto. El script de construcción fusiona los `<w:r>` del
//       párrafo antes de escribirlo, así que el marcador SIEMPRE está dentro de
//       un único `<w:t>` y una sustitución de cadena basta. Ese es justo el
//       problema que resuelve: Word parte «Fecha: 21 de febrero de 2026» en
//       cinco runs, y un marcador tecleado a mano en Word podría no existir
//       como cadena contigua en el XML.
//
//   <!--{{BLOQUE:NOMBRE:INICIO}}--> … <!--{{BLOQUE:NOMBRE:FIN}}-->
//       Una región que se repite (cada foto, cada párrafo) o que desaparece
//       entera (la sección de fotos cuando no hay ninguna). Son comentarios
//       XML: Word los ignora, no se ven al abrir la plantilla y se localizan
//       por coincidencia literal exacta.
//
// Todo es manipulación de cadenas y no de un árbol XML a propósito: el .docx
// que sale tiene que ser byte a byte el de Word salvo en los huecos. Volver a
// serializar el documento con un parser reescribiría atributos, prefijos de
// espacio de nombres y orden de declaraciones, y con eso se irían las garantías
// de que el formato del cliente llega intacto.
// ─────────────────────────────────────────────────────────────────────────────

/** Caracteres de control que XML 1.0 prohíbe incluso escapados. */
const CONTROLES_PROHIBIDOS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;

/**
 * Deja un texto listo para meterlo en un nodo o un atributo XML.
 *
 * Los títulos de las fotos y los comentarios los escribe una persona: pueden
 * traer `&`, `<` o comillas. Sin escaparlos, un título como «Niños & niñas»
 * produce un .docx que Word se niega a abrir.
 */
export function escaparXml(texto: string): string {
  return texto
    .replace(CONTROLES_PROHIBIDOS, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function marcaInicio(nombre: string): string {
  return `<!--{{BLOQUE:${nombre}:INICIO}}-->`;
}

function marcaFin(nombre: string): string {
  return `<!--{{BLOQUE:${nombre}:FIN}}-->`;
}

type Region = { desde: number; hasta: number; contenido: string };

function localizar(xml: string, nombre: string): Region {
  const inicio = marcaInicio(nombre);
  const fin = marcaFin(nombre);

  const desde = xml.indexOf(inicio);
  const hasta = xml.indexOf(fin);

  if (desde === -1 || hasta === -1 || hasta < desde) {
    // Nunca debería pasar: la plantilla está en el repositorio y las pruebas la
    // recorren entera. Si pasa es que alguien la reemplazó por un .docx editado
    // a mano en Word, y entonces hay que rehacerla con el script.
    throw new Error(
      `La plantilla del informe no tiene el bloque «${nombre}». ` +
        `Vuelve a generarla con scripts/construir-plantilla-word.py.`,
    );
  }

  return {
    desde,
    hasta: hasta + fin.length,
    contenido: xml.slice(desde + inicio.length, hasta),
  };
}

/** El XML que hay dentro de un bloque, sin sus marcas. Es el patrón a repetir. */
export function contenidoBloque(xml: string, nombre: string): string {
  return localizar(xml, nombre).contenido;
}

/** Cambia un bloque entero —marcas incluidas— por otro XML. */
export function reemplazarBloque(xml: string, nombre: string, nuevo: string): string {
  const region = localizar(xml, nombre);
  return xml.slice(0, region.desde) + nuevo + xml.slice(region.hasta);
}

/** Quita el bloque y todo lo que contiene: la sección no sale en el documento. */
export function quitarBloque(xml: string, nombre: string): string {
  return reemplazarBloque(xml, nombre, "");
}

/** Deja el contenido del bloque y borra solo sus marcas. */
export function conservarBloque(xml: string, nombre: string): string {
  return reemplazarBloque(xml, nombre, contenidoBloque(xml, nombre));
}

/**
 * Sustituye un marcador `{{NOMBRE}}` por un texto, en todas sus apariciones.
 *
 * Varias a propósito: «Sesión: N» y la fecha salen dos veces, en la portada y
 * en el encabezado del cuerpo, exactamente como en los informes reales.
 */
export function ponerTexto(xml: string, nombre: string, valor: string): string {
  return xml.split(`{{${nombre}}}`).join(escaparXml(valor));
}

/** Igual, pero el valor ya es XML (o un número) y no se escapa. */
export function ponerCrudo(xml: string, nombre: string, valor: string | number): string {
  return xml.split(`{{${nombre}}}`).join(String(valor));
}

/**
 * Los marcadores que la plantilla define. Se listan uno a uno en vez de usar un
 * comodín `\{\{[A-Z_]+\}\}` porque el documento lleva texto escrito por
 * personas: un pie de foto que dijera «{{OJO}}» haría fallar la exportación
 * entera si la comprobación fuese genérica.
 */
const MARCADORES =
  /\{\{(?:SESION_NUMERO|FECHA|TITULO|AUTOR|PARRAFO|PIE_FOTO|(?:PORTADA|FOTO)_(?:REL|CX|CY|DOCPR)|BLOQUE:[A-Z_]+:(?:INICIO|FIN|AQUI))\}\}/g;

/**
 * ¿Queda algún marcador de la plantilla sin resolver?
 *
 * Es la comprobación que impide el fallo más vergonzoso posible: entregarle al
 * cliente un informe donde se lee «{{OBJETIVO}}». El generador la corre siempre,
 * no solo en las pruebas.
 */
export function marcadoresPendientes(xml: string): string[] {
  return [...new Set(xml.match(MARCADORES) ?? [])];
}
