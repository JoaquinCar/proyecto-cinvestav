import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { crearClaseSchema } from "@/lib/schemas/clase.schema";
import { crearClaseConSesion, obtenerRangoEdicion } from "@/server/queries/clases";
import {
  assertEdicionAbierta,
  EdicionCerradaError,
} from "@/server/queries/edicion-cerrada";
import { estaEnRango, mensajeFueraDeRango } from "@/lib/fechas";
import {
  fallaInesperada,
  leerCuerpoJson,
  respuestaCamposInvalidos,
} from "@/server/respuestas";

// ── POST /api/clases — crear clase con su sesión (solo ADMIN) ─────────────────
//
// La clase nace con la sesión en la que se imparte: así queda lista para pasar
// lista sin pasos extra. Ver `crearClaseConSesion`.

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Prohibido" }, { status: 403 });
    }

    const cuerpo = await leerCuerpoJson(request);
    if (!cuerpo.ok) return cuerpo.respuesta;

    const parsed = crearClaseSchema.safeParse(cuerpo.datos);

    if (!parsed.success) {
      return respuestaCamposInvalidos(parsed.error);
    }

    // El rango de la edición sirve para dos cosas a la vez: comprobar que la
    // edición exista y validar la fecha contra ella.
    const rango = await obtenerRangoEdicion(parsed.data.edicionId);
    if (!rango) {
      return NextResponse.json(
        {
          error:
            "La edición en la que intentas crear la clase ya no existe. Vuelve a la lista de ediciones y elige una.",
        },
        { status: 404 },
      );
    }

    // Una edición cerrada no admite sesiones nuevas, y esta clase trae una.
    await assertEdicionAbierta(parsed.data.edicionId);

    // Una sesión fuera del rango de su edición corrompe conteos, constancias y
    // reportes en silencio: se rechaza en vez de avisar.
    if (!estaEnRango(parsed.data.fecha, rango.fechaInicio, rango.fechaFin)) {
      return NextResponse.json(
        { error: mensajeFueraDeRango(rango.fechaInicio, rango.fechaFin) },
        { status: 422 },
      );
    }

    const clase = await crearClaseConSesion(parsed.data, session.user.id);
    return NextResponse.json(clase, { status: 201 });
  } catch (error) {
    if (error instanceof EdicionCerradaError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    return fallaInesperada(
      "POST /api/clases",
      error,
      "No se pudo crear la clase y no quedó guardada. Vuelve a intentarlo en unos minutos.",
    );
  }
}
