import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { asignarAcompananteSchema } from "@/lib/schemas/acompanante.schema";
import {
  asignarAcompanante,
  quitarAcompanante,
  AcompananteNoEncontradoError,
  InscripcionNoEncontradaError,
  type EleccionAcompanante,
} from "@/server/queries/acompanantes";
import {
  fallaInesperada,
  leerCuerpoJson,
  respuestaCamposInvalidos,
} from "@/server/respuestas";

// ─────────────────────────────────────────────────────────────────────────────
// El acompañante de UNA inscripción: con quién llegó el niño ese año.
//
// ADMIN y BECARIO: el becario es quien registra en campo, y quien se entera de
// que el niño vino hoy con la abuela. READONLY solo consulta.
// ─────────────────────────────────────────────────────────────────────────────

const INSCRIPCION_NO_ENCONTRADA =
  "Este participante ya no figura inscrito en esa edición: la baja pudo registrarse desde otra pantalla. Vuelve a cargar la página para ver el estado actual.";

const ACOMPANANTE_NO_ENCONTRADO =
  "El acompañante que elegiste ya no existe: puede que alguien lo haya eliminado mientras llenabas el formulario. Búscalo de nuevo o captúralo como nuevo.";

const ENLACE_INCOMPLETO =
  "El enlace de la inscripción está incompleto. Vuelve a abrirlo desde la ficha del participante.";

type Contexto = { params: Promise<{ id: string }> };

/** Sesión con permiso de escritura, o la respuesta que lo niega. */
async function exigirCaptura(): Promise<NextResponse | null> {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { role } = session.user;
  if (role !== "ADMIN" && role !== "BECARIO") {
    return NextResponse.json({ error: "Permiso insuficiente" }, { status: 403 });
  }
  return null;
}

// ── PUT /api/inscripciones/[id]/acompanante ───────────────────────────────────
// Asigna o cambia el acompañante. Dos caminos, uno por petición:
//   { acompananteId }  → reutiliza una ficha existente (el segundo hermano).
//   { acompanante: {…} } → crea la ficha y la liga (el primero).

export async function PUT(request: NextRequest, { params }: Contexto) {
  const negado = await exigirCaptura();
  if (negado) return negado;

  const { id } = await params;
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: ENLACE_INCOMPLETO }, { status: 400 });
  }

  const cuerpo = await leerCuerpoJson(request);
  if (!cuerpo.ok) return cuerpo.respuesta;

  const parsed = asignarAcompananteSchema.safeParse(cuerpo.datos);
  if (!parsed.success) {
    return respuestaCamposInvalidos(parsed.error);
  }

  try {
    const inscripcion = await asignarAcompanante(
      id,
      parsed.data as EleccionAcompanante,
    );
    return NextResponse.json({ inscripcion });
  } catch (err) {
    if (err instanceof InscripcionNoEncontradaError) {
      return NextResponse.json(
        { error: INSCRIPCION_NO_ENCONTRADA },
        { status: 404 },
      );
    }
    if (err instanceof AcompananteNoEncontradoError) {
      return NextResponse.json(
        { error: ACOMPANANTE_NO_ENCONTRADO },
        { status: 404 },
      );
    }
    return fallaInesperada(
      "PUT /api/inscripciones/[id]/acompanante",
      err,
      "No se pudo guardar el acompañante; la inscripción sigue como estaba. Vuelve a intentarlo en unos minutos.",
    );
  }
}

// ── DELETE /api/inscripciones/[id]/acompanante ────────────────────────────────
// Quita el acompañante de esta inscripción. NO borra su ficha: casi siempre
// acompaña a otros niños, y aunque no, sigue disponible para el año que viene.

export async function DELETE(_request: NextRequest, { params }: Contexto) {
  const negado = await exigirCaptura();
  if (negado) return negado;

  const { id } = await params;
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: ENLACE_INCOMPLETO }, { status: 400 });
  }

  try {
    await quitarAcompanante(id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof InscripcionNoEncontradaError) {
      return NextResponse.json(
        { error: INSCRIPCION_NO_ENCONTRADA },
        { status: 404 },
      );
    }
    return fallaInesperada(
      "DELETE /api/inscripciones/[id]/acompanante",
      err,
      "No se pudo quitar el acompañante; la inscripción sigue como estaba. Vuelve a intentarlo en unos minutos.",
    );
  }
}
