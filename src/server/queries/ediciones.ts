import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import type { CrearEdicionInput, EditarEdicionInput } from "@/lib/schemas/edicion.schema";
import { SESION_CAPTURADA } from "./asistencia-de-sesion";
import { CLASES_QUE_CUENTAN } from "@/lib/tipos-sesion";

// ── Listar todas las ediciones ────────────────────────────────────────────────

export async function listarEdiciones() {
  return prisma.edicion.findMany({
    orderBy: { anio: "desc" },
    select: {
      id: true,
      anio: true,
      nombre: true,
      fechaInicio: true,
      fechaFin: true,
      minAsistencias: true,
      porcentajeMinimo: true,
      asistenciaGlobal: true,
      activa: true,
      cerrada: true,
      cerradaAt: true,
      createdAt: true,
      _count: {
        select: {
          inscripciones: true,
          // Solo las sesiones que cuentan. La tarjeta «Sesiones» enseñaba el
          // inventario entero —pasaporte, lectura y eventos— y quedaba un «22»
          // al lado de un «12 de 12» que hablaba de otra cosa. Decisión del
          // coordinador el 15 de octubre de 2026: aquí tampoco se cuentan la
          // lectura ni los eventos. El inventario completo sigue en la lista
          // de sesiones y en «Actividades por tipo».
          clases: { where: CLASES_QUE_CUENTAN },
        },
      },
    },
  });
}

// ── Obtener una edición por ID con conteos ────────────────────────────────────

export async function obtenerEdicionPorId(id: string) {
  const edicion = await prisma.edicion.findUnique({
    where: { id },
    select: {
      id: true,
      anio: true,
      nombre: true,
      fechaInicio: true,
      fechaFin: true,
      minAsistencias: true,
      porcentajeMinimo: true,
      asistenciaGlobal: true,
      activa: true,
      cerrada: true,
      cerradaAt: true,
      createdAt: true,
      _count: {
        select: {
          inscripciones: true,
          // Solo las sesiones que cuentan. La tarjeta «Sesiones» enseñaba el
          // inventario entero —pasaporte, lectura y eventos— y quedaba un «22»
          // al lado de un «12 de 12» que hablaba de otra cosa. Decisión del
          // coordinador el 15 de octubre de 2026: aquí tampoco se cuentan la
          // lectura ni los eventos. El inventario completo sigue en la lista
          // de sesiones y en «Actividades por tipo».
          clases: { where: CLASES_QUE_CUENTAN },
        },
      },
    },
  });

  if (!edicion) return null;

  // Sesiones registradas y, aparte, cuántas tienen la asistencia capturada.
  // Antes el segundo conteo filtraba solo por `resumen`, es decir solo por el
  // Excel del organizador, de modo que una edición capturada entera desde la
  // aplicación salía en «0 de 7» y nada en pantalla movía ese número. La
  // definición vive en un solo sitio.
  //
  // Los dos conteos miran SOLO las sesiones que cuentan —hoy las de pasaporte,
  // ver `src/lib/tipos-sesion.ts`—, que es lo que hace que esta ficha diga «12
  // de 12» y no «12 de 22». La tarjeta «Sesiones» usa ahora el mismo criterio:
  // toda cifra de esta pantalla habla de lo mismo.
  const [sesionesTotal, sesionesCapturadas] = await Promise.all([
    prisma.sesion.count({
      where: { clase: { edicionId: id, ...CLASES_QUE_CUENTAN } },
    }),
    prisma.sesion.count({
      where: { clase: { edicionId: id, ...CLASES_QUE_CUENTAN }, ...SESION_CAPTURADA },
    }),
  ]);

  return { ...edicion, sesionesTotal, sesionesCapturadas };
}

// ── Crear nueva edición ───────────────────────────────────────────────────────

export async function crearEdicion(data: CrearEdicionInput) {
  return prisma.edicion.create({
    data: {
      anio: data.anio,
      nombre: data.nombre,
      fechaInicio: new Date(data.fechaInicio),
      fechaFin: new Date(data.fechaFin),
      minAsistencias: data.minAsistencias,
      porcentajeMinimo: data.porcentajeMinimo,
      asistenciaGlobal: data.asistenciaGlobal,
    },
  });
}

