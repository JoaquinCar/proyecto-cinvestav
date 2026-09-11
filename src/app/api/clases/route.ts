import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { crearClaseSchema } from "@/lib/schemas/clase.schema";
import { crearClase } from "@/server/queries/clases";
import { existeEdicion } from "@/server/queries/ediciones";
import {
  fallaInesperada,
  leerCuerpoJson,
  respuestaCamposInvalidos,
} from "@/server/respuestas";

// ── POST /api/clases — crear clase (solo ADMIN) ───────────────────────────────

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

    // Verificar que la edición exista
    const existe = await existeEdicion(parsed.data.edicionId);
    if (!existe) {
      return NextResponse.json(
        {
          error:
            "La edición en la que intentas crear la clase ya no existe. Vuelve a la lista de ediciones y elige una.",
        },
        { status: 404 },
      );
    }

    const clase = await crearClase(parsed.data);
    return NextResponse.json(clase, { status: 201 });
  } catch (error) {
    return fallaInesperada(
      "POST /api/clases",
      error,
      "No se pudo crear la clase y no quedó guardada. Vuelve a intentarlo en unos minutos.",
    );
  }
}
