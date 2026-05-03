import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { desinscribirParticipante } from "@/server/queries/participantes";

// ── DELETE /api/inscripciones/[id] ────────────────────────────────────────────
// Elimina la inscripción de un participante a una edición. Solo ADMIN.
// Esto también elimina en cascada las asistencias asociadas (definido en Prisma).

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Permiso insuficiente" }, { status: 403 });
  }

  const { id } = await params;

  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  try {
    await desinscribirParticipante(id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof Error && err.message === "INSCRIPCION_NO_ENCONTRADA") {
      return NextResponse.json(
        { error: "Inscripción no encontrada" },
        { status: 404 },
      );
    }
    console.error(`[DELETE /api/inscripciones/${id}]`, err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
