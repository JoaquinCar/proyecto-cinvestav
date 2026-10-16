import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { editarEdicionConActualSchema } from "@/lib/schemas/edicion.schema";
import {
  obtenerEdicionPorId,
  editarEdicion,
  eliminarEdicion,
  EdicionConInscripcionesError,
  EdicionNoEncontradaError,
} from "@/server/queries/ediciones";
import { fallaInesperada } from "@/server/respuestas";

type RouteContext = { params: Promise<{ id: string }> };

// ── GET /api/ediciones/[id] — obtener una edición con conteos ─────────────────

export async function GET(_request: Request, context: RouteContext) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await context.params;
    const edicion = await obtenerEdicionPorId(id);

    if (!edicion) {
      return NextResponse.json(
        { error: "Edición no encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json(edicion);
  } catch {
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// ── PUT /api/ediciones/[id] — editar (solo ADMIN) ────────────────────────────

export async function PUT(request: Request, context: RouteContext) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Prohibido" }, { status: 403 });
    }

    const { id } = await context.params;

    // Verificar que la edición existe antes de intentar actualizar
    const existente = await obtenerEdicionPorId(id);
    if (!existente) {
      return NextResponse.json(
        { error: "Edición no encontrada" },
        { status: 404 }
      );
    }

    const body: unknown = await request.json();
    // La coherencia de fechas se valida contra lo ya guardado: enviar solo
    // `fechaFin` no puede dejar el fin antes del inicio de la edición.
    const parsed = editarEdicionConActualSchema(existente).safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const edicionActualizada = await editarEdicion(id, parsed.data);
    return NextResponse.json(edicionActualizada);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("Unique constraint") &&
      error.message.includes("anio")
    ) {
      return NextResponse.json(
        { error: "Ya existe una edición con ese año" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// ── DELETE /api/ediciones/[id] — eliminar si no tiene inscripciones (solo ADMIN)

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Prohibido" }, { status: 403 });
    }

    const { id } = await context.params;

    // Verificar que la edición existe
    const existente = await obtenerEdicionPorId(id);
    if (!existente) {
      return NextResponse.json(
        { error: "Edición no encontrada" },
        { status: 404 }
      );
    }

    const forzar = new URL(request.url).searchParams.get("forzar") === "true";

    await eliminarEdicion(id, { forzar });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof EdicionNoEncontradaError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    // 409 con los conteos: la pantalla los usa para preguntar con números en
    // vez de dejar al coordinador adivinando qué se perdería.
    if (error instanceof EdicionConInscripcionesError) {
      return NextResponse.json(
        { error: error.message, conteos: error.conteos },
        { status: 409 },
      );
    }

    // Antes esto era un «Error interno del servidor» a secas, sin registro:
    // la causa real —una llave foránea de las sesiones— moría aquí y el
    // coordinador se quedaba sin saber qué hacer.
    return fallaInesperada(
      "DELETE /api/ediciones/[id]",
      error,
      "No se pudo eliminar la edición; sigue como estaba. Vuelve a intentarlo en unos minutos.",
    );
  }
}
