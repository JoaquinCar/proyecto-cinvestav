// Llamadas del cliente al API de registro / inscripción.
// Viven fuera del componente para poder probarlas: el alta de un niño nuevo son
// DOS pasos (crear participante → inscribirlo en la edición) y si el primero no
// devuelve el id correcto, el niño queda creado pero sin inscripción.

import type {
  ParticipanteInput,
  EditarParticipanteInput,
} from "@/lib/schemas/participante.schema";
import type { Participante } from "@/components/participantes/BusquedaParticipante";

async function leerError(res: Response, porDefecto: string): Promise<never> {
  const err = await res.json().catch(() => ({}));
  throw new Error(err.error ?? porDefecto);
}

/**
 * POST /api/participantes — crea un participante GLOBAL (sin edición todavía).
 * La respuesta viene envuelta como { participante: {...} }.
 */
export async function crearParticipante(
  data: ParticipanteInput,
): Promise<Participante> {
  const res = await fetch("/api/participantes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) await leerError(res, "Error al crear participante");

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
  const res = await fetch("/api/inscripciones", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ participanteId, edicionId }),
  });
  if (!res.ok) await leerError(res, "Error al inscribir participante");

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
  const res = await fetch(`/api/participantes/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) await leerError(res, "Error al guardar los cambios");

  const json = await res.json();
  return json.participante as Participante;
}

/**
 * DELETE /api/participantes/[id] — elimina la ficha del niño (solo ADMIN).
 * El servidor la rechaza con 409 si conserva inscripciones o asistencias; el
 * mensaje de ese 409 llega tal cual en el Error para poder mostrarlo.
 */
export async function eliminarParticipante(id: string): Promise<void> {
  const res = await fetch(`/api/participantes/${id}`, { method: "DELETE" });
  if (res.status === 204) return;
  await leerError(res, "Error al eliminar el participante");
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
  const res = await fetch(url, { method: "DELETE" });
  if (res.status === 204) return;
  await leerError(res, "Error al dar de baja la inscripción");
}
