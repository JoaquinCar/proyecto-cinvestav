import { deflateRawSync, inflateRawSync } from "node:zlib";

// ─────────────────────────────────────────────────────────────────────────────
// ZIP mínimo — lo justo para abrir un .docx, cambiarle cosas y volver a cerrarlo.
//
// POR QUÉ NO UNA LIBRERÍA
//
// Un .docx es un ZIP. En `node_modules` hay `fflate` y `pako`, pero llegaron
// como dependencias TRANSITIVAS de otro paquete: no están en `package.json`, así
// que nadie garantiza que sigan ahí tras el próximo `npm install`, e importarlas
// sería depender de un detalle del árbol de dependencias ajeno. Añadir una
// dependencia nueva para esto tampoco compensa: de todo un ZIP solo hacen falta
// dos cosas —leer entradas y escribirlas—, y son ~120 líneas contra `node:zlib`,
// que ya trae el (in|de)flate de verdad.
//
// LO QUE ESTE MÓDULO *NO* HACE, A PROPÓSITO
//
//   · ZIP64 (archivos > 4 GB o > 65535 entradas). Un informe son ~20 fotos.
//   · Cifrado, multi-volumen, comentarios de archivo.
//   · Nombres que no sean UTF-8 sin BOM.
//
// Cualquiera de esos casos hace que `leerZip` lance. Es lo correcto: es mejor
// fallar al abrir la plantilla que producir un .docx que Word no abre.
// ─────────────────────────────────────────────────────────────────────────────

const FIRMA_CABECERA_LOCAL = 0x04034b50;
const FIRMA_DIRECTORIO = 0x02014b50;
const FIRMA_FIN_DIRECTORIO = 0x06054b50;

/** Sin comprimir. */
const METODO_ALMACENADO = 0;
/** Deflate. Es lo que usa Word para casi todo menos las imágenes ya comprimidas. */
const METODO_DEFLATE = 8;

/**
 * Fecha y hora fijas (1980-01-01 00:00), no `new Date()`.
 *
 * Dos exportaciones de la misma sesión tienen que dar el mismo archivo byte a
 * byte. Con la hora real no lo harían, y entonces ninguna prueba podría
 * comparar dos documentos, ni `git` podría decir si la plantilla cambió de
 * verdad o solo se volvió a generar.
 */
const FECHA_DOS = 0x0021;
const HORA_DOS = 0x0000;

export type EntradaZip = {
  nombre: string;
  datos: Buffer;
};

// ── CRC-32 ────────────────────────────────────────────────────────────────────

const TABLA_CRC = (() => {
  const tabla = new Int32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let bit = 0; bit < 8; bit += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    tabla[i] = c;
  }
  return tabla;
})();

