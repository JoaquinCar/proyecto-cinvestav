import { readFile } from "node:fs/promises";
import path from "node:path";

import { leerZip, escribirZip, type EntradaZip } from "./zip";
import { ajustarACaja, dimensionesImagen } from "./dimensiones-imagen";
import {
  conservarBloque,
  contenidoBloque,
  escaparXml,
  marcadoresPendientes,
  ponerCrudo,
  ponerTexto,
  quitarBloque,
  reemplazarBloque,
} from "./plantilla";

// ─────────────────────────────────────────────────────────────────────────────
// EL INFORME DE UNA SESIÓN, EN WORD.
//
// Qué es esto: el formato que el coordinador llena a mano cada sesión —los doce
// `Informe_sesion_N Pasaporte 2026.docx`— generado desde la base de datos. No se
// reconstruye el documento con una librería: se parte de uno REAL vaciado
// (`plantilla-informe-sesion.docx`) y solo se rellenan los huecos. Por eso el
// banner institucional, las fuentes, los bordes y los márgenes salen idénticos
// a los del cliente, que es lo único que pidió conservar sí o sí.
//
// UN DOCUMENTO POR SESIÓN (`Clase`), NO POR DÍA
//
// Al abrir los doce informes reales aparece algo que conviene saber: ocho de
// ellos traen, detrás del informe de la charla, un segundo bloque «Actividad de
// Lectura», y dos traen además un tercero («Celebración Día del Niño»,
// «Clausura del Pasaporte»). En el modelo esas son OTRAS `Clase`, de tipo
// LECTURA y EVENTO, con sus propias fotos y su propia asistencia. Juntarlas en
// un solo archivo obligaría a adivinar por fecha qué lectura pertenece a qué
// charla, y el día que no coincidan el documento mentiría. Así que cada sesión
// —cada `Clase`— exporta su propio informe, y quien arme el informe del día
// pega los dos. Es una decisión, no un olvido.
//
// LO QUE SE DECIDIÓ SOBRE LAS FOTOS
//
// La primera foto (la de `orden` 0) es la PORTADA, igual que en los informes
// reales, y el resto van a «Fotos de la sesión» con su pie. Quien ordena la
// galería está eligiendo la portada, y eso es exactamente lo que `orden`
// significa. La portada no lleva pie porque en el formato del cliente tampoco
// lo lleva.
// ─────────────────────────────────────────────────────────────────────────────

// ── Lo que hay que darle ──────────────────────────────────────────────────────

export type FotoInforme = {
  /** Pie de foto (`ImagenClase.titulo`). Puede faltar. */
  pie: string | null;
  mimeType: string;
  /** El binario. Ya descargado: el bucket es privado y no se sirve por URL. */
  datos: Buffer;
};

export type NinoAnexo = {
  apellidos: string;
  nombre: string;
  edad: number;
  escuela: string;
  grado: string;
};

export type StaffAnexo = {
  nombre: string;
  /** Rol ya traducido a lenguaje humano (ver `ROL_STAFF_LABEL`). */
  rol: string;
  institucion: string | null;
};

export type AnexoInforme = {
  ninos: NinoAnexo[];
  staff: StaffAnexo[];
};

/**
 * Todo el informe, ya en texto.
 *
 * Los valores llegan formateados (la fecha en español, el rol del staff en
 * lenguaje humano) y no como filas de Prisma: así esta función no sabe nada de
 * la base de datos y las pruebas pueden armar cualquier caso raro sin un motor
 * de Postgres delante.
 */
