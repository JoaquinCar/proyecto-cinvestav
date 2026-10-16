import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { inscripcionSchema } from "@/lib/schemas/participante.schema";
import { inscribirParticipante } from "@/server/queries/participantes";
import {
  fallaInesperada,
  leerCuerpoJson,
  respuestaCamposInvalidos,
} from "@/server/respuestas";

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

  const cuerpo = await leerCuerpoJson(request);
  if (!cuerpo.ok) return cuerpo.respuesta;

  const parsed = inscripcionSchema.safeParse(cuerpo.datos);
  if (!parsed.success) {
    return respuestaCamposInvalidos(parsed.error);
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
          {
            error:
              "La edición en la que intentas inscribir ya no existe. Vuelve a la lista de ediciones y elige una.",
          },
          { status: 404 },
        );
      }
      if (err.message === "EDICION_NO_ACTIVA") {
        return NextResponse.json(
          {
            error:
              "No se pudo inscribir al participante porque esta edición no está activa. Solo se admiten inscripciones en la edición en curso.",
          },
          { status: 409 },
        );
      }
      if (err.message === "PARTICIPANTE_NO_ENCONTRADO") {
        return NextResponse.json(
          {
            error:
              "No se encontró la ficha del participante que intentas inscribir: puede que alguien la haya eliminado. Búscalo de nuevo en la lista de participantes.",
          },
          { status: 404 },
        );
      }
      // Violación de unique constraint de Prisma (P2002): ya inscrito
      if ("code" in err && (err as NodeJS.ErrnoException).code === "P2002") {
        return NextResponse.json(
          {
            error:
              "El participante ya está inscrito en esta edición, así que no hizo falta volver a inscribirlo.",
          },
          { status: 409 },
        );
      }
    }
    return fallaInesperada(
      "POST /api/inscripciones",
      err,
      "No se pudo inscribir al participante en la edición y la inscripción no quedó registrada. Vuelve a intentarlo en unos minutos.",
    );
  }
}
