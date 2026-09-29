import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { obtenerStaff } from "@/server/queries/staff";
import { fallaInesperada } from "@/server/respuestas";

/** La persona buscada no está en la base. */
const STAFF_NO_ENCONTRADO =
  "No se encontró a esta persona de staff: puede que alguien haya eliminado su ficha. Vuelve a la sesión para ver quién está asignado ahora.";

// ── GET /api/staff/[id] ───────────────────────────────────────────────────────
// En qué sesiones participa: las veinte de este año, o las de hace tres.
//
// Disponible para los tres roles, pero el contacto (teléfono y correo) se omite
// para READONLY, que solo consulta reportes. Mismo criterio —y mismo código—
// que GET /api/acompanantes/[id].

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  if (!id || typeof id !== "string") {
    return NextResponse.json(
      { error: "El enlace a la persona de staff está incompleto. Vuelve a abrirlo desde la sesión." },
      { status: 400 },
    );
  }

  try {
    const staff = await obtenerStaff(id);

    if (!staff) {
      return NextResponse.json({ error: STAFF_NO_ENCONTRADO }, { status: 404 });
    }

    const puedeVerContacto =
      session.user.role === "ADMIN" || session.user.role === "BECARIO";

    return NextResponse.json({
      staff: {
        ...staff,
        telefono: puedeVerContacto ? staff.telefono : null,
        correo:   puedeVerContacto ? staff.correo   : null,
      },
    });
  } catch (err) {
    return fallaInesperada(
      "GET /api/staff/[id]",
      err,
      "No se pudo cargar la ficha de esta persona. Revisa tu conexión y vuelve a intentarlo en unos momentos.",
    );
  }
}
