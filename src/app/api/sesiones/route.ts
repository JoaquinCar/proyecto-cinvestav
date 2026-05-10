import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { crearSesionSchema } from "@/lib/schemas/clase.schema";
import { crearSesion, obtenerClasePorId } from "@/server/queries/clases";

// ── POST /api/sesiones — crear sesión (ADMIN o BECARIO) ──────────────────────

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    if (session.user.role === "READONLY") {
      return NextResponse.json({ error: "Prohibido" }, { status: 403 });
    }

    const body: unknown = await request.json();
    const parsed = crearSesionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    // Verificar que la clase exista
    const clase = await obtenerClasePorId(parsed.data.claseId);
    if (!clase) {
      return NextResponse.json({ error: "Clase no encontrada" }, { status: 404 });
    }

    const sesion = await crearSesion(parsed.data, session.user.id);
    return NextResponse.json(sesion, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
