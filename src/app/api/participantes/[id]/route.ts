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
import {
  fallaInesperada,
  leerCuerpoJson,
  respuestaCamposInvalidos,
} from "@/server/respuestas";

/** El participante buscado no está en la base. */
const PARTICIPANTE_NO_ENCONTRADO =
  "No se encontró a este participante: puede que alguien haya eliminado su ficha. Vuelve a la lista de participantes para ver los que siguen registrados.";

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
    return NextResponse.json(
      { error: "El enlace al participante está incompleto. Vuelve a abrirlo desde la lista de participantes." },
      { status: 400 },
    );
  }

  try {
    const participante = await obtenerHistorialParticipante(id);

    if (!participante) {
      return NextResponse.json(
        { error: PARTICIPANTE_NO_ENCONTRADO },
        { status: 404 },
      );
    }

    return NextResponse.json({ participante });
  } catch (err) {
    return fallaInesperada(
      "GET /api/participantes/[id]",
      err,
      "No se pudo cargar el historial del participante. Revisa tu conexión y vuelve a intentarlo en unos momentos.",
    );
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
    return NextResponse.json(
      { error: "El enlace al participante está incompleto. Vuelve a abrirlo desde la lista de participantes." },
      { status: 400 },
    );
  }

  const cuerpo = await leerCuerpoJson(request);
  if (!cuerpo.ok) return cuerpo.respuesta;

  const parsed = editarParticipanteSchema.safeParse(cuerpo.datos);
  if (!parsed.success) {
    return respuestaCamposInvalidos(parsed.error);
  }

  try {
    const participante = await editarParticipante(id, parsed.data);
    return NextResponse.json({ participante });
  } catch (err) {
    if (err instanceof ParticipanteNoEncontradoError) {
      return NextResponse.json(
        { error: PARTICIPANTE_NO_ENCONTRADO },
        { status: 404 },
      );
    }
    return fallaInesperada(
      "PUT /api/participantes/[id]",
      err,
      "No se pudieron guardar los cambios del participante; sus datos siguen como estaban. Vuelve a intentarlo en unos minutos.",
    );
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
    return NextResponse.json(
      { error: "El enlace al participante está incompleto. Vuelve a abrirlo desde la lista de participantes." },
      { status: 400 },
    );
  }

  try {
    await eliminarParticipante(id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof ParticipanteNoEncontradoError) {
      return NextResponse.json(
        { error: PARTICIPANTE_NO_ENCONTRADO },
        { status: 404 },
      );
    }
    if (err instanceof ParticipanteConDependenciasError) {
      return NextResponse.json(
        { error: err.message, conteos: err.conteos },
        { status: 409 },
      );
    }
    return fallaInesperada(
      "DELETE /api/participantes/[id]",
      err,
      "No se pudo eliminar al participante; su ficha sigue registrada. Vuelve a intentarlo en unos minutos.",
    );
  }
}
