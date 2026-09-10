import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { crearSesionSchema } from "@/lib/schemas/clase.schema";
import {
  crearSesion,
  obtenerClasePorId,
  obtenerRangoEdicionDeClase,
} from "@/server/queries/clases";
import {
  assertEdicionDeClaseAbierta,
  EdicionCerradaError,
} from "@/server/queries/edicion-cerrada";
import { estaEnRango, mensajeFueraDeRango } from "@/lib/fechas";

// ── POST /api/sesiones — crear sesión (ADMIN o BECARIO) ──────────────────────

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    if (session.user.role !== "ADMIN" && session.user.role !== "BECARIO") {
      return NextResponse.json({ error: "Prohibido" }, { status: 403 });
    }

    const body: unknown = await request.json();
    const parsed = crearSesionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    // Verificar que la clase exista
    const clase = await obtenerClasePorId(parsed.data.claseId);
    if (!clase) {
      return NextResponse.json({ error: "Clase no encontrada" }, { status: 404 });
    }

    // Una edición cerrada no admite sesiones nuevas. Se comprueba antes que el
    // rango: es más barato y una edición cerrada no acepta nada, esté la fecha
    // donde esté.
    await assertEdicionDeClaseAbierta(parsed.data.claseId);

    // Una sesión fuera del rango de su edición corrompe conteos, constancias y
    // reportes en silencio: se rechaza en vez de avisar.
    const rango = await obtenerRangoEdicionDeClase(parsed.data.claseId);
    if (!rango) {
      return NextResponse.json({ error: "Clase no encontrada" }, { status: 404 });
    }
    if (!estaEnRango(parsed.data.fecha, rango.fechaInicio, rango.fechaFin)) {
      return NextResponse.json(
        { error: mensajeFueraDeRango(rango.fechaInicio, rango.fechaFin) },
        { status: 422 },
      );
    }

    const sesion = await crearSesion(parsed.data, session.user.id);
    return NextResponse.json(sesion, { status: 201 });
  } catch (error) {
    if (error instanceof EdicionCerradaError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
