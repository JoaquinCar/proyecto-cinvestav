import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listarClasesDeEdicion } from "@/server/queries/clases";
import { existeEdicion } from "@/server/queries/ediciones";
import { tipoSesionSchema } from "@/lib/schemas/clase.schema";
import type { TipoSesion } from "@/lib/tipos-sesion";

type RouteContext = { params: Promise<{ id: string }> };

// ── GET /api/ediciones/[id]/clases — listar clases de una edición ─────────────
//
// `?tipo=` acota el listado a un tipo de actividad (PASAPORTE, LECTURA, EVENTO).
// Sin el parámetro salen todas, como siempre.

export async function GET(request: Request, context: RouteContext) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await context.params;

    // El tipo llega del querystring, así que se valida con el mismo Zod que el
    // resto: un valor inventado es 422, no una lista vacía que parece un error
    // de datos.
    const crudo = new URL(request.url).searchParams.get("tipo");
    let tipo: TipoSesion | undefined;
    if (crudo !== null) {
      const parsed = tipoSesionSchema.safeParse(crudo);
      if (!parsed.success) {
        return NextResponse.json(
          {
            error:
              "El tipo de sesión pedido no existe. Usa PASAPORTE, LECTURA o EVENTO, o quita el parámetro para verlas todas.",
          },
          { status: 422 },
        );
      }
      tipo = parsed.data;
    }

    const clases = await listarClasesDeEdicion(id, tipo);
    return NextResponse.json({ clases });
  } catch {
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