export type DatosInformeSesion = {
  /** Lo que se imprime tras «Sesión: ». */
  numeroSesion: string;
  /** Lo que se imprime tras «Fecha: ». Nunca vacío. */
  fecha: string;
  titulo: string;
  /**
   * Quién la impartió. `null` en un evento especial —una clausura no la imparte
   * nadie—, y entonces la fila «Autor:» no se imprime: el formato no puede
   * decir «Autor: null».
   */
  autor: string | null;
  objetivo: string | null;
  /** El «Desarrollo de actividad»: es `Clase.descripcion`. */
  descripcion: string | null;
  comentarios: string | null;
  /** En el orden de `ImagenClase.orden`. La primera es la portada. */
  fotos: FotoInforme[];
  /** Quién asistió y quién impartió. `null` si no se anexa. */
  anexo: AnexoInforme | null;
};

// ── Medidas ───────────────────────────────────────────────────────────────────

/**
 * Cajas en EMU, copiadas del informe real para que las fotos ocupen lo mismo.
 * La portada llena el ancho de texto (10080 twips = 7") y cada foto de la
 * galería cabe en su columna.
 */
const CAJA_PORTADA = { ancho: 6400800, alto: 6400800 };
const CAJA_FOTO = { ancho: 3038475, alto: 3124200 };

/** Ancho de las tablas del anexo, el mismo que el de las del formato. */
const ANCHO_TABLA = 9360;

const EXTENSIONES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpeg",
  "image/gif": "gif",
  "image/webp": "webp",
};

// ── La plantilla ──────────────────────────────────────────────────────────────

const RUTA_PLANTILLA = path.join(
  process.cwd(),
  "src",
  "lib",
  "word",
  "plantilla-informe-sesion.docx",
);

/**
 * La plantilla leída una sola vez por proceso.
 *
 * Son ~350 KB (casi todos del banner) y no cambia nunca en caliente: releerla
 * en cada exportación sería una lectura de disco por petición en una función
 * serverless que ya arranca en frío.
 */
let plantillaEnMemoria: Buffer | null = null;

async function leerPlantilla(): Promise<Buffer> {
  if (!plantillaEnMemoria) {
    plantillaEnMemoria = await readFile(RUTA_PLANTILLA);
  }
  return plantillaEnMemoria;
}

// ── Generación ────────────────────────────────────────────────────────────────

/**
 * Arma el .docx del informe de una sesión.
 *
 * `plantilla` existe para las pruebas y para quien quiera generar con otro
 * formato; en producción no se pasa y se lee la del repositorio.
 */
