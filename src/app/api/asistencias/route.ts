import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { batchAsistenciaBodySchema } from "@/lib/schemas/asistencia.schema";
import { batchUpsertAsistencias } from "@/server/queries/asistencias";

// ── POST /api/asistencias ─────────────────────────────────────────────────────
// Registra o actualiza asistencias en batch para una sesión.
// Requiere rol ADMIN o BECARIO (READONLY no puede modificar).
// Body: { items: Array<{ inscripcionId, sesionId, presente }> }
// Respuesta: { updated: number }

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    if (session.user.role === "READONLY") {
      return NextResponse.json({ error: "Permiso insuficiente" }, { status: 403 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Cuerpo JSON inválido" }, { status: 400 });
    }

    const parsed = batchAsistenciaBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", detalles: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const resultados = await batchUpsertAsistencias(parsed.data.items);

    return NextResponse.json({ updated: resultados.length }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
