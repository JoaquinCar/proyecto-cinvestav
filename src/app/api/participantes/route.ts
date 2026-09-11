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
import {
  fallaInesperada,
  leerCuerpoJson,
  mensajeCamposInvalidos,
  respuestaCamposInvalidos,
} from "@/server/respuestas";

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
      { error: mensajeCamposInvalidos(parsed.error), detalles: parsed.error.flatten() },
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
    return fallaInesperada(
      "GET /api/participantes",
      err,
      "No se pudo buscar entre los participantes. Revisa tu conexión y vuelve a intentarlo en unos momentos.",
    );
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

  const cuerpo = await leerCuerpoJson(request);
  if (!cuerpo.ok) return cuerpo.respuesta;

  const parsed = participanteSchema.safeParse(cuerpo.datos);
  if (!parsed.success) {
    return respuestaCamposInvalidos(parsed.error);
  }

  try {
    const participante = await crearParticipante(parsed.data);
    return NextResponse.json({ participante }, { status: 201 });
  } catch (err) {
    return fallaInesperada(
      "POST /api/participantes",
      err,
      "No se pudo guardar la ficha del participante y no quedó registrada. Vuelve a intentarlo en unos minutos.",
    );
  }
}
