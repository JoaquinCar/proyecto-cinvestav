import { NextResponse } from "next/server";
import type { Role } from "@prisma/client";
import { auth } from "@/lib/auth";
import { obtenerDatosInformeSesion } from "@/server/queries/informe-sesion";
import { generarInformeSesionWord } from "@/lib/word/informe-sesion";
import { fallaInesperada } from "@/server/respuestas";

type RouteContext = { params: Promise<{ claseId: string }> };

/** Tipo MIME de un .docx. Word no abre el archivo si llega como octet-stream. */
const TIPO_DOCX =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * Quién puede exportar el informe.
 *
 * ADMIN y BECARIO: son quienes arman el reporte de la sesión, y el becario es
 * el que está en campo con las fotos recién subidas.
 *
 * READONLY NO. Puede consultar reportes y estadísticas en pantalla, pero el
 * documento lleva la lista nominal de los niños que asistieron y sale de la
 * aplicación en un archivo que ya no se puede revocar. Lista explícita y no
 * «cualquiera con sesión»: un rol nuevo entra sin poder exportar hasta que
 * alguien lo decida a propósito.
 */
const ROLES_QUE_EXPORTAN: readonly Role[] = ["ADMIN", "BECARIO"];

// ── GET /api/word/informe-sesion/[claseId] ────────────────────────────────────
//
// Devuelve el informe de la sesión en el formato Word del cliente: el mismo
// documento que hasta ahora se llenaba a mano, con su banner institucional, su
// portada, sus fotos con pie y —anexada— la lista de quién participó.

export async function GET(_request: Request, context: RouteContext) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    if (!ROLES_QUE_EXPORTAN.includes(session.user.role)) {
      return NextResponse.json({ error: "Prohibido" }, { status: 403 });
    }

    const { claseId } = await context.params;

    const informe = await obtenerDatosInformeSesion(claseId);
    if (!informe) {
      return NextResponse.json(
        {
          error:
            "Esta sesión ya no existe, así que no hay informe que generar. " +
            "Vuelve a la lista de sesiones para ver las que siguen activas.",
        },
        { status: 404 },
      );
    }

    const documento = await generarInformeSesionWord(informe.datos);

    return new NextResponse(new Uint8Array(documento), {
      status: 200,
      headers: {
        "Content-Type": TIPO_DOCX,
        "Content-Length": String(documento.length),
        // El nombre ya viene saneado a ASCII en `obtenerDatosInformeSesion`: el
        // tema de la sesión lo escribe una persona y no debe poder inyectar
        // nada en esta cabecera.
        "Content-Disposition": `attachment; filename="${informe.nombreArchivo}.docx"`,
        // En el documento aparecen menores. Ninguna caché compartida debe
        // quedarse una copia: la respuesta depende de la sesión, no del URL.
        "Cache-Control": "private, no-store",
        Vary: "Cookie",
      },
    });
  } catch (error) {
    return fallaInesperada(
      "GET /api/word/informe-sesion/[claseId]",
      error,
      "No se pudo generar el informe en Word de esta sesión. Vuelve a intentarlo en unos minutos.",
    );
  }
}
