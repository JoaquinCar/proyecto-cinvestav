import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { actualizarSesionSchema } from "@/lib/schemas/clase.schema";
import {
  obtenerSesionPorId,
  actualizarSesion,
  eliminarSesion,
  obtenerRangoEdicionDeSesion,
  SesionConAsistenciasError,
} from "@/server/queries/clases";
import {
  assertEdicionDeSesionAbierta,
  EdicionCerradaError,
} from "@/server/queries/edicion-cerrada";
import { estaEnRango, mensajeFueraDeRango } from "@/lib/fechas";
import {
  fallaInesperada,
  leerCuerpoJson,
  respuestaCamposInvalidos,
} from "@/server/respuestas";

type RouteContext = { params: Promise<{ id: string }> };

/** La sesión ya no está: la pestaña abierta se quedó vieja. */
const SESION_NO_ENCONTRADA =
  "Esta sesión ya no existe: alguien pudo eliminarla. Vuelve a la página de la clase para ver las sesiones actuales.";

// ── PUT /api/sesiones/[id] — actualizar temas/notas (BECARIO+) ───────────────

export async function PUT(request: Request, context: RouteContext) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    // Allowlist explícita: solo ADMIN o BECARIO pueden modificar sesiones.
    if (session.user.role !== "ADMIN" && session.user.role !== "BECARIO") {
      return NextResponse.json({ error: "Prohibido" }, { status: 403 });
    }

    const { id } = await context.params;

    const existente = await obtenerSesionPorId(id);
    if (!existente) {
      return NextResponse.json({ error: SESION_NO_ENCONTRADA }, { status: 404 });
    }

    const cuerpo = await leerCuerpoJson(request);
    if (!cuerpo.ok) return cuerpo.respuesta;

    const parsed = actualizarSesionSchema.safeParse(cuerpo.datos);

    if (!parsed.success) {
      return respuestaCamposInvalidos(parsed.error);
    }

    const fields = Object.fromEntries(
      Object.entries(parsed.data).filter(([, v]) => v !== undefined)
    );
    if (Object.keys(fields).length === 0) {
      return NextResponse.json(
        {
          error:
            "No hay ningún cambio que guardar en esta sesión: la fecha, los temas y las notas siguen igual.",
        },
        { status: 422 },
      );
    }

    // Una edición cerrada ya no admite cambios de temas, notas ni fechas.
    await assertEdicionDeSesionAbierta(id);

    // Corregir la fecha es válido (un dedazo en el año quedaba permanente), pero
    // debe seguir cayendo dentro de la edición a la que pertenece la sesión.
    if (parsed.data.fecha !== undefined) {
      const rango = await obtenerRangoEdicionDeSesion(id);
      if (!rango) {
        return NextResponse.json({ error: SESION_NO_ENCONTRADA }, { status: 404 });
      }
      if (!estaEnRango(parsed.data.fecha, rango.fechaInicio, rango.fechaFin)) {
        return NextResponse.json(
          { error: mensajeFueraDeRango(rango.fechaInicio, rango.fechaFin) },
          { status: 422 },
        );
      }
    }

    const sesionActualizada = await actualizarSesion(id, parsed.data);
    return NextResponse.json(sesionActualizada);
  } catch (error) {
    if (error instanceof EdicionCerradaError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    return fallaInesperada(
      "PUT /api/sesiones/[id]",
      error,
      "No se pudieron guardar los cambios de la sesión. Vuelve a intentarlo en unos minutos.",
    );
  }
}

// ── DELETE /api/sesiones/[id] — eliminar si no tiene asistencias (solo ADMIN) ─

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Prohibido" }, { status: 403 });
    }

    const { id } = await context.params;

    const existente = await obtenerSesionPorId(id);
    if (!existente) {
      return NextResponse.json({ error: SESION_NO_ENCONTRADA }, { status: 404 });
    }

    await assertEdicionDeSesionAbierta(id);

    await eliminarSesion(id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof EdicionCerradaError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    if (error instanceof SesionConAsistenciasError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    return fallaInesperada(
      "DELETE /api/sesiones/[id]",
      error,
      "No se pudo eliminar la sesión; sigue como estaba. Vuelve a intentarlo en unos minutos.",
    );
  }
}
