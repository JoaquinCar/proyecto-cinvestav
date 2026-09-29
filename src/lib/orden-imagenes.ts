// ─────────────────────────────────────────────────────────────────────────────
// Mover una foto dentro de la galería de una sesión.
//
// Aquí solo vive el cálculo: dada la lista de ids en el orden actual, devuelve
// la lista en el orden nuevo. No sabe de red ni de React, y por eso la UI puede
// pintar el resultado de inmediato (optimista) y mandar la lista completa al
// servidor después.
//
// Por qué botones y no arrastrar-soltar:
//
//   · La galería se consulta desde el teléfono. El arrastre táctil compite con
//     el scroll de la página — justo el gesto que hace falta cuando hay docenas
//     de fotos— y obliga a pulsaciones largas que nadie descubre solo.
//   · Con teclado y con lector de pantalla, arrastrar no existe: habría que
//     construir de todos modos un camino alterno, que es exactamente esto.
//   · «Subir/bajar» es reversible y se puede anunciar («Astronomía, foto 3 de
//     12; mover a la posición 2»), cosa que un arrastre no.
//
// «Al inicio» y «al final» son el complemento para galerías largas: llevar la
// foto 30 a la primera posición a base de toques sería absurdo.
// ─────────────────────────────────────────────────────────────────────────────

export type Movimiento = "subir" | "bajar" | "inicio" | "final";

/** Índice al que va la imagen, o `null` si el movimiento no cambia nada. */
function indiceDestino(
  ids: readonly string[],
  id: string,
  movimiento: Movimiento,
): number | null {
  const desde = ids.indexOf(id);
  if (desde === -1) return null;

  const hacia =
    movimiento === "subir"
      ? desde - 1
      : movimiento === "bajar"
        ? desde + 1
        : movimiento === "inicio"
          ? 0
          : ids.length - 1;

  if (hacia < 0 || hacia > ids.length - 1 || hacia === desde) return null;
  return hacia;
}

/**
 * Lista de ids con la imagen movida.
 *
 * Si el movimiento no cambia nada (la primera no puede subir, un id ajeno)
 * devuelve **la misma referencia**: quien llama lo usa para no mandar al
 * servidor un reordenado que no reordena nada.
 */
export function moverImagen(
  ids: readonly string[],
  id: string,
  movimiento: Movimiento,
): readonly string[] {
  const hacia = indiceDestino(ids, id, movimiento);
  if (hacia === null) return ids;

  const siguiente = [...ids];
  const [movida] = siguiente.splice(siguiente.indexOf(id), 1);
  siguiente.splice(hacia, 0, movida);
  return siguiente;
}

/**
 * Posición a la que iría la imagen, contada como la ve una persona (1 … n).
 * `null` cuando el movimiento no cambia nada. Se usa para el texto del botón
 * que lee el lector de pantalla.
 */
export function posicionDestino(
  ids: readonly string[],
  id: string,
  movimiento: Movimiento,
): number | null {
  const hacia = indiceDestino(ids, id, movimiento);
  return hacia === null ? null : hacia + 1;
}
