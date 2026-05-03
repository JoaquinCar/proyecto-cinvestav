import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  obtenerEdicionPorId,
  activarEdicion,
} from "@/server/queries/ediciones";

type RouteContext = { params: Promise<{ id: string }> };

// ── PUT /api/ediciones/[id]/activar — activar edición (solo ADMIN) ────────────
// Desactiva la edición activa anterior en la misma transacción.

export async function PUT(_request: Request, context: RouteContext) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Prohibido" }, { status: 403 });
    }

    const { id } = await context.params;

    // Verificar que la edición existe antes de activar
    const existente = await obtenerEdicionPorId(id);
    if (!existente) {
      return NextResponse.json(
        { error: "Edición no encontrada" },
        { status: 404 }
      );
    }

    const edicionActivada = await activarEdicion(id);
    return NextResponse.json(edicionActivada);
  } catch {
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
