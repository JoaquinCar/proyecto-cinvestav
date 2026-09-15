import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { busquedaAcompananteSchema } from "@/lib/schemas/acompanante.schema";
import { buscarAcompanantes } from "@/server/queries/acompanantes";
import { fallaInesperada, mensajeCamposInvalidos } from "@/server/respuestas";

// ── GET /api/acompanantes?q=texto ─────────────────────────────────────────────
// Buscador para REUTILIZAR un acompañante ya capturado: es lo que evita que al
// registrar al segundo hermano se cree una ficha duplicada del mismo adulto.
//
// Solo ADMIN y BECARIO. No es una restricción de comodidad: la respuesta trae
// el teléfono y el correo de un adulto, y READONLY es un rol de consulta de
// reportes y estadísticas, no de captura. Para ver a quién acompaña alguien sin
// su contacto está GET /api/acompanantes/[id].

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { user } = session;
  if (user.role !== "ADMIN" && user.role !== "BECARIO") {
    return NextResponse.json({ error: "Permiso insuficiente" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = busquedaAcompananteSchema.safeParse({
    q: searchParams.get("q") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: mensajeCamposInvalidos(parsed.error), detalles: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const acompanantes = await buscarAcompanantes(parsed.data.q);
    return NextResponse.json({ acompanantes });
  } catch (err) {
    return fallaInesperada(
      "GET /api/acompanantes",
      err,
      "No se pudo buscar entre los acompañantes. Revisa tu conexión y vuelve a intentarlo en unos momentos.",
    );
  }
}
