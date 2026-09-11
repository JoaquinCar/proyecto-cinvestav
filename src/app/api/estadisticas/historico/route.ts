import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  obtenerHistoricoEdiciones,
  obtenerEscuelasRecurrentes,
  obtenerParticipantesRecurrentes,
} from "@/server/queries/historico";
import { fallaInesperada } from "@/server/respuestas";

export async function GET() {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const [ediciones, escuelas, participantes] = await Promise.all([
      obtenerHistoricoEdiciones(),
      obtenerEscuelasRecurrentes(),
      obtenerParticipantesRecurrentes(),
    ]);
    return NextResponse.json({ ediciones, escuelas, participantes });
  } catch (error) {
    return fallaInesperada(
      "GET /api/estadisticas/historico",
      error,
      "No se pudo cargar la comparación entre ediciones. Vuelve a intentarlo en unos momentos.",
    );
  }
}
