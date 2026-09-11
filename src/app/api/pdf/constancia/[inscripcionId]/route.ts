import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  verificarElegibilidad,
  generarYGuardarConstancia,
  AlmacenamientoNoConfiguradoError,
  AlmacenamientoNoDisponibleError,
  InscripcionNoEncontradaError,
} from "@/server/queries/constancias";
import { fallaInesperada } from "@/server/respuestas";

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
      const faltante =
        elegibilidad.modo === "porcentaje"
          ? `lleva ${elegibilidad.asistencias} asistencias y la edición pide al menos ${elegibilidad.minimo}% de las sesiones`
          : `lleva ${elegibilidad.asistencias} de las ${elegibilidad.minimo} asistencias que pide esta edición`;
      return NextResponse.json(
        {
          error: `Todavía no se puede generar la constancia: el participante ${faltante}. Registra las asistencias que falten y vuelve a intentarlo.`,
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

    return fallaInesperada(
      "POST /api/pdf/constancia/[inscripcionId]",
      error,
      "No se pudo generar la constancia y no quedó guardada. Vuelve a intentarlo; si sigue igual, avisa a quien administra el sistema.",
    );
  }
}
