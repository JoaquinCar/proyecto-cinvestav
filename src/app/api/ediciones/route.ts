import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { crearEdicionSchema } from "@/lib/schemas/edicion.schema";
import { listarEdiciones, crearEdicion } from "@/server/queries/ediciones";

// ── GET /api/ediciones — listar todas (cualquier rol autenticado) ─────────────

export async function GET() {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const ediciones = await listarEdiciones();
    return NextResponse.json(ediciones);
  } catch {
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// ── POST /api/ediciones — crear nueva (solo ADMIN) ────────────────────────────

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
    const parsed = crearEdicionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const edicion = await crearEdicion(parsed.data);
    return NextResponse.json(edicion, { status: 201 });
  } catch (error) {
    // Conflict: año duplicado (unique constraint de Prisma)
    if (
      error instanceof Error &&
      error.message.includes("Unique constraint") &&
      error.message.includes("anio")
    ) {
      return NextResponse.json(
        { error: "Ya existe una edición con ese año" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
