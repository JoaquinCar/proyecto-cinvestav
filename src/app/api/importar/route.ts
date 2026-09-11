import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ErrorArchivo, parsearArchivo } from "@/lib/importacion/parseo";
import { ErrorPeticion, leerPeticionImportacion } from "@/lib/importacion/peticion";
import {
  ErrorImportacion,
  ejecutarImportacion,
  obtenerEdicionDestino,
  planificarImportacion,
  type EntradaPlan,
} from "@/server/queries/importacion";
import { fallaInesperada } from "@/server/respuestas";

// ── POST /api/importar ────────────────────────────────────────────────────────
// Importación real. Reanaliza el archivo (nunca confía en lo que mandó el
// navegador), vuelve a planificar y aplica todo dentro de una transacción.
// Solo ADMIN.

export async function POST(request: Request) {
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

  try {
    const peticion = await leerPeticionImportacion(request);
    const edicion = await obtenerEdicionDestino(peticion.edicionId);
    const parseo = parsearArchivo(peticion.archivo, peticion.tipo, edicion.anio);

    const entrada: EntradaPlan = {
      tipo: peticion.tipo,
      edicion,
      erroresParseo: parseo.errores,
      avisosParseo: parseo.avisos,
      columnasSesion: parseo.columnasSesion,
      ...(parseo.tipo === "participantes" ? { filasParticipantes: parseo.filas } : {}),
      ...(parseo.tipo === "sesiones" ? { filasSesiones: parseo.filas } : {}),
      ...(parseo.tipo === "asistencia" ? { filasAsistencia: parseo.filas } : {}),
    };

    // Si algo cambió entre la vista previa y la confirmación, esto lo detecta.
    const plan = await planificarImportacion(entrada);
    if (!plan.puedeImportar) {
      return NextResponse.json(
        {
          error: plan.errores.length
            ? "El archivo tiene errores; no se importó nada."
            : "No hay nada que importar en este archivo.",
          plan,
        },
        { status: 422 },
      );
    }

    const resultado = await ejecutarImportacion(entrada);
    return NextResponse.json({ resultado, edicion });
  } catch (err) {
    if (err instanceof ErrorPeticion) {
      return NextResponse.json(
        { error: err.message, detalles: err.detalles },
        { status: err.estado },
      );
    }
    if (err instanceof ErrorArchivo || err instanceof ErrorImportacion) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    return fallaInesperada(
      "POST /api/importar",
      err,
      "Ocurrió un problema en el servidor durante la importación y no se guardó ningún cambio: la base quedó igual que antes. Vuelve a intentarlo con el mismo archivo.",
    );
  }
}