export function crc32(datos: Buffer): number {
  let c = -1;
  for (let i = 0; i < datos.length; i += 1) {
    c = TABLA_CRC[(c ^ datos[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ -1) >>> 0;
}

// ── Lectura ───────────────────────────────────────────────────────────────────

/**
 * Abre un ZIP y devuelve sus entradas EN EL ORDEN del directorio central.
 *
 * El orden importa: al volver a escribir se conserva, y `[Content_Types].xml`
 * primero es lo que espera cualquier lector de OPC estricto.
 */
export function leerZip(buffer: Buffer): EntradaZip[] {
  const finDirectorio = buscarFinDeDirectorio(buffer);

  const totalEntradas = buffer.readUInt16LE(finDirectorio + 10);
  const inicioDirectorio = buffer.readUInt32LE(finDirectorio + 16);

  const entradas: EntradaZip[] = [];
  let posicion = inicioDirectorio;

  for (let i = 0; i < totalEntradas; i += 1) {
    if (buffer.readUInt32LE(posicion) !== FIRMA_DIRECTORIO) {
      throw new Error("ZIP corrupto: falta una entrada del directorio central");
    }

    const metodo = buffer.readUInt16LE(posicion + 10);
    const tamanoComprimido = buffer.readUInt32LE(posicion + 20);
    const tamanoOriginal = buffer.readUInt32LE(posicion + 24);
    const largoNombre = buffer.readUInt16LE(posicion + 28);
    const largoExtra = buffer.readUInt16LE(posicion + 30);
    const largoComentario = buffer.readUInt16LE(posicion + 32);
    const desplazamientoLocal = buffer.readUInt32LE(posicion + 42);
    const nombre = buffer.toString("utf8", posicion + 46, posicion + 46 + largoNombre);

    if (buffer.readUInt32LE(desplazamientoLocal) !== FIRMA_CABECERA_LOCAL) {
      throw new Error(`ZIP corrupto: cabecera local ilegible en ${nombre}`);
    }

    // El nombre y el «extra» de la cabecera LOCAL pueden tener longitudes
    // distintas de las del directorio central, así que se releen aquí.
    const largoNombreLocal = buffer.readUInt16LE(desplazamientoLocal + 26);
    const largoExtraLocal = buffer.readUInt16LE(desplazamientoLocal + 28);
    const inicioDatos =
      desplazamientoLocal + 30 + largoNombreLocal + largoExtraLocal;

    const crudo = buffer.subarray(inicioDatos, inicioDatos + tamanoComprimido);

    let datos: Buffer;
    if (metodo === METODO_ALMACENADO) {
      datos = Buffer.from(crudo);
    } else if (metodo === METODO_DEFLATE) {
      datos = inflateRawSync(crudo);
    } else {
      throw new Error(`ZIP con método de compresión no soportado (${metodo}) en ${nombre}`);
    }

    if (datos.length !== tamanoOriginal) {
      throw new Error(`ZIP corrupto: ${nombre} no mide lo que dice medir`);
    }

    entradas.push({ nombre, datos });
    posicion += 46 + largoNombre + largoExtra + largoComentario;
  }

  return entradas;
}

/**
 * Localiza el fin del directorio central.
 *
 * Se busca hacia atrás porque el registro lleva al final un comentario de
 * longitud variable. 64 KB es el máximo que ese comentario puede medir, así que
 * más allá no hace falta mirar.
 */
function buscarFinDeDirectorio(buffer: Buffer): number {
  const minimo = Math.max(0, buffer.length - 0xffff - 22);
  for (let i = buffer.length - 22; i >= minimo; i -= 1) {
    if (buffer.readUInt32LE(i) === FIRMA_FIN_DIRECTORIO) return i;
  }
  throw new Error("No parece un ZIP: no se encontró el directorio central");
}

// ── Escritura ─────────────────────────────────────────────────────────────────

/** Vuelve a empaquetar las entradas en un ZIP nuevo. */
export function escribirZip(entradas: EntradaZip[]): Buffer {
  const locales: Buffer[] = [];
  const centrales: Buffer[] = [];
  let desplazamiento = 0;

  for (const entrada of entradas) {
    const nombre = Buffer.from(entrada.nombre, "utf8");
    const suma = crc32(entrada.datos);

    // Las imágenes (PNG/JPEG) ya vienen comprimidas: volver a deflactarlas
    // gasta CPU para crecer unos bytes. Se guardan tal cual cuando el deflate
    // no gana nada.
    const comprimido = deflateRawSync(entrada.datos, { level: 6 });
    const usarDeflate = comprimido.length < entrada.datos.length;
    const cuerpo = usarDeflate ? comprimido : entrada.datos;
    const metodo = usarDeflate ? METODO_DEFLATE : METODO_ALMACENADO;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(FIRMA_CABECERA_LOCAL, 0);
    local.writeUInt16LE(20, 4); // versión necesaria: 2.0
    local.writeUInt16LE(0, 6); // sin banderas
    local.writeUInt16LE(metodo, 8);
    local.writeUInt16LE(HORA_DOS, 10);
    local.writeUInt16LE(FECHA_DOS, 12);
    local.writeUInt32LE(suma, 14);
    local.writeUInt32LE(cuerpo.length, 18);
    local.writeUInt32LE(entrada.datos.length, 22);
    local.writeUInt16LE(nombre.length, 26);
    local.writeUInt16LE(0, 28);

    locales.push(local, nombre, cuerpo);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(FIRMA_DIRECTORIO, 0);
    central.writeUInt16LE(20, 4); // creado por 2.0
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(metodo, 10);
    central.writeUInt16LE(HORA_DOS, 12);
    central.writeUInt16LE(FECHA_DOS, 14);
    central.writeUInt32LE(suma, 16);
    central.writeUInt32LE(cuerpo.length, 20);
    central.writeUInt32LE(entrada.datos.length, 24);
    central.writeUInt16LE(nombre.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(desplazamiento, 42);

    centrales.push(central, nombre);

    desplazamiento += local.length + nombre.length + cuerpo.length;
  }

  const directorio = Buffer.concat(centrales);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(FIRMA_FIN_DIRECTORIO, 0);
  fin.writeUInt16LE(0, 4);
  fin.writeUInt16LE(0, 6);
  fin.writeUInt16LE(entradas.length, 8);
  fin.writeUInt16LE(entradas.length, 10);
  fin.writeUInt32LE(directorio.length, 12);
  fin.writeUInt32LE(desplazamiento, 16);
  fin.writeUInt16LE(0, 20);

  return Buffer.concat([...locales, directorio, fin]);
}
