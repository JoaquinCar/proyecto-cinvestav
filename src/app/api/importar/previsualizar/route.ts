import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ErrorArchivo, parsearArchivo } from "@/lib/importacion/parseo";
import { ErrorPeticion, leerPeticionImportacion } from "@/lib/importacion/peticion";
import {
  ErrorImportacion,
  obtenerEdicionDestino,
  planificarImportacion,
  type EntradaPlan,
} from "@/server/queries/importacion";

// ── POST /api/importar/previsualizar ──────────────────────────────────────────
// Lee el .xlsx, lo compara contra la base y devuelve QUÉ pasaría. No escribe nada.
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

    const plan = await planificarImportacion(entrada);

    return NextResponse.json({
      plan,
      archivo: {
        nombre: peticion.nombreArchivo,
        hoja: parseo.hoja,
        filaEncabezado: parseo.filaEncabezado,
        columnasReconocidas: parseo.columnasReconocidas,
        columnasIgnoradas: parseo.columnasIgnoradas,
        columnasFaltantes: parseo.columnasFaltantes,
        filasLeidas: parseo.filas.length,
      },
    });
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
    console.error("[POST /api/importar/previsualizar]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