export async function generarInformeSesionWord(
  datos: DatosInformeSesion,
  plantilla?: Buffer,
): Promise<Buffer> {
  const entradas = leerZip(plantilla ?? (await leerPlantilla()));

  const documento = buscar(entradas, "word/document.xml");
  const relaciones = buscar(entradas, "word/_rels/document.xml.rels");

  const nuevasImagenes: EntradaZip[] = [];
  const nuevasRelaciones: string[] = [];

  let xml = documento.datos.toString("utf8");

  // ── Encabezado ─────────────────────────────────────────────────────────────
  //
  // Los marcadores de una sola línea se resuelven ANTES que los bloques: a
  // partir de aquí el XML ya lleva texto escrito por personas, y ninguna
  // sustitución global debe volver a recorrerlo.
  if (datos.autor && datos.autor.trim().length > 0) {
    xml = ponerTexto(conservarBloque(xml, "AUTOR"), "AUTOR", datos.autor.trim());
  } else {
    xml = quitarBloque(xml, "AUTOR");
  }

  xml = ponerTexto(xml, "SESION_NUMERO", datos.numeroSesion);
  xml = ponerTexto(xml, "FECHA", datos.fecha);
  xml = ponerTexto(xml, "TITULO", datos.titulo);

  // ── Portada y galería ──────────────────────────────────────────────────────
  const [portada, ...galeria] = datos.fotos;

  /** Registra una foto en el paquete y devuelve el id de su relación. */
  function registrar(foto: FotoInforme, indice: number): string {
    const extension = EXTENSIONES[foto.mimeType] ?? "png";
    const nombre = `media/informe-${indice}.${extension}`;
    const idRelacion = `rIdInforme${indice}`;

    nuevasImagenes.push({ nombre: `word/${nombre}`, datos: foto.datos });
    nuevasRelaciones.push(
      `<Relationship Id="${idRelacion}" ` +
        `Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" ` +
        `Target="${nombre}"/>`,
    );

    return idRelacion;
  }

  if (portada) {
    const { cx, cy } = ajustarACaja(
      dimensionesImagen(portada.datos),
      CAJA_PORTADA.ancho,
      CAJA_PORTADA.alto,
    );
    const idRelacion = registrar(portada, 0);

    let bloque = contenidoBloque(xml, "PORTADA");
    bloque = ponerCrudo(bloque, "PORTADA_REL", idRelacion);
    bloque = ponerCrudo(bloque, "PORTADA_CX", cx);
    bloque = ponerCrudo(bloque, "PORTADA_CY", cy);
    bloque = ponerCrudo(bloque, "PORTADA_DOCPR", 900);
    xml = reemplazarBloque(xml, "PORTADA", bloque);
  } else {
    xml = quitarBloque(xml, "PORTADA");
  }

  if (galeria.length > 0) {
    const patronCelda = contenidoBloque(xml, "FOTO_CELDA");
    const celdaVacia = contenidoBloque(xml, "FOTO_CELDA_VACIA");
    const propiedadesFila = contenidoBloque(xml, "FOTO_FILA_PROPIEDADES");

    const celdas = galeria.map((foto, i) => {
      const { cx, cy } = ajustarACaja(
        dimensionesImagen(foto.datos),
        CAJA_FOTO.ancho,
        CAJA_FOTO.alto,
      );
      const idRelacion = registrar(foto, i + 1);

      let celda = patronCelda;
      celda = ponerCrudo(celda, "FOTO_REL", idRelacion);
      celda = ponerCrudo(celda, "FOTO_CX", cx);
      celda = ponerCrudo(celda, "FOTO_CY", cy);
      celda = ponerCrudo(celda, "FOTO_DOCPR", 901 + i);
      // Una foto sin título sale igual, con el pie en blanco: quitar la fila
      // del pie descuadraría la rejilla de dos columnas.
      celda = ponerTexto(celda, "PIE_FOTO", foto.pie?.trim() ?? "");
      return celda;
    });

    // Rejilla de dos columnas, como en el formato. Si el número de fotos es
    // impar, la última fila se completa con la celda vacía de la plantilla.
    const filas: string[] = [];
    for (let i = 0; i < celdas.length; i += 2) {
      const derecha = celdas[i + 1] ?? celdaVacia;
      filas.push(`<w:tr>${propiedadesFila}${celdas[i]}${derecha}</w:tr>`);
    }

    xml = reemplazarBloque(xml, "FOTOS_FILAS", filas.join(""));
    xml = conservarBloque(xml, "FOTOS");
  } else {
    // Sin fotos que enseñar no se imprime un encabezado «Fotos de la sesión»
    // seguido de una tabla vacía.
    xml = quitarBloque(xml, "FOTOS");
  }

  // ── Textos largos ──────────────────────────────────────────────────────────
  xml = rellenarParrafos(xml, "OBJETIVO", "OBJETIVO_PARRAFO", datos.objetivo);
  xml = rellenarParrafos(xml, "DESARROLLO", "DESCRIPCION_PARRAFO", datos.descripcion);
  xml = rellenarParrafos(xml, "COMENTARIOS", "COMENTARIOS_PARRAFO", datos.comentarios);

  // ── Anexo ──────────────────────────────────────────────────────────────────
  xml = xml.replace("<!--{{BLOQUE:ANEXO:AQUI}}-->", construirAnexo(datos.anexo));

  const pendientes = marcadoresPendientes(xml);
  if (pendientes.length > 0) {
    // Entregar un informe donde se lee «{{OBJETIVO}}» es peor que no entregarlo:
    // el cliente lo reenvía sin mirar y el error termina en una institución.
    throw new Error(
      `El informe quedó con marcadores sin resolver: ${pendientes.join(", ")}`,
    );
  }

  documento.datos = Buffer.from(xml, "utf8");

  relaciones.datos = Buffer.from(
    relaciones.datos
      .toString("utf8")
      .replace("</Relationships>", `${nuevasRelaciones.join("")}</Relationships>`),
    "utf8",
  );

  return escribirZip([...entradas, ...nuevasImagenes]);
}

