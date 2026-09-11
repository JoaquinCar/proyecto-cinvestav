import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { obtenerDatosExcel } from "@/server/queries/estadisticas";
import { existeEdicion } from "@/server/queries/ediciones";
import { fallaInesperada } from "@/server/respuestas";
import * as XLSX from "xlsx";

type RouteContext = { params: Promise<{ edicionId: string }> };

export async function GET(_req: Request, context: RouteContext) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    }
    const { edicionId } = await context.params;

    // Antes, una edición inexistente bajaba un Excel vacío sin decir nada.
    if (!(await existeEdicion(edicionId))) {
      return NextResponse.json(
        {
          error:
            "La edición que intentas exportar ya no existe. Vuelve a la lista de ediciones y elige una.",
        },
        { status: 404 },
      );
    }

    const datos = await obtenerDatosExcel(edicionId);
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(datos);
    XLSX.utils.book_append_sheet(wb, ws, "Participantes");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="participantes-${edicionId}.xlsx"`,
      },
    });
  } catch (error) {
    return fallaInesperada(
      "GET /api/exportar/excel/[edicionId]",
      error,
      "No se pudo generar el archivo de Excel. Vuelve a intentarlo en unos minutos.",
    );
  }
}
