import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { obtenerHistorialParticipante } from "@/server/queries/participantes";

// ── GET /api/participantes/[id] ───────────────────────────────────────────────
// Devuelve el historial completo del participante:
// todas las ediciones en que ha participado, con sus asistencias.
// Disponible para ADMIN, BECARIO y READONLY.

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  try {
    const participante = await obtenerHistorialParticipante(id);

    if (!participante) {
      return NextResponse.json(
        { error: "Participante no encontrado" },
        { status: 404 },
      );
    }

    return NextResponse.json({ participante });
  } catch (err) {
    console.error(`[GET /api/participantes/${id}]`, err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
