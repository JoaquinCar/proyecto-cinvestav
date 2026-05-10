import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { actualizarSesionSchema } from "@/lib/schemas/clase.schema";
import {
  obtenerSesionPorId,
  actualizarSesion,
  eliminarSesion,
  SesionConAsistenciasError,
} from "@/server/queries/clases";

type RouteContext = { params: Promise<{ id: string }> };

// ── PUT /api/sesiones/[id] — actualizar temas/notas (BECARIO+) ───────────────

export async function PUT(request: Request, context: RouteContext) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    // READONLY no puede modificar sesiones
    if (session.user.role === "READONLY") {
      return NextResponse.json({ error: "Prohibido" }, { status: 403 });
    }

    const { id } = await context.params;

    const existente = await obtenerSesionPorId(id);
    if (!existente) {
      return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
    }

    const body: unknown = await request.json();
    const parsed = actualizarSesionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const fields = Object.fromEntries(
      Object.entries(parsed.data).filter(([, v]) => v !== undefined)
    );
    if (Object.keys(fields).length === 0) {
      return NextResponse.json({ error: "No hay campos para actualizar" }, { status: 422 });
    }

    const sesionActualizada = await actualizarSesion(id, parsed.data);
    return NextResponse.json(sesionActualizada);
  } catch {
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// ── DELETE /api/sesiones/[id] — eliminar si no tiene asistencias (solo ADMIN) ─

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

    const existente = await obtenerSesionPorId(id);
    if (!existente) {
      return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
    }

    await eliminarSesion(id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof SesionConAsistenciasError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
