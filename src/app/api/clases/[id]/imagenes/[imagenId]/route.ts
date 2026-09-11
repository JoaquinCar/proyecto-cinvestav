import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  obtenerImagenClase,
  eliminarImagenClase,
} from "@/server/queries/imagenes-clase";
import { fallaInesperada } from "@/server/respuestas";

type RouteContext = { params: Promise<{ id: string; imagenId: string }> };

// ── DELETE /api/clases/[id]/imagenes/[imagenId] — (ADMIN y BECARIO) ───────────

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    if (session.user.role !== "ADMIN" && session.user.role !== "BECARIO") {
      return NextResponse.json({ error: "Prohibido" }, { status: 403 });
    }

    const { id, imagenId } = await context.params;

    const imagen = await obtenerImagenClase(imagenId);
    if (!imagen || imagen.claseId !== id) {
      return NextResponse.json(
        {
          error:
            "Esta imagen ya no está en la clase: alguien pudo eliminarla antes. Vuelve a cargar la página para ver las que quedan.",
        },
        { status: 404 },
      );
    }

    await eliminarImagenClase(imagenId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return fallaInesperada(
      "DELETE /api/clases/[id]/imagenes/[imagenId]",
      error,
      "No se pudo eliminar la imagen; sigue en la clase. Vuelve a intentarlo en unos minutos.",
    );
  }
}
