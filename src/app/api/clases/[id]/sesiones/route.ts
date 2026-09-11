import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { obtenerClasePorId, listarSesionesDeClase } from "@/server/queries/clases";
import { fallaInesperada } from "@/server/respuestas";

type RouteContext = { params: Promise<{ id: string }> };

// ── GET /api/clases/[id]/sesiones — listar sesiones de una clase ──────────────

export async function GET(_request: Request, context: RouteContext) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await context.params;

    const clase = await obtenerClasePorId(id);
    if (!clase) {
      return NextResponse.json(
        {
          error:
            "Esta clase ya no existe: alguien pudo eliminarla. Vuelve a la lista de clases para ver las que siguen activas.",
        },
        { status: 404 },
      );
    }

    const sesiones = await listarSesionesDeClase(id);
    return NextResponse.json({ sesiones });
  } catch (error) {
    return fallaInesperada(
      "GET /api/clases/[id]/sesiones",
      error,
      "No se pudieron cargar las sesiones de la clase. Vuelve a intentarlo en unos momentos.",
    );
  }
}
