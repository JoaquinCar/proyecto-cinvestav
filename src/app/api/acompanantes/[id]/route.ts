import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { obtenerAcompanante } from "@/server/queries/acompanantes";
import { fallaInesperada } from "@/server/respuestas";

/** El acompañante buscado no está en la base. */
const ACOMPANANTE_NO_ENCONTRADO =
  "No se encontró a este acompañante: puede que alguien haya eliminado su ficha. Vuelve a la ficha del participante para ver quién lo acompaña ahora.";

// ── GET /api/acompanantes/[id] ────────────────────────────────────────────────
// A quién acompaña: los 2 hermanos, o los 25 niños de un grupo organizado.
//
// Disponible para los tres roles, pero el contacto (teléfono y correo del
// adulto) se omite para READONLY: es un dato personal y ese rol solo consulta
// reportes. Mismo criterio que `buscarParticipantes`, que tampoco expone el
// contacto de los padres al listado.

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
      { error: "El enlace al acompañante está incompleto. Vuelve a abrirlo desde la ficha del participante." },
      { status: 400 },
    );
  }

  try {
    const acompanante = await obtenerAcompanante(id);

    if (!acompanante) {
      return NextResponse.json(
        { error: ACOMPANANTE_NO_ENCONTRADO },
        { status: 404 },
      );
    }

    const puedeVerContacto =
      session.user.role === "ADMIN" || session.user.role === "BECARIO";

    return NextResponse.json({
      acompanante: {
        ...acompanante,
        telefono: puedeVerContacto ? acompanante.telefono : null,
        correo:   puedeVerContacto ? acompanante.correo   : null,
      },
    });
  } catch (err) {
    return fallaInesperada(
      "GET /api/acompanantes/[id]",
      err,
      "No se pudo cargar la ficha del acompañante. Revisa tu conexión y vuelve a intentarlo en unos momentos.",
    );
  }
}
