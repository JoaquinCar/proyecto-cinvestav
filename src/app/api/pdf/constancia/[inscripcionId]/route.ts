import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  verificarElegibilidad,
  generarYGuardarConstancia,
  AlmacenamientoNoConfiguradoError,
  AlmacenamientoNoDisponibleError,
  InscripcionNoEncontradaError,
  ConstanciaExcluidaError,
} from "@/server/queries/constancias";
import { fallaInesperada } from "@/server/respuestas";

// ── Qué impide hoy generar una constancia ────────────────────────────────────
// Solo una cosa: que un ADMIN haya excluido a ese participante. El mínimo de
// asistencias de la edición ya no bloquea nada — la constancia le toca a todo
// inscrito (ver src/server/queries/constancias.ts).

type RouteContext = { params: Promise<{ inscripcionId: string }> };

export async function GET(_req: Request, context: RouteContext) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const { inscripcionId } = await context.params;
    const result = await verificarElegibilidad(inscripcionId);
    if (!result) {
      return NextResponse.json(
        {
          error:
            "No se encontró la inscripción de este participante. Vuelve a cargar la página para ver el estado actual.",
        },
        { status: 404 },
      );
    }
    return NextResponse.json(result);
  } catch (error) {
    return fallaInesperada(
      "GET /api/pdf/constancia/[inscripcionId]",
      error,
      "No se pudo comprobar si el participante ya cumple el mínimo de asistencias. Vuelve a intentarlo en unos minutos.",
    );
  }
}

export async function POST(_req: Request, context: RouteContext) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    if (session.user.role !== "ADMIN" && session.user.role !== "BECARIO") {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    }
    const { inscripcionId } = await context.params;
    const elegibilidad = await verificarElegibilidad(inscripcionId);
    if (!elegibilidad) {
      return NextResponse.json(
        {
          error:
            "No se encontró la inscripción de este participante. Vuelve a cargar la página para ver el estado actual.",
        },
        { status: 404 },
      );
    }
    if (!elegibilidad.elegible) {
      const motivo = elegibilidad.exclusion.motivo;
      return NextResponse.json(
        {
          error:
            "No se generó la constancia porque este participante está excluido de la entrega de esta edición" +
            (motivo ? `: «${motivo}»` : "") +
            ". Para entregársela, reincorpóralo primero desde el apartado de constancias.",
        },
        { status: 422 },
      );
    }
    const result = await generarYGuardarConstancia(inscripcionId);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    // El almacenamiento de archivos no está configurado o rechazó el PDF. Es
    // un problema del servidor, no de quien pulsó el botón, y tiene arreglo
    // conocido: por eso el motivo viaja al cliente en vez de morir en el log.
    if (
      error instanceof AlmacenamientoNoConfiguradoError ||
      error instanceof AlmacenamientoNoDisponibleError
    ) {
      console.error("[POST /api/pdf/constancia/[inscripcionId]]", error);
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    if (error instanceof InscripcionNoEncontradaError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    // Alguien lo excluyó entre la comprobación y la generación.
    if (error instanceof ConstanciaExcluidaError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }

    return fallaInesperada(
      "POST /api/pdf/constancia/[inscripcionId]",
      error,
      "No se pudo generar la constancia y no quedó guardada. Vuelve a intentarlo; si sigue igual, avisa a quien administra el sistema.",
    );
  }
}