function buscar(entradas: EntradaZip[], nombre: string): EntradaZip {
  const entrada = entradas.find((e) => e.nombre === nombre);
  if (!entrada) {
    throw new Error(`La plantilla del informe no contiene ${nombre}`);
  }
  return entrada;
}

/**
 * Llena una sección de texto libre, o la quita entera si no hay nada que poner.
 *
 * Un campo vacío no deja un recuadro en blanco con su encabezado: el informe
 * tiene que poder salir el mismo día de la sesión, cuando todavía no se
 * escribieron los comentarios.
 */
function rellenarParrafos(
  xml: string,
  bloqueSeccion: string,
  bloqueParrafo: string,
  texto: string | null,
): string {
  const lineas = (texto ?? "")
    .split(/\r?\n/)
    .map((linea) => linea.trim())
    .filter((linea) => linea.length > 0);

  if (lineas.length === 0) {
    return quitarBloque(xml, bloqueSeccion);
  }

  const patron = contenidoBloque(xml, bloqueParrafo);
  const parrafos = lineas.map((linea) => ponerTexto(patron, "PARRAFO", linea)).join("");

  return conservarBloque(reemplazarBloque(xml, bloqueParrafo, parrafos), bloqueSeccion);
}

// ── El anexo ──────────────────────────────────────────────────────────────────

const SALTO_DE_PAGINA = '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';

/**
 * «Anexar lista de participantes (niños y staff)», que fue lo que el cliente
 * pidió en la misma reunión que el formato Word.
 *
 * VA EN EL MISMO DOCUMENTO, en su propia página al final. El informe es el
 * registro de la sesión; separarlo en un segundo archivo obliga a mandar dos
 * cosas y a que alguien las vuelva a juntar, que es justo el trabajo manual que
 * se está quitando.
 *
 * LO QUE NO LLEVA, Y POR QUÉ
 *
 * Ni un teléfono ni un correo, de nadie. De los niños porque
 * `obtenerListaDeSesion` no los devuelve nunca —el anexo dice quién vino, no
 * cómo localizar a un menor—, y del staff porque esta función pide la lista con
 * `incluirContactoStaff: false` y ningún rol lo cambia. Que un ADMIN pueda ver
 * un teléfono DENTRO de la aplicación no es lo mismo que meterlo en un archivo
 * que se reenvía por correo a nueve instituciones: dentro de la app el acceso
 * se revoca, en un .docx que ya salió no.
 *
 * De cada niño salen nombre, escuela, grado y edad: los mismos datos que ya van
 * impresos en la constancia que se lleva a su casa.
 */
function construirAnexo(anexo: AnexoInforme | null): string {
  if (!anexo) return "";

  const secciones: string[] = [];

  if (anexo.ninos.length > 0) {
    secciones.push(
      subtitulo(`Niñas y niños que asistieron (${anexo.ninos.length})`),
      tabla(
        [2500, 2100, 700, 3060, 1000],
        ["Apellidos", "Nombre", "Edad", "Escuela", "Grado"],
        anexo.ninos.map((n) => [
          n.apellidos,
          n.nombre,
          String(n.edad),
          n.escuela,
          n.grado,
        ]),
      ),
    );
  }

  if (anexo.staff.length > 0) {
    secciones.push(
      subtitulo(`Staff de la sesión (${anexo.staff.length})`),
      tabla(
        [3200, 2400, 3760],
        ["Nombre", "Participación", "Institución"],
        anexo.staff.map((s) => [s.nombre, s.rol, s.institucion ?? ""]),
      ),
    );
  }

  // Ni una asistencia registrada ni staff asignado: no se imprime una página
  // con dos tablas vacías. Pasa de verdad —el informe suele escribirse antes de
  // capturar la lista— y una página así se lee como un error del sistema.
  if (secciones.length === 0) return "";

  return (
    SALTO_DE_PAGINA +
    parrafo("Anexo: quiénes participaron en la sesión", { negrita: true, tamano: 28 }) +
    secciones.join("")
  );
}

