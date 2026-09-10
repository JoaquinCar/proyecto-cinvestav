import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { editarParticipanteSchema } from "@/lib/schemas/participante.schema";
import {
  obtenerHistorialParticipante,
  editarParticipante,
  eliminarParticipante,
  ParticipanteNoEncontradoError,
  ParticipanteConDependenciasError,
} from "@/server/queries/participantes";

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

// ── PUT /api/participantes/[id] ───────────────────────────────────────────────
// Corrige los datos de un participante. Solo ADMIN: el nombre que se guarda aquí
// es el que va impreso en la constancia del niño.
// Acepta cuerpo parcial (solo los campos que cambiaron).

export async function PUT(
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido" }, { status: 400 });
  }

  const parsed = editarParticipanteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", detalles: parsed.error.flatten() },
      { status: 422 },
    );
  }

  try {
    const participante = await editarParticipante(id, parsed.data);
    return NextResponse.json({ participante });
  } catch (err) {
    if (err instanceof ParticipanteNoEncontradoError) {
      return NextResponse.json(
        { error: "Participante no encontrado" },
        { status: 404 },
      );
    }
    console.error(`[PUT /api/participantes/${id}]`, err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// ── DELETE /api/participantes/[id] ────────────────────────────────────────────
// Elimina a un participante. Solo ADMIN y solo si no arrastra historial: con
// inscripciones o asistencias se rechaza con 409 y el detalle de qué lo impide.
// Para sacar a un niño de una edición concreta sin perder su ficha está
// DELETE /api/inscripciones/[id].

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
    await eliminarParticipante(id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof ParticipanteNoEncontradoError) {
      return NextResponse.json(
        { error: "Participante no encontrado" },
        { status: 404 },
      );
    }
    if (err instanceof ParticipanteConDependenciasError) {
      return NextResponse.json(
        { error: err.message, conteos: err.conteos },
        { status: 409 },
      );
    }
    console.error(`[DELETE /api/participantes/${id}]`, err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
