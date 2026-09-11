import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { generarPlantilla, plantillaDe } from "@/lib/importacion/plantillas";
import { tipoImportacionSchema } from "@/lib/schemas/importacion.schema";
import { fallaInesperada, mensajeCamposInvalidos } from "@/server/respuestas";

const consultaSchema = z.object({
  tipo: tipoImportacionSchema,
  anio: z.coerce.number().int().min(2000).max(2100).optional(),
});

// ── GET /api/importar/plantilla?tipo=participantes&anio=2026 ──────────────────
// Devuelve el .xlsx con los encabezados exactos que espera el importador.
// Solo ADMIN (es la puerta de entrada a la importación).

export async function GET(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Solo el administrador puede importar datos" },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(request.url);
  const parsed = consultaSchema.safeParse({
    tipo: searchParams.get("tipo"),
    anio: searchParams.get("anio") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: mensajeCamposInvalidos(parsed.error), detalles: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const anio = parsed.data.anio ?? new Date().getFullYear();

  try {
    const buffer = generarPlantilla(parsed.data.tipo, anio);
    const { nombreArchivo } = plantillaDe(parsed.data.tipo, anio);
    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${nombreArchivo}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return fallaInesperada(
      "GET /api/importar/plantilla",
      err,
      "No se pudo generar la plantilla de Excel. Vuelve a intentarlo en unos minutos.",
    );
  }
}
