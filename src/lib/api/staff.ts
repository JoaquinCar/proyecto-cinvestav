// Llamadas del cliente al API de staff.
//
// Fuera de los componentes por lo mismo que `lib/api/acompanantes.ts`: aquí es
// donde se decide entre REUTILIZAR una ficha y crear una nueva, y equivocarse
// en eso llena la base de becarios duplicados sin que se note hasta que alguien
// imprime la lista.

import type { StaffInput, RolStaff } from "@/lib/schemas/staff.schema";
import { MENSAJE_SIN_CONEXION } from "@/lib/api/errores";

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface Staff {
  id:          string;
  nombre:      string;
  apellidos:   string | null;
  telefono:    string | null;
  correo:      string | null;
  rol:         RolStaff;
  institucion: string | null;
  /** En cuántas sesiones participa. Lo devuelve el buscador. */
  _count?: { sesiones: number };
}

/** Alguien que ya existe, o alguien por crear. Nunca las dos cosas. */
export type EleccionStaff =
  | { staffId: string; staff?: never }
  | { staffId?: never; staff: StaffInput };

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

export async function buscarStaff(q: string): Promise<Staff[]> {
  const res = await pedir(`/api/staff?${new URLSearchParams({ q })}`);
  if (!res.ok) {
    await leerError(
      res,
      "No se pudo buscar entre el staff. Revisa tu conexión y vuelve a intentarlo.",
    );
  }
  const json = await res.json();
  return (json.staff ?? []) as Staff[];
}

// ── Asignar a una sesión ──────────────────────────────────────────────────────
// `claseId` es el id de lo que en pantalla se llama «sesión».

export async function asignarStaff(
  claseId: string,
  eleccion: EleccionStaff,
): Promise<Staff> {
  const res = await pedir(`/api/clases/${claseId}/staff`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(eleccion),
  });
  if (!res.ok) {
    await leerError(
      res,
      "No se pudo asignar a esta persona; la sesión sigue como estaba. Vuelve a intentarlo en unos minutos.",
    );
  }
  const json = await res.json();
  return json.asignacion.staff as Staff;
}

// ── Quitar de una sesión ──────────────────────────────────────────────────────
// Solo desasigna: la ficha sigue ahí, porque la persona suele estar en más
// sesiones y porque el año que viene se reutiliza.

export async function quitarStaff(
  claseId: string,
  staffId: string,
): Promise<void> {
  const res = await pedir(`/api/clases/${claseId}/staff/${staffId}`, {
    method: "DELETE",
  });
  if (res.status === 204) return;
  await leerError(
    res,
    "No se pudo quitar a esta persona; la sesión sigue como estaba. Vuelve a intentarlo en unos minutos.",
  );
}
