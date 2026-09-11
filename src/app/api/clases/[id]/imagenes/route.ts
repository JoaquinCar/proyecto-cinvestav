import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { subirImagenClaseSchema } from "@/lib/schemas/clase.schema";
import { obtenerClasePorId } from "@/server/queries/clases";
import {
  listarImagenesDeClaseConUrl,
  crearImagenClase,
  resolverImagenParaVista,
  ImagenNoAlmacenableError,
} from "@/server/queries/imagenes-clase";
import {
  fallaInesperada,
  leerCuerpoJson,
  respuestaCamposInvalidos,
} from "@/server/respuestas";

/** La clase cuyas imágenes se piden ya no está. */
const CLASE_NO_ENCONTRADA =
  "Esta clase ya no existe: alguien pudo eliminarla. Vuelve a la lista de clases para ver las que siguen activas.";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * El listado ya no lleva URLs firmadas que caduquen, pero sigue sin poder
 * cachearse: describe el contenido de una clase para una sesión concreta y, en
 * el respaldo sin Storage, incluye los data URI de las fotos dentro del propio
 * JSON. `no-store` lo dice de forma explícita en la respuesta, que además de al
 * CDN alcanza al navegador; el antiguo `force-dynamic` solo evitaba que Next
 * prerenderizara la ruta —algo que de todos modos no ocurre, porque `auth()`
 * lee la cookie de sesión y eso convierte la ruta en dinámica.
 */
const CACHE_LISTADO = "private, no-store";

// ── GET /api/clases/[id]/imagenes — listar imágenes de la clase ───────────────

export async function GET(_request: Request, context: RouteContext) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await context.params;

    const clase = await obtenerClasePorId(id);
    if (!clase) {
      return NextResponse.json({ error: CLASE_NO_ENCONTRADA }, { status: 404 });
    }

    // Las URLs que salen apuntan al proxy autenticado, que vuelve a comprobar la
    // sesión al pedir cada archivo: este listado no reparte acceso por sí solo.
    const imagenes = await listarImagenesDeClaseConUrl(id);
    return NextResponse.json(imagenes, {
      headers: { "Cache-Control": CACHE_LISTADO },
    });
  } catch (error) {
    return fallaInesperada(
      "GET /api/clases/[id]/imagenes",
      error,
      "No se pudieron cargar las imágenes de la clase. Vuelve a intentarlo en unos momentos.",
    );
  }
}

// ── POST /api/clases/[id]/imagenes — subir imagen (ADMIN y BECARIO) ───────────

export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    if (session.user.role !== "ADMIN" && session.user.role !== "BECARIO") {
      return NextResponse.json({ error: "Prohibido" }, { status: 403 });
    }

    const { id } = await context.params;

    const clase = await obtenerClasePorId(id);
    if (!clase) {
      return NextResponse.json({ error: CLASE_NO_ENCONTRADA }, { status: 404 });
    }

    const cuerpo = await leerCuerpoJson(request);
    if (!cuerpo.ok) return cuerpo.respuesta;

    const parsed = subirImagenClaseSchema.safeParse(cuerpo.datos);

    if (!parsed.success) {
      return respuestaCamposInvalidos(parsed.error);
    }

    const imagen = await crearImagenClase(id, parsed.data);

    // Se responde con la ruta del proxy, nunca con la referencia interna
    // `supabase://…` que se guarda en la base.
    const imagenConUrl = resolverImagenParaVista(imagen);
    return NextResponse.json(imagenConUrl, {
      status: 201,
      headers: { "Cache-Control": CACHE_LISTADO },
    });
  } catch (error) {
    if (error instanceof ImagenNoAlmacenableError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }

    return fallaInesperada(
      "POST /api/clases/[id]/imagenes",
      error,
      "No se pudo guardar la imagen y no quedó agregada a la clase. Vuelve a intentarlo en unos minutos.",
    );
  }
}