// ── Editar una edición existente ──────────────────────────────────────────────

export async function editarEdicion(id: string, data: EditarEdicionInput) {
  return prisma.edicion.update({
    where: { id },
    data: {
      ...(data.anio !== undefined && { anio: data.anio }),
      ...(data.nombre !== undefined && { nombre: data.nombre }),
      ...(data.fechaInicio !== undefined && {
        fechaInicio: new Date(data.fechaInicio),
      }),
      ...(data.fechaFin !== undefined && {
        fechaFin: new Date(data.fechaFin),
      }),
      ...(data.minAsistencias !== undefined && {
        minAsistencias: data.minAsistencias,
      }),
      ...(data.porcentajeMinimo !== undefined && {
        porcentajeMinimo: data.porcentajeMinimo,
      }),
      ...(data.asistenciaGlobal !== undefined && {
        asistenciaGlobal: data.asistenciaGlobal,
      }),
    },
  });
}

// ── Eliminar edición ─────────────────────────────────────────────────────────
//
// El guardia solo miraba las inscripciones, pero de una edición también cuelgan
// sus SESIONES, y esa llave foránea no cascadea. Una edición de prueba con
// sesiones y ningún niño inscrito pasaba el guardia y reventaba después en
// Prisma, y el `catch` de la ruta lo devolvía como «Error interno del
// servidor»: el coordinador no podía borrarla ni saber por qué.
//
// Qué se lleva el borrado y qué se para:
//
//   · Las sesiones y sus fechas se van con la edición cuando NADIE pasó lista.
//     Un calendario sin asistencia es andamiaje, no historial, y obligar a
//     borrarlo a mano antes no protege nada: solo estorba.
//   · Las inscripciones y las asistencias NO. Son el respaldo de las
//     constancias de los niños, y perderlas tiene que ser un acto deliberado:
//     se responde 409 con los conteos y solo se borra si un ADMIN lo confirma.
//
// Mismo patrón que `eliminarClase` y que la baja de una inscripción.

export interface ConteosDeEdicion {
  inscripciones: number;
  sesiones: number;
  fechas: number;
  asistencias: number;
  participantes: number;
}

// Recibe el cliente de la transacción, NO el global. Esto importa de verdad:
// un `prisma.*` suelto dentro de un `$transaction` pide una SEGUNDA conexión
// mientras la transacción retiene la primera. En local, donde el pozo de
// conexiones es amplio y la base está a menos de un milisegundo, no se nota;
// en Vercel con Supabase, donde las funciones corren con el pozo al mínimo,
// esa segunda conexión puede no llegar nunca y la transacción muere esperando.
// Con `tx` todo viaja por la misma conexión y además los conteos son
// consistentes con el borrado: nadie puede inscribir a un niño entre la
// comprobación y el delete.
export async function contarArrastreDeEdicion(
  db: Prisma.TransactionClient,
  id: string,
): Promise<ConteosDeEdicion> {
  const [inscripciones, sesiones, fechas, asistencias, conAsistencia] =
    await Promise.all([
      db.inscripcion.count({ where: { edicionId: id } }),
      db.clase.count({ where: { edicionId: id } }),
      db.sesion.count({ where: { clase: { edicionId: id } } }),
      db.asistencia.count({ where: { inscripcion: { edicionId: id } } }),
      // Cuántos NIÑOS distintos quedarían sin respaldo, no cuántas marcas:
      // «47 asistencias» no dice a cuánta gente afecta.
      db.asistencia.findMany({
        where:    { inscripcion: { edicionId: id } },
        distinct: ["inscripcionId"],
        select:   { inscripcionId: true },
      }),
    ]);

  return {
    inscripciones,
    sesiones,
    fechas,
    asistencias,
    participantes: conAsistencia.length,
  };
}

function mensajeEdicionConHistorial(
  nombre: string,
  c: ConteosDeEdicion,
): string {
  const partes: string[] = [];
  if (c.inscripciones > 0) {
    partes.push(`${c.inscripciones} niño(s) inscrito(s)`);
  }
  if (c.asistencias > 0) {
    partes.push(
      `${c.asistencias} asistencia(s) de ${c.participantes} niño(s), que es el respaldo de sus constancias`,
    );
  }

  return (
    `No se puede eliminar «${nombre}» sin confirmarlo: tiene ${partes.join(" y ")}. ` +
    `Si la edición se creó por error, confirma el borrado y se eliminará junto con ese historial. ` +
    `Si solo sobran algunos niños, cancela y dalos de baja uno a uno.`
  );
}

