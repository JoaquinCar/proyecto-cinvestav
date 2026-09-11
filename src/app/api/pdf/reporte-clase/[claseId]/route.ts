import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { obtenerDatosReporteClase } from "@/server/queries/reportes";
import { generarPDFReporteClase } from "@/lib/pdf/reporte-clase";
import { fallaInesperada } from "@/server/respuestas";

type RouteContext = { params: Promise<{ claseId: string }> };

export async function GET(_req: Request, context: RouteContext) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const { claseId } = await context.params;
    const datos = await obtenerDatosReporteClase(claseId);
    if (!datos) {
      return NextResponse.json(
        {
          error:
            "Esta clase ya no existe, así que no hay reporte que generar. Vuelve a la lista de clases para ver las que siguen activas.",
        },
        { status: 404 },
      );
    }
    const buffer = await generarPDFReporteClase(datos);
    const filename = `reporte-${datos.clase.nombre.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`;
    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return fallaInesperada(
      "GET /api/pdf/reporte-clase/[claseId]",
      error,
      "No se pudo generar el reporte en PDF de esta clase. Vuelve a intentarlo en unos minutos.",
    );
  }
}
