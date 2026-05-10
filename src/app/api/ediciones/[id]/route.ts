import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { editarEdicionSchema } from "@/lib/schemas/edicion.schema";
import {
  obtenerEdicionPorId,
  editarEdicion,
  eliminarEdicion,
  EdicionConInscripcionesError,
} from "@/server/queries/ediciones";

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
    const parsed = editarEdicionSchema.safeParse(body);

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

export async function DELETE(_request: Request, context: RouteContext) {
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

    await eliminarEdicion(id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof EdicionConInscripcionesError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
