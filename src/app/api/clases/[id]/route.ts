import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { editarClaseSchema } from "@/lib/schemas/clase.schema";
import {
  obtenerClasePorId,
  obtenerRangoEdicionDeClase,
  editarClase,
  eliminarClase,
  ClaseConAsistenciasError,
  ClaseNoEncontradaError,
  VariasSesionesError,
} from "@/server/queries/clases";
import {
  assertEdicionDeClaseAbierta,
  EdicionCerradaError,
} from "@/server/queries/edicion-cerrada";
import { estaEnRango, mensajeFueraDeRango } from "@/lib/fechas";
import { exigeInvestigador } from "@/lib/tipos-sesion";
import {
  fallaInesperada,
  leerCuerpoJson,
  respuestaCamposInvalidos,
} from "@/server/respuestas";

type RouteContext = { params: Promise<{ id: string }> };

/** La clase se buscó por id y no está: el enlace o la pestaña están viejos. */
const CLASE_NO_ENCONTRADA =
  "Esta sesión ya no existe: alguien pudo eliminarla. Vuelve a la lista de sesiones para ver las que siguen activas.";

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

    // Tipo e investigador se validan juntos y contra lo YA guardado, porque la
    // petición puede traer solo uno de los dos: cambiar una charla a evento sin
    // mandar investigador es legítimo, y borrarle el investigador a una charla
    // que sigue siendo charla no lo es. `editarClaseSchema` no puede decidirlo
    // solo —no conoce el tipo actual—, así que se decide aquí.
    const tipoFinal = parsed.data.tipo ?? existente.tipo;
    const investigadorFinal =
      parsed.data.investigador !== undefined
        ? parsed.data.investigador
        : existente.investigador;

    if (exigeInvestigador(tipoFinal) && !investigadorFinal) {
      return NextResponse.json(
        {
          error:
            "Una sesión de pasaporte o de lectura necesita el nombre del investigador que la imparte. " +
            "Escríbelo, o cambia el tipo a evento especial si no lo imparte nadie.",
          detalles: { fieldErrors: { investigador: ["El nombre del investigador no puede estar vacío"] } },
        },
        { status: 422 },
      );
    }

    // Cambiar la fecha mueve la sesión de la clase: mismas guardas que crearla.
    if (parsed.data.fecha !== undefined) {
      await assertEdicionDeClaseAbierta(id);

      const rango = await obtenerRangoEdicionDeClase(id);
      if (!rango) {
        return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
      }
      if (!estaEnRango(parsed.data.fecha, rango.fechaInicio, rango.fechaFin)) {
        return NextResponse.json(
          { error: mensajeFueraDeRango(rango.fechaInicio, rango.fechaFin) },
          { status: 422 },
        );
      }
    }

    const claseActualizada = await editarClase(id, parsed.data, session.user.id);
    return NextResponse.json(claseActualizada);
  } catch (error) {
    // La clase tiene varias sesiones: cuál mover es ambiguo, no se adivina.
    if (error instanceof VariasSesionesError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof EdicionCerradaError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    return fallaInesperada(
      "PUT /api/clases/[id]",
      error,
      "No se pudieron guardar los cambios de la sesión. Vuelve a intentarlo en unos minutos.",
    );
  }
}

// ── DELETE /api/clases/[id] — eliminar la sesión (solo ADMIN) ────────────────
//
// Se lleva consigo la fecha (`Sesion`), las imágenes y las asignaciones de
// staff: nada de eso significa nada sin la sesión. Las asistencias NO: son el
// respaldo de las constancias de los niños, así que si las hay la petición se
// rechaza con 409 y los conteos, y solo se borran cuando el ADMIN lo pide
// explícitamente con ?forzar=true — el mismo patrón que
// DELETE /api/inscripciones/[id]. Igual con el resumen importado del Excel,
// que alimenta las estadísticas de la edición.

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    // Allowlist explícita: borrar una sesión es solo de ADMIN. Un BECARIO pasa
    // lista y corrige temas; no da de baja lo que sostiene las constancias.
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Prohibido" }, { status: 403 });
    }

    const { id } = await context.params;

    const existente = await obtenerClasePorId(id);
    if (!existente) {
      return NextResponse.json({ error: CLASE_NO_ENCONTRADA }, { status: 404 });
    }

    // Una edición cerrada no admite escrituras, y borrar una sesión es la más
    // definitiva de todas. Se reabre primero (solo ADMIN) si de verdad hace falta.
    await assertEdicionDeClaseAbierta(id);

    const forzar = new URL(request.url).searchParams.get("forzar") === "true";

    await eliminarClase(id, { forzar });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof ClaseNoEncontradaError) {
      return NextResponse.json({ error: CLASE_NO_ENCONTRADA }, { status: 404 });
    }

    if (error instanceof EdicionCerradaError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    // 409 con los conteos: la pantalla los usa para pedir confirmación en vez
    // de dejar al coordinador adivinando qué se perdería.
    if (error instanceof ClaseConAsistenciasError) {
      return NextResponse.json(
        { error: error.message, conteos: error.conteos },
        { status: 409 },
      );
    }

    return fallaInesperada(
      "DELETE /api/clases/[id]",
      error,
      "No se pudo eliminar la sesión; sigue como estaba. Vuelve a intentarlo en unos minutos.",
    );
  }
}