function subtitulo(texto: string): string {
  return parrafo(texto, { negrita: true, tamano: 22, espacioAntes: 240 });
}

function parrafo(
  texto: string,
  opciones: { negrita?: boolean; tamano?: number; espacioAntes?: number } = {},
): string {
  const { negrita = false, tamano = 20, espacioAntes = 0 } = opciones;
  const formato =
    (negrita ? "<w:b/><w:bCs/>" : "") +
    `<w:sz w:val="${tamano}"/><w:szCs w:val="${tamano}"/>`;

  return (
    `<w:p><w:pPr><w:spacing w:before="${espacioAntes}" w:after="120"/>` +
    `<w:rPr>${formato}</w:rPr></w:pPr>` +
    `<w:r><w:rPr>${formato}</w:rPr>` +
    `<w:t xml:space="preserve">${escaparXml(texto)}</w:t></w:r></w:p>`
  );
}

const BORDES_TABLA =
  "<w:tblBorders>" +
  ["top", "left", "bottom", "right", "insideH", "insideV"]
    .map((lado) => `<w:${lado} w:val="single" w:sz="4" w:space="0" w:color="AAAAAA"/>`)
    .join("") +
  "</w:tblBorders>";

function tabla(anchos: number[], encabezados: string[], filas: string[][]): string {
  const rejilla = anchos.map((a) => `<w:gridCol w:w="${a}"/>`).join("");

  const cabecera =
    // `tblHeader` repite el encabezado en cada página: la lista de una sesión
    // son treinta niños y no cabe en una.
    '<w:tr><w:trPr><w:tblHeader/></w:trPr>' +
    encabezados
      .map((texto, i) => celda(texto, anchos[i], { negrita: true, fondo: "F1F1F1" }))
      .join("") +
    "</w:tr>";

  const cuerpo = filas
    .map(
      (fila) =>
        "<w:tr>" + fila.map((texto, i) => celda(texto, anchos[i])).join("") + "</w:tr>",
    )
    .join("");

  return (
    `<w:tbl><w:tblPr><w:tblW w:w="${ANCHO_TABLA}" w:type="dxa"/>${BORDES_TABLA}` +
    '<w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="0" ' +
    'w:lastColumn="0" w:noHBand="0" w:noVBand="1"/></w:tblPr>' +
    `<w:tblGrid>${rejilla}</w:tblGrid>${cabecera}${cuerpo}</w:tbl>`
  );
}

function celda(
  texto: string,
  ancho: number,
  opciones: { negrita?: boolean; fondo?: string } = {},
): string {
  const sombreado = opciones.fondo
    ? `<w:shd w:val="clear" w:color="auto" w:fill="${opciones.fondo}"/>`
    : "";

  return (
    `<w:tc><w:tcPr><w:tcW w:w="${ancho}" w:type="dxa"/>${sombreado}` +
    '<w:tcMar><w:top w:w="40" w:type="dxa"/><w:left w:w="80" w:type="dxa"/>' +
    '<w:bottom w:w="40" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tcMar>' +
    "</w:tcPr>" +
    parrafo(texto, { negrita: opciones.negrita, tamano: 18 }) +
    "</w:tc>"
  );
}
