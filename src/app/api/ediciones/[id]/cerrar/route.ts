import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  obtenerEdicionPorId,
  cerrarEdicion,
  reabrirEdicion,
} from "@/server/queries/ediciones";

type RouteContext = { params: Promise<{ id: string }> };

// ── Cerrar / reabrir una edición (solo ADMIN) ────────────────────────────────
//
// Cerrar congela las escrituras del ciclo de captura (asistencias, sesiones,
// temas) y deja intactas la lectura, las estadísticas, los reportes y las
// constancias. Reabrir es posible pero deliberado: un BECARIO no puede hacerlo,
// tiene que pedírselo al coordinador.
//
// POST  → lo usa el formulario del UI (HTML solo permite GET/POST) y redirige.
// PUT   → equivalente para clientes fetch/API, responde JSON.
//
// El sentido se toma del campo `accion` ("cerrar" | "reabrir"). Sin él, cierra.

async function aplicar(id: string, accion: string) {
  const session = await auth();
  if (!session) return { error: "No autorizado", status: 401 as const };
  if (session.user.role !== "ADMIN")
    return { error: "Prohibido", status: 403 as const };

  const existente = await obtenerEdicionPorId(id);
  if (!existente) return { error: "Edición no encontrada", status: 404 as const };

  const edicion =
    accion === "reabrir" ? await reabrirEdicion(id) : await cerrarEdicion(id);

  return { edicion };
}

async function leerAccion(request: Request): Promise<string> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    try {
      const body = (await request.json()) as { accion?: unknown };
      return typeof body?.accion === "string" ? body.accion : "cerrar";
    } catch {
      return "cerrar";
    }
  }

  if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    try {
      const form = await request.formData();
      const accion = form.get("accion");
      return typeof accion === "string" ? accion : "cerrar";
    } catch {
      return "cerrar";
    }
  }

  return "cerrar";
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const accion = await leerAccion(request);
    const res = await aplicar(id, accion);
    if ("error" in res) {
      return NextResponse.json({ error: res.error }, { status: res.status });
    }
    return NextResponse.redirect(new URL(`/ediciones/${id}`, request.url), 303);
  } catch {
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const accion = await leerAccion(request);
    const res = await aplicar(id, accion);
    if ("error" in res) {
      return NextResponse.json({ error: res.error }, { status: res.status });
    }
    return NextResponse.json(res.edicion);
  } catch {
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
