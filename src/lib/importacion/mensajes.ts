// Cómo se le CUENTA al organizador lo que le pasa a su archivo.
//
// Vive aparte de los componentes porque es lo único de la vista previa que se
// puede equivocar en silencio: el detalle fila por fila ya dice la columna y el
// número de fila, pero el titular es lo primero (y a veces lo único) que se
// lee. Un titular que dice «1 fila con problemas» cuando lo que falta es una
// columna entera manda al organizador a buscar la fila 1 de su hoja, donde no
// hay nada que arreglar.

import type { Incidencia } from "./parseo";

/**
 * Titular del recuadro rojo de la vista previa.
 * 1 → «1 error que impide importar»; 3 → «3 errores que impiden importar».
 */
export function tituloDeErrores(cantidad: number): string {
  return cantidad === 1
    ? "1 error que impide importar"
    : `${cantidad} errores que impiden importar`;
}

/**
 * Aviso emergente tras analizar. Distingue los problemas de FILA —que se
 * corrigen celda por celda— de los que afectan al archivo entero (una columna
 * obligatoria que falta, una hoja sin datos), que no tienen número de fila y
 * no se arreglan mirando ninguna.
 */
export function avisoDeErrores(errores: Incidencia[]): string {
  const total = errores.length;
  const deFila = errores.filter((e) => e.fila !== null).length;
  const cola = "Revisa el detalle que aparece abajo.";

  if (deFila === total) {
    return total === 1
      ? `El archivo tiene 1 fila con problemas y no se importará hasta corregirla. ${cola}`
      : `El archivo tiene ${total} filas con problemas y no se importará hasta corregirlas. ${cola}`;
  }
  if (deFila === 0) {
    return total === 1
      ? `El archivo no se puede importar tal como está. ${cola}`
      : `El archivo no se puede importar tal como está: ${total} problemas. ${cola}`;
  }
  return `El archivo tiene ${total} problemas (${deFila} en filas concretas y el resto en el archivo entero) y no se importará hasta corregirlos. ${cola}`;
}
