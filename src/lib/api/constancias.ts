// Llamadas del cliente al API de constancias.
//
// Vive fuera del componente por la misma razón que `api/participantes.ts`: el
// panel de constancias hace la misma llamada desde tres sitios (fila, barra de
// selección y diálogo) y el texto de los fallos tiene que ser uno solo.

import { MENSAJE_SIN_CONEXION } from "@/lib/api/errores";

async function pedir(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch {
    throw new Error(MENSAJE_SIN_CONEXION);
  }
}

async function leerError(res: Response, porDefecto: string): Promise<never> {
  const err = await res.json().catch(() => ({}));
  throw new Error(err.error ?? porDefecto);
}

/**
 * PUT /api/constancias/exclusiones — quita o devuelve el derecho a constancia.
 * Admite uno o muchos: el caso individual es una lista de uno.
 */
export async function cambiarExclusionConstancia(params: {
  inscripcionIds: string[];
  excluida: boolean;
  motivo?: string | null;
}): Promise<{ actualizadas: number }> {
  const res = await pedir("/api/constancias/exclusiones", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      inscripcionIds: params.inscripcionIds,
      excluida: params.excluida,
      motivo: params.motivo ?? null,
    }),
  });

  if (!res.ok) {
    await leerError(
      res,
      params.excluida
        ? "No se pudo registrar la exclusión y nada quedó guardado. Vuelve a intentarlo en unos minutos."
        : "No se pudo reincorporar a los participantes y nada quedó guardado. Vuelve a intentarlo en unos minutos.",
    );
  }

  return (await res.json()) as { actualizadas: number };
}

/** POST /api/pdf/constancia/[id] — arma el PDF y lo guarda. */
export async function generarConstancia(
  inscripcionId: string,
): Promise<{ url: string }> {
  const res = await pedir(`/api/pdf/constancia/${inscripcionId}`, {
    method: "POST",
  });

  if (!res.ok) {
    await leerError(
      res,
      "No se pudo generar la constancia y no quedó guardada. Vuelve a intentarlo en unos minutos.",
    );
  }

  return (await res.json()) as { url: string };
}
