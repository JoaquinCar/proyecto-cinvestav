import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  desinscribirParticipante,
  InscripcionConAsistenciasError,
  InscripcionConConstanciaError,
} from "@/server/queries/participantes";

// ── DELETE /api/inscripciones/[id] ────────────────────────────────────────────
// Da de baja a un participante de una edición. Solo ADMIN.
//
// Las asistencias NO se borran en cascada desde la base: la relación
// Asistencia → Inscripcion no declara onDelete: Cascade (a propósito, ver
// prisma/schema.prisma). Si la inscripción tiene asistencias registradas la
// petición se rechaza con 409 y el conteo exacto; para borrarlas junto con la
// inscripción hay que pedirlo explícitamente con ?forzar=true, y entonces se
// hace en una transacción. Una inscripción con constancia generada no se da de
// baja ni forzando.

export async function DELETE(
  request: NextRequest,
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

  const forzar =
    new URL(request.url).searchParams.get("forzar") === "true";

  try {
    await desinscribirParticipante(id, { forzar });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof Error && err.message === "INSCRIPCION_NO_ENCONTRADA") {
      return NextResponse.json(
        { error: "Inscripción no encontrada" },
        { status: 404 },
      );
    }
    if (err instanceof InscripcionConConstanciaError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    if (err instanceof InscripcionConAsistenciasError) {
      return NextResponse.json(
        { error: err.message, conteos: err.conteos },
        { status: 409 },
      );
    }
    console.error(`[DELETE /api/inscripciones/${id}]`, err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
