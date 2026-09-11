import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { editarClaseSchema } from "@/lib/schemas/clase.schema";
import {
  obtenerClasePorId,
  editarClase,
  eliminarClase,
  ClaseConAsistenciasError,
  ClaseConSesionesError,
} from "@/server/queries/clases";
import {
  fallaInesperada,
  leerCuerpoJson,
  respuestaCamposInvalidos,
} from "@/server/respuestas";

type RouteContext = { params: Promise<{ id: string }> };

/** La clase se buscó por id y no está: el enlace o la pestaña están viejos. */
const CLASE_NO_ENCONTRADA =
  "Esta clase ya no existe: alguien pudo eliminarla. Vuelve a la lista de clases para ver las que siguen activas.";

// ── PUT /api/clases/[id] — editar clase (solo ADMIN) ──────────────────────────

export async function PUT(request: Request, context: RouteContext) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Prohibido" }, { status: 403 });
    }

    const { id } = await context.params;

    const existente = await obtenerClasePorId(id);
    if (!existente) {
      return NextResponse.json({ error: CLASE_NO_ENCONTRADA }, { status: 404 });
    }

    const cuerpo = await leerCuerpoJson(request);
    if (!cuerpo.ok) return cuerpo.respuesta;

    const parsed = editarClaseSchema.safeParse(cuerpo.datos);

    if (!parsed.success) {
      return respuestaCamposInvalidos(parsed.error);
    }

    const claseActualizada = await editarClase(id, parsed.data);
    return NextResponse.json(claseActualizada);
  } catch (error) {
    return fallaInesperada(
      "PUT /api/clases/[id]",
      error,
      "No se pudieron guardar los cambios de la clase. Vuelve a intentarlo en unos minutos.",
    );
  }
}

// ── DELETE /api/clases/[id] — eliminar si no arrastra nada (solo ADMIN) ───────

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

    const existente = await obtenerClasePorId(id);
    if (!existente) {
      return NextResponse.json({ error: CLASE_NO_ENCONTRADA }, { status: 404 });
    }

    await eliminarClase(id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof ClaseConAsistenciasError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    // Antes esto llegaba hasta el `catch` de abajo y salía como 500: la llave
    // foránea de Sesion → Clase reventaba sin que nadie supiera por qué.
    if (error instanceof ClaseConSesionesError) {
      return NextResponse.json(
        { error: error.message, sesiones: error.sesiones },
        { status: 409 },
      );
    }

    return fallaInesperada(
      "DELETE /api/clases/[id]",
      error,
      "No se pudo eliminar la clase; sigue como estaba. Vuelve a intentarlo en unos minutos.",
    );
  }
}
