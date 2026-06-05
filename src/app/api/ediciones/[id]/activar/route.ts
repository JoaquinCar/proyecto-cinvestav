import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  obtenerEdicionPorId,
  activarEdicion,
} from "@/server/queries/ediciones";

type RouteContext = { params: Promise<{ id: string }> };

// Lógica compartida: valida sesión/rol/existencia y activa la edición.
async function activar(id: string) {
  const session = await auth();
  if (!session) return { error: "No autorizado", status: 401 as const };
  if (session.user.role !== "ADMIN")
    return { error: "Prohibido", status: 403 as const };

  const existente = await obtenerEdicionPorId(id);
  if (!existente) return { error: "Edición no encontrada", status: 404 as const };

  const edicion = await activarEdicion(id);
  return { edicion };
}

// ── POST — usado por el form del UI (HTML solo permite GET/POST) ──────────────
// Desactiva la edición activa anterior y redirige de vuelta al detalle.
export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const res = await activar(id);
    if ("error" in res) {
      return NextResponse.json({ error: res.error }, { status: res.status });
    }
    return NextResponse.redirect(new URL(`/ediciones/${id}`, request.url), 303);
  } catch {
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

// ── PUT — equivalente para clientes API/fetch ─────────────────────────────────
export async function PUT(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const res = await activar(id);
    if ("error" in res) {
      return NextResponse.json({ error: res.error }, { status: res.status });
    }
    return NextResponse.json(res.edicion);
  } catch {
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
