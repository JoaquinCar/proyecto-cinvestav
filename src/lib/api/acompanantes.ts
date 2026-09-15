// Llamadas del cliente al API de acompañantes.
//
// Fuera de los componentes por lo mismo que `lib/api/participantes.ts`: aquí es
// donde se decide entre REUTILIZAR una ficha y crear una nueva, y equivocarse
// en eso llena la base de adultos duplicados sin que se note.

import type { AcompananteInput, Parentesco } from "@/lib/schemas/acompanante.schema";
import { MENSAJE_SIN_CONEXION } from "@/lib/api/errores";

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface Acompanante {
  id:         string;
  nombre:     string;
  apellidos:  string | null;
  telefono:   string | null;
  correo:     string | null;
  parentesco: Parentesco;
  /** A cuántas inscripciones está ligado: los 2 hermanos, los 25 del grupo. */
  _count?: { inscripciones: number };
}

/** Un acompañante ya capturado, o uno por crear. Nunca las dos cosas. */
export type EleccionAcompanante =
  | { acompananteId: string; acompanante?: never }
  | { acompananteId?: never; acompanante: AcompananteInput };

// ── Infraestructura compartida ────────────────────────────────────────────────

async function leerError(res: Response, porDefecto: string): Promise<never> {
  const err = await res.json().catch(() => ({}));
  throw new Error(err.error ?? porDefecto);
}

async function pedir(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch {
    throw new Error(MENSAJE_SIN_CONEXION);
  }
}

// ── Buscar para reutilizar ────────────────────────────────────────────────────

export async function buscarAcompanantes(q: string): Promise<Acompanante[]> {
  const res = await pedir(`/api/acompanantes?${new URLSearchParams({ q })}`);
  if (!res.ok) {
    await leerError(
      res,
      "No se pudo buscar entre los acompañantes. Revisa tu conexión y vuelve a intentarlo.",
    );
  }
  const json = await res.json();
  return (json.acompanantes ?? []) as Acompanante[];
}

// ── Asignar o cambiar el de una inscripción ───────────────────────────────────

export async function asignarAcompanante(
  inscripcionId: string,
  eleccion: EleccionAcompanante,
): Promise<Acompanante> {
  const res = await pedir(`/api/inscripciones/${inscripcionId}/acompanante`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(eleccion),
  });
  if (!res.ok) {
    await leerError(
      res,
      "No se pudo guardar el acompañante; la inscripción sigue como estaba. Vuelve a intentarlo en unos minutos.",
    );
  }
  const json = await res.json();
  return json.inscripcion.acompanante as Acompanante;
}

// ── Quitarlo de una inscripción ───────────────────────────────────────────────
// Solo desliga: la ficha del acompañante sigue ahí, porque suele acompañar a
// más niños y porque el año que viene se reutiliza.

export async function quitarAcompanante(inscripcionId: string): Promise<void> {
  const res = await pedir(`/api/inscripciones/${inscripcionId}/acompanante`, {
    method: "DELETE",
  });
  if (res.status === 204) return;
  await leerError(
    res,
    "No se pudo quitar el acompañante; la inscripción sigue como estaba. Vuelve a intentarlo en unos minutos.",
  );
}
