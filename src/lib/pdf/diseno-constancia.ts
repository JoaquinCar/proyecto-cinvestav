// ─────────────────────────────────────────────────────────────────────────────
// EL ARTE DE LA CONSTANCIA VIVE AQUÍ — Y SOLO AQUÍ.
//
// El cliente todavía no ha entregado la imagen de fondo ni las firmas. Lo que
// se imprime hoy es un diseño DE RELLENO, y sale marcado como tal en el propio
// PDF para que nadie entregue por error un documento provisional.
//
// ── Cuando lleguen los materiales ───────────────────────────────────────────
//
//   1. Copia los archivos a `public/constancia/`:
//        public/constancia/fondo.png        ← imagen de fondo (tamaño carta)
//        public/constancia/firma-<quien>.png ← firmas escaneadas, fondo
//                                              transparente
//   2. En este archivo, y en ningún otro:
//        · `fondo`      → archivoDeConstancia("fondo.png")
//        · `firmas`     → un objeto por firmante (nombre, cargo, imagen)
//        · `textos`     → el texto oficial que mande el cliente
//        · `colores`    → la paleta del arte, para que el texto se lea encima
//        · `provisional`→ false  (esto apaga la marca de agua)
//   3. Nada más. `src/lib/pdf/constancia.tsx` no se toca: ya sabe pintar fondo,
//      firmas y marca de agua; lo único que hace es leer estas constantes.
//
// Si el arte trae el texto incrustado en la imagen y solo hay que superponer el
// nombre del niño, vacía `textos.cuerpo` y ajusta `posicionNombre`.
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from "node:fs";
import { join } from "node:path";

export type FirmaConstancia = {
  /** Nombre que se imprime bajo la línea de firma. */
  nombre: string;
  /** Cargo, en una línea. */
  cargo: string;
  /**
   * Firma escaneada, como data URI o ruta absoluta legible por el servidor.
   * `null` imprime solo la línea, para firmar a mano.
   */
  imagen?: string | null;
};

export type DisenoConstancia = {
  /**
   * `true` mientras el arte definitivo no llegue. Pinta la marca de agua y la
   * nota al pie que avisan de que el documento no es el final.
   */
  provisional: boolean;
  /** Imagen de fondo a sangre (tamaño carta). `null` = fondo blanco. */
  fondo: string | null;
  /** Bloques de firma, de izquierda a derecha. Lista vacía = sin firmas. */
  firmas: FirmaConstancia[];
  colores: {
    titulo: string;
    texto: string;
    tenue: string;
    linea: string;
    marca: string;
  };
  textos: {
    titulo: string;
    subtitulo: string;
    /** Párrafo central. Recibe los datos del niño ya formateados. */
    cuerpo: (d: {
      nombreCompleto: string;
      grado: string;
      escuela: string;
      edicion: string;
    }) => string;
    pie: string;
  };
  /** Margen interior de la página, en puntos. */
  margen: number;
  /**
   * Detalle administrativo (escuela, grado, asistencias, fecha de emisión).
   * El arte definitivo casi seguro no lo quiere: ponlo en `false` y desaparece.
   */
  mostrarTablaDatos: boolean;
};

/** Texto exacto de la marca de agua. Exportado para poder afirmarlo en pruebas. */
export const AVISO_PROVISIONAL = "DISEÑO PROVISIONAL — PENDIENTE DEL ARTE FINAL";

export const NOTA_PROVISIONAL =
  "Este documento usa un diseño provisional mientras se recibe el arte definitivo (imagen de fondo y firmas).";

/**
 * Lee un archivo de `public/constancia/` y lo devuelve como data URI, que es lo
 * que entiende el generador de PDF sin salir a la red. Sin uso todavía: es la
 * herramienta para el día en que lleguen el fondo y las firmas.
 */
export function archivoDeConstancia(nombre: string): string {
  const ruta = join(process.cwd(), "public", "constancia", nombre);
  let datos: Buffer;
  try {
    datos = readFileSync(ruta);
  } catch {
    throw new Error(
      `Falta el archivo de la constancia "${nombre}". Debe estar en public/constancia/ ` +
        "junto al resto del arte del documento.",
    );
  }
  const tipo = nombre.endsWith(".jpg") || nombre.endsWith(".jpeg")
    ? "image/jpeg"
    : "image/png";
  return `data:${tipo};base64,${datos.toString("base64")}`;
}

// ── El diseño vigente ─────────────────────────────────────────────────────────

export const DISENO_CONSTANCIA: DisenoConstancia = {
  provisional: true,
  fondo: null,
  firmas: [],
  colores: {
    titulo: "#1a1a2e",
    texto: "#333333",
    tenue: "#888888",
    linea: "#cccccc",
    marca: "#c0392b",
  },
  textos: {
    titulo: "Constancia de Participación",
    subtitulo: "Programa Pasaporte Científico · CINVESTAV Unidad Mérida",
    cuerpo: ({ nombreCompleto, grado, escuela, edicion }) =>
      `Se hace constar que ${nombreCompleto}, alumno(a) de ${grado} de la escuela ` +
      `${escuela}, participó en la edición ${edicion} del programa Pasaporte ` +
      `Científico de CINVESTAV Unidad Mérida.`,
    pie: "CINVESTAV Unidad Mérida · Pasaporte Científico · Documento generado electrónicamente",
  },
  margen: 60,
  mostrarTablaDatos: true,
};

/** La leyenda de provisional, o `null` cuando el arte ya es el definitivo. */
export function marcaProvisional(diseno: DisenoConstancia): string | null {
  return diseno.provisional ? AVISO_PROVISIONAL : null;
}
