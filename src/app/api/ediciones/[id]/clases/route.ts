import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listarClasesDeEdicion } from "@/server/queries/clases";
import { existeEdicion } from "@/server/queries/ediciones";

type RouteContext = { params: Promise<{ id: string }> };

// ── GET /api/ediciones/[id]/clases — listar clases de una edición ─────────────

export async function GET(_request: Request, context: RouteContext) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await context.params;

    const existe = await existeEdicion(id);
    if (!existe) {
      return NextResponse.json({ error: "Edición no encontrada" }, { status: 404 });
    }

    const clases = await listarClasesDeEdicion(id);
    return NextResponse.json({ clases });
  } catch {
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
