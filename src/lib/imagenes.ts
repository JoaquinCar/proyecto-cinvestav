// Utilidades de imagen para el navegador: se usan al subir o pegar imágenes en
// una clase. Reducen el peso antes de enviarlas para que subir desde el teléfono
// en campo sea rápido y para no llenar la base de datos.

export const TIPOS_IMAGEN_ACEPTADOS = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;

export type TipoImagenAceptado = (typeof TIPOS_IMAGEN_ACEPTADOS)[number];

/** Lado mayor máximo tras el redimensionado. */
const LADO_MAXIMO = 1600;

/** A partir de este peso conviene recomprimir. */
const UMBRAL_RECOMPRESION = 600 * 1024;

export function esTipoAceptado(tipo: string): tipo is TipoImagenAceptado {
  return (TIPOS_IMAGEN_ACEPTADOS as readonly string[]).includes(tipo);
}

export interface ImagenPreparada {
  mimeType: TipoImagenAceptado;
  /** Contenido en base64, sin el prefijo `data:`. */
  data: string;
  /** Tamaño aproximado del binario resultante, en bytes. */
  tamano: number;
}

function leerComoDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
    reader.readAsDataURL(file);
  });
}

function separarDataUrl(dataUrl: string): { mimeType: string; data: string } {
  const coma = dataUrl.indexOf(",");
  const cabecera = dataUrl.slice(5, coma); // salta "data:"
  const mimeType = cabecera.split(";")[0] || "application/octet-stream";
  return { mimeType, data: dataUrl.slice(coma + 1) };
}

function cargarImagen(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("El archivo no es una imagen válida"));
    img.src = dataUrl;
  });
}

/**
 * Convierte un archivo o un blob del portapapeles en base64 listo para enviar.
 * Redimensiona y recomprime a WebP cuando la imagen es grande; los GIF se dejan
 * intactos para no perder la animación.
 */
export async function prepararImagen(file: Blob): Promise<ImagenPreparada> {
  if (!esTipoAceptado(file.type)) {
    throw new Error("Formato no permitido. Usa PNG, JPG, WebP o GIF");
  }

  const dataUrlOriginal = await leerComoDataUrl(file);

  const necesitaProceso =
    file.type !== "image/gif" && file.size > UMBRAL_RECOMPRESION;

  if (!necesitaProceso) {
    const { data } = separarDataUrl(dataUrlOriginal);
    return { mimeType: file.type, data, tamano: file.size };
  }

  try {
    const img = await cargarImagen(dataUrlOriginal);
    const escala = Math.min(1, LADO_MAXIMO / Math.max(img.width, img.height));
    const ancho = Math.max(1, Math.round(img.width * escala));
    const alto = Math.max(1, Math.round(img.height * escala));

    const canvas = document.createElement("canvas");
    canvas.width = ancho;
    canvas.height = alto;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Sin contexto de canvas");
    ctx.drawImage(img, 0, 0, ancho, alto);

    const dataUrlComprimido = canvas.toDataURL("image/webp", 0.85);
    const { mimeType, data } = separarDataUrl(dataUrlComprimido);

    // Si el navegador no soporta WebP, toDataURL devuelve PNG: se acepta igual
    // siempre que el resultado pese menos que el original.
    if (!esTipoAceptado(mimeType)) {
      const original = separarDataUrl(dataUrlOriginal);
      return { mimeType: file.type, data: original.data, tamano: file.size };
    }

    const tamano = Math.floor((data.length * 3) / 4);
    if (tamano >= file.size) {
      const original = separarDataUrl(dataUrlOriginal);
      return { mimeType: file.type, data: original.data, tamano: file.size };
    }

    return { mimeType, data, tamano };
  } catch {
    // Si algo falla al recomprimir, se envía el original.
    const { data } = separarDataUrl(dataUrlOriginal);
    return { mimeType: file.type, data, tamano: file.size };
  }
}

/** Formatea bytes para mostrarlos al usuario. */
export function formatearTamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
