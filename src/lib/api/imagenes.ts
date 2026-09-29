// Llamadas del navegador a los endpoints de imágenes de una sesión.

const MENSAJE_ORDEN_NO_GUARDADO =
  "No se pudo guardar el nuevo orden de las fotos; siguen como estaban. Vuelve a intentarlo en unos minutos.";

/**
 * Manda el orden completo de las fotos de una sesión.
 *
 * Se envía la lista entera y no "mueve la foto X": la petición es idempotente
 * —reintentarla no descoloca nada— y el servidor puede comprobar que quien
 * ordena estaba viendo las mismas fotos que hay ahora mismo en la base.
 */
export async function reordenarImagenes(
  claseId: string,
  orden: readonly string[],
): Promise<void> {
  const res = await fetch(`/api/clases/${claseId}/imagenes/orden`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orden }),
  });

  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json?.error ?? MENSAJE_ORDEN_NO_GUARDADO);
  }
}
