import { NextResponse } from "next/server";
import type { Role } from "@prisma/client";
import { auth } from "@/lib/auth";
import { reordenarImagenesSchema } from "@/lib/schemas/clase.schema";
import { obtenerClasePorId } from "@/server/queries/clases";
import {
  reordenarImagenesDeClase,
  OrdenImagenesInvalidoError,
} from "@/server/queries/imagenes-clase";
import {
  fallaInesperada,
  leerCuerpoJson,
  respuestaCamposInvalidos,
} from "@/server/respuestas";

type RouteContext = { params: Promise<{ id: string }> };

/** La sesión cuyas imágenes se reordenan ya no está. */
const CLASE_NO_ENCONTRADA =
  "Esta sesión ya no existe: alguien pudo eliminarla. Vuelve a la lista de sesiones para ver las que siguen activas.";

/**
 * Roles que pueden cambiar el orden de las fotos.
 *
 * Lista explícita, igual que en el resto de rutas de imágenes: un rol nuevo
 * entra sin permiso de escritura hasta que alguien lo añada a propósito.
 * READONLY consulta la biblioteca pero no la reordena — el orden alimenta el
 * reporte y es una decisión editorial de quien lo arma.
 */
const ROLES_CON_ESCRITURA: readonly Role[] = ["ADMIN", "BECARIO"];

/** Como el listado: describe el contenido de una sesión para quien la pide. */
const CACHE_LISTADO = "private, no-store";

// ── PATCH /api/clases/[id]/imagenes/orden — reordenar (ADMIN y BECARIO) ───────
//
// El cuerpo lleva la lista COMPLETA de ids en el orden deseado, no un
// movimiento suelto: así la petición es idempotente y el servidor puede
// rechazarla entera si esa lista ya no coincide con lo que hay en la sesión.

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    if (!ROLES_CON_ESCRITURA.includes(session.user.role)) {
      return NextResponse.json({ error: "Prohibido" }, { status: 403 });
    }

    const { id } = await context.params;

    const clase = await obtenerClasePorId(id);
    if (!clase) {
      return NextResponse.json({ error: CLASE_NO_ENCONTRADA }, { status: 404 });
    }

    const cuerpo = await leerCuerpoJson(request);
    if (!cuerpo.ok) return cuerpo.respuesta;

    const parsed = reordenarImagenesSchema.safeParse(cuerpo.datos);
    if (!parsed.success) {
      return respuestaCamposInvalidos(parsed.error);
    }

    const imagenes = await reordenarImagenesDeClase(id, parsed.data.orden);

    return NextResponse.json(imagenes, {
      headers: { "Cache-Control": CACHE_LISTADO },
    });
  } catch (error) {
    // No es un dato mal escrito, es una carrera: alguien subió o borró una foto
    // mientras esta persona tenía la galería abierta. 409, y el texto dice qué
    // hacer — nada quedó a medias, el orden anterior sigue intacto.
    if (error instanceof OrdenImagenesInvalidoError) {
      return NextResponse.json(
        {
          error:
            "Las fotos de esta sesión cambiaron mientras ordenabas: alguien pudo agregar o eliminar alguna. No se guardó nada; vuelve a cargar la página y ordénalas de nuevo.",
        },
        { status: 409 },
      );
    }

    return fallaInesperada(
      "PATCH /api/clases/[id]/imagenes/orden",
      error,
      "No se pudo guardar el nuevo orden de las fotos; siguen como estaban. Vuelve a intentarlo en unos minutos.",
    );
  }
}
