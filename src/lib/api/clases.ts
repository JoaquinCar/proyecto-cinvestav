// Llamadas del cliente al API de sesiones (el modelo `Clase`).
//
// Vive fuera del componente porque borrar una sesión tiene DOS pasos y el de
// en medio es el importante: el servidor puede responder 409 con los conteos
// de lo que se perdería, y la pantalla tiene que poder distinguir ese caso
// —"falta confirmar"— de un fallo de verdad. Devolver eso como una excepción
// obligaría a adivinarlo leyendo el texto del mensaje.

import { MENSAJE_SIN_CONEXION } from "@/lib/api/errores";

/** Lo que el borrado arrastraría consigo, tal como lo cuenta el servidor. */
export interface ConteosDeBorrado {
  fechas:        number;
  asistencias:   number;
  participantes: number;
  resumenes:     number;
  imagenes:      number;
}

export type ResultadoBorrarClase =
  | { estado: "borrada" }
  | { estado: "necesitaConfirmacion"; mensaje: string; conteos: ConteosDeBorrado };

const CONTEOS_VACIOS: ConteosDeBorrado = {
  fechas:        0,
  asistencias:   0,
  participantes: 0,
  resumenes:     0,
  imagenes:      0,
};

/**
 * DELETE /api/clases/[id] — elimina la sesión (solo ADMIN).
 *
 * Sin `forzar`, el servidor rechaza con 409 si la sesión tiene asistencias o
 * resúmenes importados, y devuelve los conteos para poder preguntarlo. Con
 * `forzar`, borra también ese historial, en una sola transacción.
 */
export async function eliminarClase(
  claseId: string,
  forzar = false,
): Promise<ResultadoBorrarClase> {
  let res: Response;
  try {
    res = await fetch(`/api/clases/${claseId}${forzar ? "?forzar=true" : ""}`, {
      method: "DELETE",
    });
  } catch {
    throw new Error(`${MENSAJE_SIN_CONEXION} La sesión sigue como estaba.`);
  }

  if (res.status === 204) return { estado: "borrada" };

  const cuerpo = await res.json().catch(() => ({}));

  if (res.status === 409 && cuerpo?.conteos) {
    return {
      estado:   "necesitaConfirmacion",
      mensaje:  cuerpo.error ?? "Esta sesión tiene historial de asistencia.",
      conteos:  { ...CONTEOS_VACIOS, ...cuerpo.conteos },
    };
  }

  throw new Error(
    cuerpo?.error ??
      "No se pudo eliminar la sesión; sigue como estaba. Vuelve a intentarlo en unos minutos.",
  );
}
