import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { obtenerMetricasEdicion } from "@/server/queries/estadisticas";
import { existeEdicion } from "@/server/queries/ediciones";
import { fallaInesperada } from "@/server/respuestas";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: RouteContext) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const { id } = await context.params;

    // Sin esta comprobación, una edición inexistente devolvía 200 con todos los
    // conteos en cero: indistinguible de una edición real que aún no arranca, y
    // en la pantalla parecía que se habían perdido los datos.
    if (!(await existeEdicion(id))) {
      return NextResponse.json(
        {
          error:
            "La edición que intentas consultar ya no existe. Vuelve a la lista de ediciones y elige una.",
        },
        { status: 404 },
      );
    }

    const metricas = await obtenerMetricasEdicion(id);
    return NextResponse.json({ metricas });
  } catch (error) {
    return fallaInesperada(
      "GET /api/estadisticas/edicion/[id]",
      error,
      "No se pudieron calcular las estadísticas de la edición. Vuelve a intentarlo en unos momentos.",
    );
  }
}
