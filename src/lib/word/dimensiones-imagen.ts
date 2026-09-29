// ─────────────────────────────────────────────────────────────────────────────
// De cuántos píxeles es una imagen, leyendo su cabecera.
//
// Word no escala nada: en el XML hay que escribir el ancho y el alto EXACTOS en
// EMU de cada foto. Sin conocer la proporción original, toda foto saldría con la
// misma forma y las verticales quedarían aplastadas.
//
// No se decodifica la imagen, solo su cabecera: son los primeros bytes del
// archivo, ya están en memoria y no hacen falta dependencias nativas.
// ─────────────────────────────────────────────────────────────────────────────

/** 1 píxel a 96 ppp. Es la unidad de OOXML (914400 EMU = 1 pulgada). */
export const EMU_POR_PIXEL = 9525;

export type Dimensiones = { ancho: number; alto: number };

/**
 * Tamaño en píxeles de un PNG, JPEG, GIF o WebP.
 *
 * Devuelve `null` si el formato no se reconoce o la cabecera está truncada;
 * quien llama decide qué hacer (ver `ajustarACaja`). Nunca lanza: un archivo
 * roto en el bucket no debe impedir que salga el informe entero.
 */
export function dimensionesImagen(datos: Buffer): Dimensiones | null {
  try {
    return (
      dimensionesPng(datos) ??
      dimensionesGif(datos) ??
      dimensionesWebp(datos) ??
      dimensionesJpeg(datos)
    );
  } catch {
    return null;
  }
}

function dimensionesPng(datos: Buffer): Dimensiones | null {
  // Firma PNG + el trozo IHDR, que por norma es siempre el primero.
  if (datos.length < 24) return null;
  if (datos.readUInt32BE(0) !== 0x89504e47) return null;
  if (datos.toString("ascii", 12, 16) !== "IHDR") return null;
  return { ancho: datos.readUInt32BE(16), alto: datos.readUInt32BE(20) };
}

function dimensionesGif(datos: Buffer): Dimensiones | null {
  if (datos.length < 10) return null;
  if (datos.toString("ascii", 0, 3) !== "GIF") return null;
  return { ancho: datos.readUInt16LE(6), alto: datos.readUInt16LE(8) };
}

function dimensionesWebp(datos: Buffer): Dimensiones | null {
  if (datos.length < 30) return null;
  if (datos.toString("ascii", 0, 4) !== "RIFF") return null;
  if (datos.toString("ascii", 8, 12) !== "WEBP") return null;

  const tipo = datos.toString("ascii", 12, 16);

  if (tipo === "VP8X") {
    // Lienzo en 24 bits little-endian, guardado como «medida − 1».
    const ancho = 1 + (datos[24] | (datos[25] << 8) | (datos[26] << 16));
    const alto = 1 + (datos[27] | (datos[28] << 8) | (datos[29] << 16));
    return { ancho, alto };
  }

  if (tipo === "VP8 ") {
    // Fotograma con pérdida: tras el código de inicio 0x9d 0x01 0x2a van dos
    // enteros de 16 bits cuyos 14 bits bajos son la medida.
    if (datos[23] !== 0x9d || datos[24] !== 0x01 || datos[25] !== 0x2a) return null;
    return {
      ancho: datos.readUInt16LE(26) & 0x3fff,
      alto: datos.readUInt16LE(28) & 0x3fff,
    };
  }

  if (tipo === "VP8L") {
    // Sin pérdida: 14 bits de ancho y 14 de alto empaquetados tras la firma
    // 0x2f, también guardados como «medida − 1».
    if (datos[20] !== 0x2f) return null;
    const bits =
      datos[21] | (datos[22] << 8) | (datos[23] << 16) | (datos[24] << 24);
    return {
      ancho: 1 + (bits & 0x3fff),
      alto: 1 + ((bits >> 14) & 0x3fff),
    };
  }

  return null;
}

function dimensionesJpeg(datos: Buffer): Dimensiones | null {
  if (datos.length < 4) return null;
  if (datos.readUInt16BE(0) !== 0xffd8) return null;

  let posicion = 2;
  // `+ 9` es lo que hay que poder leer de una marca SOF: dos bytes de marca,
  // dos de longitud, uno de precisión y los cuatro del alto y el ancho.
  while (posicion + 9 <= datos.length) {
    if (datos[posicion] !== 0xff) {
      posicion += 1; // relleno entre segmentos
      continue;
    }

    const marca = datos[posicion + 1];

    // Marcas sin carga útil: relleno (0xff) y RSTn / SOI / EOI.
    if (marca === 0xff) {
      posicion += 1;
      continue;
    }
    if (marca === 0xd8 || (marca >= 0xd0 && marca <= 0xd9)) {
      posicion += 2;
      continue;
    }

    const largo = datos.readUInt16BE(posicion + 2);

    // SOF0…SOF15 llevan el tamaño real del fotograma. Se excluyen DHT (0xc4),
    // JPG (0xc8) y DAC (0xcc), que caen en el mismo rango y no son SOF.
    const esSof =
      marca >= 0xc0 && marca <= 0xcf && marca !== 0xc4 && marca !== 0xc8 && marca !== 0xcc;

    if (esSof) {
      return {
        alto: datos.readUInt16BE(posicion + 5),
        ancho: datos.readUInt16BE(posicion + 7),
      };
    }

    posicion += 2 + largo;
  }

  return null;
}

/**
 * Tamaño en EMU para que la imagen quepa en una caja conservando su proporción.
 *
 * Se agranda igual que se achica: las fotos del programa vienen de teléfonos y
 * son enormes, pero una miniatura pegada del portapapeles saldría del tamaño de
 * un sello si solo se permitiera reducir, y el hueco de la tabla quedaría vacío.
 *
 * Sin dimensiones legibles se usa la caja entera. Es la única salida honesta: la
 * foto sale con la proporción equivocada, pero SALE, con su pie y en su sitio.
 */
export function ajustarACaja(
  dimensiones: Dimensiones | null,
  cajaAncho: number,
  cajaAlto: number,
): { cx: number; cy: number } {
  if (!dimensiones || dimensiones.ancho <= 0 || dimensiones.alto <= 0) {
    return { cx: cajaAncho, cy: cajaAlto };
  }

  const ancho = dimensiones.ancho * EMU_POR_PIXEL;
  const alto = dimensiones.alto * EMU_POR_PIXEL;
  const factor = Math.min(cajaAncho / ancho, cajaAlto / alto);

  return {
    cx: Math.max(1, Math.round(ancho * factor)),
    cy: Math.max(1, Math.round(alto * factor)),
  };
}
