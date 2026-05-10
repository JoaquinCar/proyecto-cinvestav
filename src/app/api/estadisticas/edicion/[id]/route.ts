import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { obtenerMetricasEdicion } from "@/server/queries/estadisticas";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: RouteContext) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const { id } = await context.params;
    const metricas = await obtenerMetricasEdicion(id);
    return NextResponse.json({ metricas });
  } catch {
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
