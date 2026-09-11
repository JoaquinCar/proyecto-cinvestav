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
import {
  fallaInesperada,
  leerCuerpoJson,
  respuestaCamposInvalidos,
} from "@/server/respuestas";

/** La clase a la que se quiere colgar la sesión no está. */
const CLASE_NO_ENCONTRADA =
  "La clase a la que intentas agregar la sesión ya no existe. Vuelve a la lista de clases y elige una.";

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

    const cuerpo = await leerCuerpoJson(request);
    if (!cuerpo.ok) return cuerpo.respuesta;

    const parsed = crearSesionSchema.safeParse(cuerpo.datos);

    if (!parsed.success) {
      return respuestaCamposInvalidos(parsed.error);
    }

    // Verificar que la clase exista
    const clase = await obtenerClasePorId(parsed.data.claseId);
    if (!clase) {
      return NextResponse.json({ error: CLASE_NO_ENCONTRADA }, { status: 404 });
    }

    // Una edición cerrada no admite sesiones nuevas. Se comprueba antes que el
    // rango: es más barato y una edición cerrada no acepta nada, esté la fecha
    // donde esté.
    await assertEdicionDeClaseAbierta(parsed.data.claseId);

    // Una sesión fuera del rango de su edición corrompe conteos, constancias y
    // reportes en silencio: se rechaza en vez de avisar.
    const rango = await obtenerRangoEdicionDeClase(parsed.data.claseId);
    if (!rango) {
      return NextResponse.json({ error: CLASE_NO_ENCONTRADA }, { status: 404 });
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

    return fallaInesperada(
      "POST /api/sesiones",
      error,
      "No se pudo agregar la sesión y no quedó guardada. Vuelve a intentarlo en unos minutos.",
    );
  }
}
