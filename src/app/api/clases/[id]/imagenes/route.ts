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
      return NextResponse.json({ error: "Clase no encontrada" }, { status: 404 });
    }

    // Las URLs que salen apuntan al proxy autenticado, que vuelve a comprobar la
    // sesión al pedir cada archivo: este listado no reparte acceso por sí solo.
    const imagenes = await listarImagenesDeClaseConUrl(id);
    return NextResponse.json(imagenes, {
      headers: { "Cache-Control": CACHE_LISTADO },
    });
  } catch {
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
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
      return NextResponse.json({ error: "Clase no encontrada" }, { status: 404 });
    }

    const body: unknown = await request.json();
    const parsed = subirImagenClaseSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 422 },
      );
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

    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