export async function eliminarEdicion(
  id: string,
  opciones: { forzar?: boolean } = {},
) {
  return prisma.$transaction(
    async (tx) => {
      const edicion = await tx.edicion.findUnique({
        where:  { id },
        select: { id: true, nombre: true },
      });

      if (!edicion) {
        throw new EdicionNoEncontradaError(
          "Esta edición ya no existe: alguien pudo eliminarla. Vuelve a la " +
            "lista de ediciones para ver las que siguen activas.",
        );
      }

      const conteos = await contarArrastreDeEdicion(tx, id);

      if (
        !opciones.forzar &&
        (conteos.inscripciones > 0 || conteos.asistencias > 0)
      ) {
        throw new EdicionConInscripcionesError(
          mensajeEdicionConHistorial(edicion.nombre, conteos),
          conteos,
        );
      }

      // Cascada explícita en la aplicación, no en la llave foránea: el orden
      // lo mandan las dependencias, y hacerlo a la vista evita que un
      // `onDelete` silencioso se lleve por delante el historial de un niño.
      if (conteos.asistencias > 0) {
        await tx.asistencia.deleteMany({
          where: { inscripcion: { edicionId: id } },
        });
      }
      await tx.sesion.deleteMany({ where: { clase: { edicionId: id } } });
      await tx.clase.deleteMany({ where: { edicionId: id } });
      if (conteos.inscripciones > 0) {
        await tx.inscripcion.deleteMany({ where: { edicionId: id } });
      }

      return tx.edicion.delete({ where: { id } });
    },
    // La base vive al otro lado de internet, no en la máquina. Los 5 s por
    // omisión de Prisma se pensaron para una base local; aquí cada ida y
    // vuelta cuesta ~100 ms y una edición entera son varias. Borrar una
    // edición se hace una vez al año: que tarde no importa, que se quede a
    // medias sí —y una transacción agotada deja el borrado sin terminar.
    { timeout: 20_000, maxWait: 10_000 },
  );
}

// ── Activar edición (transacción: desactivar todas, luego activar la nueva) ──

export async function activarEdicion(id: string) {
  return prisma.$transaction(async (tx) => {
    // 1. Desactivar todas las ediciones
    await tx.edicion.updateMany({
      data: { activa: false },
    });

    // 2. Activar la edición solicitada
    return tx.edicion.update({
      where: { id },
      data: { activa: true },
    });
  });
}

// ── Cerrar / reabrir una edición ─────────────────────────────────────────────
// Cerrar congela las escrituras (asistencias, sesiones, temas) conservando la
// lectura, las estadísticas y las constancias. Solo ADMIN lo hace, y es
// reversible: `cerradaAt` deja constancia de cuándo se congeló.
// Ver el porqué del diseño en src/server/queries/edicion-cerrada.ts.

export async function cerrarEdicion(id: string) {
  return prisma.edicion.update({
    where: { id },
    data: { cerrada: true, cerradaAt: new Date() },
  });
}

export async function reabrirEdicion(id: string) {
  return prisma.edicion.update({
    where: { id },
    data: { cerrada: false, cerradaAt: null },
  });
}

// ── Verificar existencia de edición ──────────────────────────────────────────

export async function existeEdicion(id: string): Promise<boolean> {
  const edicion = await prisma.edicion.findUnique({
    where: { id },
    select: { id: true },
  });
  return edicion !== null;
}

// ── Error personalizado ───────────────────────────────────────────────────────

export class EdicionConInscripcionesError extends Error {
  /** Para que la pantalla pregunte con los mismos números, no a ciegas. */
  readonly conteos?: ConteosDeEdicion;

  constructor(message: string, conteos?: ConteosDeEdicion) {
    super(message);
    this.name = "EdicionConInscripcionesError";
    this.conteos = conteos;
  }
}

export class EdicionNoEncontradaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EdicionNoEncontradaError";
  }
}
