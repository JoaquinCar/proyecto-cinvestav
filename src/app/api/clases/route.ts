import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { crearClaseSchema } from "@/lib/schemas/clase.schema";
import { crearClase } from "@/server/queries/clases";
import { existeEdicion } from "@/server/queries/ediciones";

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

    const body: unknown = await request.json();
    const parsed = crearClaseSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    // Verificar que la edición exista
    const existe = await existeEdicion(parsed.data.edicionId);
    if (!existe) {
      return NextResponse.json({ error: "Edición no encontrada" }, { status: 404 });
    }

    const clase = await crearClase(parsed.data);
    return NextResponse.json(clase, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
