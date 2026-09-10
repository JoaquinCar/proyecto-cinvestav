import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { subirImagenClaseSchema } from "@/lib/schemas/clase.schema";
import { obtenerClasePorId } from "@/server/queries/clases";
import {
  listarImagenesDeClaseConUrl,
  crearImagenClase,
  firmarImagenes,
  ImagenNoAlmacenableError,
} from "@/server/queries/imagenes-clase";

type RouteContext = { params: Promise<{ id: string }> };

// Las URLs firmadas caducan, así que nada de esta respuesta puede cachearse.
export const dynamic = "force-dynamic";

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

    // Solo llega aquí quien tiene sesión válida: firmar una URL es dar acceso
    // a la foto, y en estas fotos aparecen menores.
    const imagenes = await listarImagenesDeClaseConUrl(id);
    return NextResponse.json(imagenes);
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

    // Se responde con la URL ya firmada, nunca con la referencia interna
    // `supabase://…` que se guarda en la base.
    const [imagenConUrl] = await firmarImagenes([imagen]);
    return NextResponse.json(imagenConUrl, { status: 201 });
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
