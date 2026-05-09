import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  verificarElegibilidad,
  generarYGuardarConstancia,
} from "@/server/queries/constancias";

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
        { error: "Inscripción no encontrada" },
        { status: 404 },
      );
    }
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}

export async function POST(_req: Request, context: RouteContext) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    if (session.user.role === "READONLY") {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    }
    const { inscripcionId } = await context.params;
    const elegibilidad = await verificarElegibilidad(inscripcionId);
    if (!elegibilidad) {
      return NextResponse.json(
        { error: "Inscripción no encontrada" },
        { status: 404 },
      );
    }
    if (!elegibilidad.elegible) {
      return NextResponse.json(
        { error: "Participante no cumple el mínimo de asistencias" },
        { status: 422 },
      );
    }
    const result = await generarYGuardarConstancia(inscripcionId);
    return NextResponse.json(result, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
