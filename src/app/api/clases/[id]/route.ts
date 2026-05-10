import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { editarClaseSchema } from "@/lib/schemas/clase.schema";
import {
  obtenerClasePorId,
  editarClase,
  eliminarClase,
  ClaseConAsistenciasError,
} from "@/server/queries/clases";

type RouteContext = { params: Promise<{ id: string }> };

// ── PUT /api/clases/[id] — editar clase (solo ADMIN) ──────────────────────────

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

    const existente = await obtenerClasePorId(id);
    if (!existente) {
      return NextResponse.json({ error: "Clase no encontrada" }, { status: 404 });
    }

    const body: unknown = await request.json();
    const parsed = editarClaseSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const claseActualizada = await editarClase(id, parsed.data);
    return NextResponse.json(claseActualizada);
  } catch {
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// ── DELETE /api/clases/[id] — eliminar si no tiene asistencias (solo ADMIN) ───

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

    const existente = await obtenerClasePorId(id);
    if (!existente) {
      return NextResponse.json({ error: "Clase no encontrada" }, { status: 404 });
    }

    await eliminarClase(id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof ClaseConAsistenciasError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
