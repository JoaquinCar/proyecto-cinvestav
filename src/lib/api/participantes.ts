// Llamadas del cliente al API de registro / inscripción.
// Viven fuera del componente para poder probarlas: el alta de un niño nuevo son
// DOS pasos (crear participante → inscribirlo en la edición) y si el primero no
// devuelve el id correcto, el niño queda creado pero sin inscripción.

import type {
  ParticipanteInput,
  EditarParticipanteInput,
} from "@/lib/schemas/participante.schema";
import type { Participante } from "@/components/participantes/BusquedaParticipante";
import { MENSAJE_SIN_CONEXION } from "@/lib/api/errores";

async function leerError(res: Response, porDefecto: string): Promise<never> {
  const err = await res.json().catch(() => ({}));
  throw new Error(err.error ?? porDefecto);
}

/**
 * `fetch` solo rechaza cuando la petición ni siquiera salió. Ese error llega con
 * un texto en inglés del navegador que no sirve de nada en pantalla: se cambia
 * aquí, una sola vez, por uno que diga qué revisar.
 */
async function pedir(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch {
    throw new Error(MENSAJE_SIN_CONEXION);
  }
}

/**
 * POST /api/participantes — crea un participante GLOBAL (sin edición todavía).
 * La respuesta viene envuelta como { participante: {...} }.
 */
export async function crearParticipante(
  data: ParticipanteInput,
): Promise<Participante> {
  const res = await pedir("/api/participantes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    await leerError(
      res,
      "No se pudo guardar la ficha del participante. Vuelve a intentarlo en unos minutos.",
    );
  }

  const json = await res.json();
  return json.participante as Participante;
}

/**
 * POST /api/inscripciones — liga un participante existente a una edición.
 * Es el mismo camino para un niño nuevo y para uno que repite: cambia la
 * Inscripcion, nunca el Participante.
 */
export async function crearInscripcion(
  participanteId: string,
  edicionId: string,
) {
  const res = await pedir("/api/inscripciones", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ participanteId, edicionId }),
  });
  if (!res.ok) {
    await leerError(
      res,
      "No se pudo inscribir al participante en esta edición. Vuelve a intentarlo en unos minutos.",
    );
  }

  return res.json();
}

/**
 * PUT /api/participantes/[id] — corrige los datos del niño (solo ADMIN).
 * Admite cuerpo parcial: solo lo que cambió.
 */
export async function editarParticipante(
  id: string,
  data: EditarParticipanteInput,
): Promise<Participante> {
  const res = await pedir(`/api/participantes/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    await leerError(
      res,
      "No se pudieron guardar los cambios; los datos del participante siguen como estaban. Vuelve a intentarlo en unos minutos.",
    );
  }

  const json = await res.json();
  return json.participante as Participante;
}

/**
 * DELETE /api/participantes/[id] — elimina la ficha del niño (solo ADMIN).
 * El servidor la rechaza con 409 si conserva inscripciones o asistencias; el
 * mensaje de ese 409 llega tal cual en el Error para poder mostrarlo.
 */
export async function eliminarParticipante(id: string): Promise<void> {
  const res = await pedir(`/api/participantes/${id}`, { method: "DELETE" });
  if (res.status === 204) return;
  await leerError(
    res,
    "No se pudo eliminar al participante; su ficha sigue registrada. Vuelve a intentarlo en unos minutos.",
  );
}

/**
 * DELETE /api/inscripciones/[id] — da de baja al niño de una edición.
 * Sin `forzar`, el servidor rechaza la baja si hay asistencias registradas y
 * devuelve el conteo; con `forzar` borra ese historial en una transacción.
 */
export async function darDeBajaInscripcion(
  inscripcionId: string,
  forzar = false,
): Promise<void> {
  const url = `/api/inscripciones/${inscripcionId}${forzar ? "?forzar=true" : ""}`;
  const res = await pedir(url, { method: "DELETE" });
  if (res.status === 204) return;
  await leerError(
    res,
    "No se pudo dar de baja al participante; sigue inscrito en la edición. Vuelve a intentarlo en unos minutos.",
  );
}
