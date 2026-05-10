import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { obtenerClasePorId, listarSesionesDeClase } from "@/server/queries/clases";

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
      return NextResponse.json({ error: "Clase no encontrada" }, { status: 404 });
    }

    const sesiones = await listarSesionesDeClase(id);
    return NextResponse.json({ sesiones });
  } catch {
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
