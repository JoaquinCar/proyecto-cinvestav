// Traducción de fallos de red y de respuestas del API a texto que pueda leer
// quien opera la app en campo.
//
// `fetch` solo rechaza cuando la petición ni siquiera salió (sin señal, el
// servidor caído, el túnel cerrado). Ese caso llega como un TypeError con un
// mensaje en inglés — "Failed to fetch", "Load failed" — que no se puede
// mostrar tal cual: se sustituye por uno que diga qué revisar.

export const MENSAJE_SIN_CONEXION =
  "No se pudo contactar al servidor. Revisa tu conexión a internet y vuelve a intentarlo.";

/** Fallos de red: el navegador nunca llegó a hablar con el servidor. */
export function esFalloDeRed(error: unknown): boolean {
  return error instanceof TypeError;
}

/**
 * Texto a mostrar para un error cualquiera.
 *
 * - Si es un fallo de red, avisa de la conexión.
 * - Si es un Error con mensaje (normalmente el que mandó el API), lo respeta:
 *   el servidor ya sabe más del caso concreto que el componente.
 * - Si no, cae en `porDefecto`, que debe describir la acción que no se completó.
 */
export function mensajeDeError(error: unknown, porDefecto: string): string {
  if (esFalloDeRed(error)) return MENSAJE_SIN_CONEXION;
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return porDefecto;
}

/**
 * Encadena el motivo que dio el servidor dentro de una frase, sin dejar una
 * mayúscula suelta a mitad de oración ni dos puntos finales seguidos.
 */
export function comoMotivo(texto: string): string {
  const limpio = texto.trim();
  if (limpio.length === 0) return limpio;
  const conPunto = /[.!?]$/.test(limpio) ? limpio : `${limpio}.`;
  return conPunto.charAt(0).toLowerCase() + conPunto.slice(1);
}

/**
 * "No se pudo <acción> a <quien>: <motivo>".
 *
 * El listón lo puso `eliminarClase`, que ya devolvía el motivo con conteos. Un
 * "Error al crear participante" no dice a quién ni por qué; esto sí.
 */
export function mensajeFalloAccion(
  accion: string,
  quien: string,
  motivo: string,
): string {
  return `No se pudo ${accion} a ${quien}: ${comoMotivo(motivo)}`;
}

/**
 * El alta de un niño nuevo son dos pasos: crear la ficha e inscribirla en la
 * edición. Si falla el segundo, la ficha YA quedó guardada. Decir "no se pudo
 * registrar" sería mentir, y llevaría a capturar al mismo niño por segunda vez.
 */
export function mensajeAltaSinInscripcion(
  nombreCompleto: string,
  motivo: string,
): string {
  return (
    `Se guardó la ficha de ${nombreCompleto}, pero no quedó inscrito en esta edición: ${comoMotivo(motivo)} ` +
    "Búscalo en el buscador de arriba e inscríbelo desde ahí; no lo captures de nuevo."
  );
}
