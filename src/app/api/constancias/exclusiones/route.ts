import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { exclusionConstanciaSchema } from "@/lib/schemas/constancia.schema";
import { actualizarExclusionConstancia } from "@/server/queries/constancias";
import {
  fallaInesperada,
  leerCuerpoJson,
  respuestaCamposInvalidos,
} from "@/server/respuestas";

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/constancias/exclusiones
//
// La única puerta que puede dejar a un niño sin constancia, y la que se la
// devuelve. Solo ADMIN: un becario pasa lista en campo, no decide a quién no se
// le entrega un documento oficial. READONLY, por definición, tampoco.
//
// Acepta una lista porque el coordinador trabaja en bloque; el caso individual
// es una lista de uno.
// ─────────────────────────────────────────────────────────────────────────────

const NINGUNA_COINCIDE =
  "Ninguno de los participantes seleccionados sigue inscrito en esta edición: alguien pudo darlos de baja mientras mirabas la lista. Vuelve a cargar la página para ver el estado actual.";

export async function PUT(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json(
      {
        error:
          "Solo un administrador puede decidir quién queda fuera de la entrega de constancias.",
      },
      { status: 403 },
    );
  }

  const cuerpo = await leerCuerpoJson(request);
  if (!cuerpo.ok) return cuerpo.respuesta;

  const parsed = exclusionConstanciaSchema.safeParse(cuerpo.datos);
  if (!parsed.success) {
    return respuestaCamposInvalidos(parsed.error);
  }

  const { inscripcionIds, excluida, motivo } = parsed.data;

  try {
    const { actualizadas } = await actualizarExclusionConstancia({
      inscripcionIds,
      excluida,
      motivo: motivo ?? null,
      // El autor NUNCA viene del cuerpo: quien firma la decisión es quien tiene
      // la sesión abierta.
      usuarioId: session.user.id,
    });

    if (actualizadas === 0) {
      return NextResponse.json({ error: NINGUNA_COINCIDE }, { status: 404 });
    }

    return NextResponse.json({ actualizadas, excluida });
  } catch (error) {
    return fallaInesperada(
      "PUT /api/constancias/exclusiones",
      error,
      excluida
        ? "No se pudo registrar la exclusión y nada quedó guardado. Vuelve a intentarlo; si sigue igual, avisa a quien administra el sistema."
        : "No se pudo reincorporar a los participantes y nada quedó guardado. Vuelve a intentarlo; si sigue igual, avisa a quien administra el sistema.",
    );
  }
}
