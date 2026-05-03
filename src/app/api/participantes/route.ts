import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  busquedaParticipanteSchema,
  participanteSchema,
} from "@/lib/schemas/participante.schema";
import {
  buscarParticipantes,
  crearParticipante,
} from "@/server/queries/participantes";

// ── GET /api/participantes?q=texto&edicionId=X ────────────────────────────────
// Busca participantes por nombre o apellidos.
// Disponible para ADMIN, BECARIO y READONLY.

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const raw = {
    q:         searchParams.get("q")         ?? undefined,
    edicionId: searchParams.get("edicionId") ?? undefined,
  };

  const parsed = busquedaParticipanteSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Parámetros inválidos", detalles: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const participantes = await buscarParticipantes(
      parsed.data.q,
      parsed.data.edicionId,
    );
    return NextResponse.json({ participantes });
  } catch (err) {
    console.error("[GET /api/participantes]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// ── POST /api/participantes ───────────────────────────────────────────────────
// Crea un participante nuevo. Solo ADMIN o BECARIO.
// No deduplica automáticamente; el frontend decide si mostrar advertencia.

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

  const parsed = participanteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", detalles: parsed.error.flatten() },
      { status: 422 },
    );
  }

  try {
    const participante = await crearParticipante(parsed.data);
    return NextResponse.json({ participante }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/participantes]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
