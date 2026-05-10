import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { obtenerDatosReporteClase } from "@/server/queries/reportes";
import { generarPDFReporteClase } from "@/lib/pdf/reporte-clase";

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
      return NextResponse.json({ error: "Clase no encontrada" }, { status: 404 });
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
  } catch {
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
