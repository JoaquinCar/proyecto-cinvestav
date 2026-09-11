import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { batchAsistenciaBodySchema } from "@/lib/schemas/asistencia.schema";
import {
  batchUpsertAsistencias,
  AsistenciaFueraDeEdicionError,
} from "@/server/queries/asistencias";
import { EdicionCerradaError } from "@/server/queries/edicion-cerrada";
import {
  fallaInesperada,
  leerCuerpoJson,
  respuestaCamposInvalidos,
} from "@/server/respuestas";

// ── POST /api/asistencias ─────────────────────────────────────────────────────
// Registra o actualiza asistencias en batch para una sesión.
// Requiere rol ADMIN o BECARIO (READONLY no puede modificar).
// Body: { items: Array<{ inscripcionId, sesionId, presente }> }
// Respuesta: { updated: number }

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Allowlist explícita (fail-closed ante roles futuros): solo ADMIN o BECARIO.
    if (session.user.role !== "ADMIN" && session.user.role !== "BECARIO") {
      return NextResponse.json({ error: "Permiso insuficiente" }, { status: 403 });
    }

    const cuerpo = await leerCuerpoJson(request);
    if (!cuerpo.ok) return cuerpo.respuesta;

    const parsed = batchAsistenciaBodySchema.safeParse(cuerpo.datos);
    if (!parsed.success) {
      return respuestaCamposInvalidos(parsed.error);
    }

    const resultados = await batchUpsertAsistencias(parsed.data.items);

    return NextResponse.json({ updated: resultados.length }, { status: 201 });
  } catch (error) {
    // La inscripción y la sesión son de ediciones distintas (o no existen):
    // registrar esa asistencia mezclaría los datos de dos ediciones.
    if (error instanceof AsistenciaFueraDeEdicionError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    // La edición ya se cerró: conserva lectura y reportes, pero no admite
    // nuevas capturas.
    if (error instanceof EdicionCerradaError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    // El lote entero va en una transacción: si se llega aquí, no quedó ninguna
    // marca escrita. Decirlo evita que alguien dé por guardada media lista.
    return fallaInesperada(
      "POST /api/asistencias",
      error,
      "No se pudo guardar la asistencia y no quedó registrada ninguna marca de este envío. Vuelve a marcarlas e inténtalo de nuevo.",
    );
  }
}
