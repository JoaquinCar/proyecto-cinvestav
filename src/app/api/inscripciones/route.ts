import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { inscripcionSchema } from "@/lib/schemas/participante.schema";
import { inscribirParticipante } from "@/server/queries/participantes";

// ── POST /api/inscripciones ───────────────────────────────────────────────────
// Inscribe un participante a una edición activa. Solo ADMIN o BECARIO.
// Retorna 409 si ya existe la inscripción (violación unique).

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { user } = session;
  if (user.role !== "ADMIN" && user.role !== "BECARIO") {
    return NextResponse.json({ error: "Permiso insuficiente" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido" }, { status: 400 });
  }

  const parsed = inscripcionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", detalles: parsed.error.flatten() },
      { status: 422 },
    );
  }

  try {
    const inscripcion = await inscribirParticipante(
      parsed.data.participanteId,
      parsed.data.edicionId,
    );
    return NextResponse.json({ inscripcion }, { status: 201 });
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "EDICION_NO_ENCONTRADA") {
        return NextResponse.json(
          { error: "Edición no encontrada" },
          { status: 404 },
        );
      }
      if (err.message === "EDICION_NO_ACTIVA") {
        return NextResponse.json(
          { error: "La edición no está activa" },
          { status: 409 },
        );
      }
      if (err.message === "PARTICIPANTE_NO_ENCONTRADO") {
        return NextResponse.json(
          { error: "Participante no encontrado" },
          { status: 404 },
        );
      }
      // Violación de unique constraint de Prisma (P2002): ya inscrito
      if ("code" in err && (err as NodeJS.ErrnoException).code === "P2002") {
        return NextResponse.json(
          { error: "El participante ya está inscrito en esta edición" },
          { status: 409 },
        );
      }
    }
    console.error("[POST /api/inscripciones]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
