import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { TIPO_SESION_POR_DEFECTO, type TipoSesion } from "@/lib/tipos-sesion";
import type {
  CrearClaseInput,
  EditarClaseInput,
  CrearSesionInput,
  ActualizarSesionInput,
} from "@/lib/schemas/clase.schema";

// ── Tipos de retorno ──────────────────────────────────────────────────────────

export type ClaseConConteos = Awaited<ReturnType<typeof listarClasesDeEdicion>>[number];
export type SesionDetalle   = Awaited<ReturnType<typeof listarSesionesDeClase>>[number];

// ── Listar clases de una edición con conteos ──────────────────────────────────

/**
 * Clases de una edición, opcionalmente de un solo tipo.
 *
 * El filtro por tipo es lo que permite que /eventos sea la misma pantalla que
 * /clases sin duplicar modelo ni consultas: es este listado acotado a EVENTO.
 */
export async function listarClasesDeEdicion(edicionId: string, tipo?: TipoSesion) {
  return prisma.clase.findMany({
    where:   { edicionId, ...(tipo && { tipo }) },
    orderBy: { createdAt: "asc" },
    select: {
      id:           true,
      edicionId:    true,
      nombre:       true,
      tipo:         true,
      investigador: true,
      descripcion:  true,
      createdAt:    true,
      // Las fechas viajan con la clase: la tarjeta muestra el día en que se
      // imparte, que es lo que la persona reconoce.
      sesiones: {
        orderBy: { fecha: "asc" as const },
        select:  { fecha: true },
      },
      _count: {
        select: {
          sesiones: true,
        },
      },
    },
  });
}

// ── Clases con sus sesiones (hub de asistencia) ───────────────────────────────

export async function listarClasesConSesiones(edicionId: string) {
  return prisma.clase.findMany({
    where: { edicionId },
    orderBy: { nombre: "asc" },
    select: {
      id: true,
      nombre: true,
      tipo: true,
      investigador: true,
      sesiones: {
        orderBy: { fecha: "asc" },
        select: {
          id: true,
          fecha: true,
          temas: true,
          _count: { select: { asistencias: true } },
        },
      },
    },
  });
}

// ── Obtener una clase por ID ──────────────────────────────────────────────────

export async function obtenerClasePorId(id: string) {
  return prisma.clase.findUnique({
    where: { id },
    select: {
      id:           true,
      edicionId:    true,
      nombre:       true,
      tipo:         true,
      investigador: true,
      descripcion:  true,
      // Los dos recuadros del informe en Word. Viajan con la clase porque la
      // página de la sesión es donde se capturan.
      objetivo:     true,
      comentarios:  true,
      createdAt:    true,
      _count: {
        select: {
          sesiones: true,
        },
      },
    },
  });
}

// ── Crear una clase con su sesión ─────────────────────────────────────────────

/**
 * Crea la clase y la sesión en la que se imparte, en una sola transacción.
 *
 * En el programa una clase ES una charla en una fecha: las 12 clases reales
 * tienen exactamente una sesión, y sus nombres son títulos de charla. Antes la
 * clase nacía con cero sesiones y era inservible —no se le podía pasar lista—
 * hasta que alguien le "agregaba" una desde el detalle. La transacción es lo
 * que impide que vuelva a existir ese estado intermedio: si la sesión falla, la
 * clase tampoco se guarda.
 */
export async function crearClaseConSesion(
  // `tipo` se marca opcional aquí aunque `crearClaseSchema` siempre lo rellene:
  // así quien llama a esta función sin pasar por la API —las pruebas contra la
  // base, un script de carga— no tiene que repetir el valor por defecto. El
  // defecto sigue siendo uno solo, `TIPO_SESION_POR_DEFECTO`, el mismo que usa
  // el schema y el mismo que tiene la columna.
  data: Omit<CrearClaseInput, "tipo"> & { tipo?: TipoSesion },
  registradaPorId?: string,
) {
  return prisma.$transaction(async (tx) => {
    const clase = await tx.clase.create({
      data: {
        edicionId:    data.edicionId,
        nombre:       data.nombre,
        tipo:         data.tipo ?? TIPO_SESION_POR_DEFECTO,
        // `null` es legítimo: un evento especial no lo imparte nadie.
        investigador: data.investigador ?? null,
        descripcion:  data.descripcion ?? null,
      },
    });

    const sesion = await tx.sesion.create({
      data: {
        claseId:         clase.id,
        // El schema ya normalizó la fecha a medianoche UTC del día de calendario.
        fecha:           data.fecha,
        temas:           data.temas ?? null,
        registradaPorId: registradaPorId ?? null,
      },
    });

    return { ...clase, sesionId: sesion.id };
  });
}

// ── Editar una clase existente ────────────────────────────────────────────────

/**
 * Edita los datos de la clase y, si viene `fecha`, la de su sesión.
 *
 * La fecha se corrige desde aquí porque el detalle de la clase ya no ofrece
 * "Agregar Sesión": sin esto, un dedazo en la fecha quedaría permanente.
 *
 * Los tres casos posibles de una clase:
 *   • Una sesión (lo normal): se le cambia la fecha.
 *   • Ninguna (clases del flujo viejo): se le crea, y así queda utilizable.
 *   • Varias: no hay forma de saber cuál cambiar, así que se rechaza y cada una
 *     se edita desde su tarjeta en el detalle de la clase.
 */
export async function editarClase(
  id: string,
  data: EditarClaseInput,
  registradaPorId?: string,
) {
  const campos = {
    ...(data.nombre       !== undefined && { nombre:       data.nombre }),
    ...(data.tipo         !== undefined && { tipo:         data.tipo }),
    ...(data.investigador !== undefined && { investigador: data.investigador }),
    ...(data.descripcion  !== undefined && { descripcion:  data.descripcion }),
    // Los dos recuadros que el informe en Word imprime y antes no existían.
    // `null` los vacía; ausentes, no se tocan.
    ...(data.objetivo     !== undefined && { objetivo:     data.objetivo }),
    ...(data.comentarios  !== undefined && { comentarios:  data.comentarios }),
  };

  if (data.fecha === undefined) {
    return prisma.clase.update({ where: { id }, data: campos });
  }

  const fecha = data.fecha;

  return prisma.$transaction(async (tx) => {
    const clase = await tx.clase.update({ where: { id }, data: campos });

    const sesiones = await tx.sesion.findMany({
      where:   { claseId: id },
      orderBy: { fecha: "asc" },
      select:  { id: true },
    });

    if (sesiones.length > 1) {
      throw new VariasSesionesError(
        `Esta sesión tiene ${sesiones.length} fechas: cambia la fecha de cada una ` +
        `desde su tarjeta en la página de la sesión.`,
      );
    }

    if (sesiones.length === 0) {
      await tx.sesion.create({
        data: { claseId: id, fecha, registradaPorId: registradaPorId ?? null },
      });
    } else {
      await tx.sesion.update({ where: { id: sesiones[0].id }, data: { fecha } });
    }

    return clase;
  });
}

// ── Eliminar una sesión (el modelo `Clase`) ───────────────────────────────────

/** Lo que arrastra consigo el borrado de una sesión, para poder avisarlo. */
export type ConteosDeBorrado = {
  /** Fechas (`Sesion`) de esta sesión. Se van con ella, siempre. */
  fechas: number;
  /** Asistencias individuales registradas en esas fechas. */
  asistencias: number;
  /** Cuántos niños distintos figuran en esas asistencias. */
  participantes: number;
  /** Resúmenes agregados importados del Excel del organizador. */
  resumenes: number;
  /** Imágenes de la sesión. Caen en cascada desde `Clase`. */
  imagenes: number;
};

/**
 * Borra la sesión y todo lo que no se sostiene sin ella.
 *
 * QUÉ SE VA SIEMPRE, sin preguntar:
 *   · La fecha (`Sesion`). Una fecha no significa nada sin la sesión que se
 *     imparte ese día: dejarla sería un huérfano, no un dato.
 *   · Las imágenes (`ImagenClase`) y las asignaciones de staff (`StaffClase`),
 *     que ya caen en cascada desde `Clase` por la llave foránea. La FICHA de
 *     la persona de staff no se toca: vuelve año tras año y está en más
 *     sesiones.
 *
 * QUÉ SE PARA Y PREGUNTA:
 *   · Las asistencias individuales. Son el respaldo de las constancias de los
 *     niños y la llave foránea NO las borra en cascada a propósito (ver
 *     prisma/schema.prisma). Se borran solo con `forzar`, y dentro de la misma
 *     transacción, igual que en DELETE /api/inscripciones/[id].
 *   · El resumen agregado (`ResumenSesion`). Técnicamente ya cae en cascada
 *     desde `Sesion`, así que no quedaría huérfano; pero son los números que
 *     el Excel del organizador trajo y que alimentan las estadísticas de la
 *     edición, y perderlos sin decir nada cambiaría el tablero sin que nadie
 *     entienda por qué. Avisar es barato; recuperarlo es volver a importar.
 *
 * POR QUÉ YA NO HAY GUARDIA DE "FECHAS PROGRAMADAS": lo hubo mientras una
 * `Clase` podía existir sin ninguna `Sesion`. Desde que crearla crea también su
 * fecha en la misma transacción, toda clase tiene al menos una, de modo que ese
 * guardia saltaba siempre y ninguna sesión se podía borrar jamás — ni una
 * recién creada por error y vacía. Eso es lo que reportó QA.
 *
 * Todo ocurre dentro de una transacción interactiva: los conteos se hacen
 * dentro, así que nadie puede pasar lista entre la comprobación y el borrado.
 */
export async function eliminarClase(
  id: string,
  opciones: { forzar?: boolean } = {},
) {
  return prisma.$transaction(async (tx) => {
    const clase = await tx.clase.findUnique({
      where:  { id },
      select: { id: true, nombre: true },
    });

    if (!clase) {
      throw new ClaseNoEncontradaError(
        "Esta sesión ya no existe: alguien pudo eliminarla. Vuelve a la lista de " +
          "sesiones para ver las que siguen activas.",
      );
    }

    const conteos = await contarArrastreDeClase(tx, id);
    const { asistencias, resumenes } = conteos;

    if (!opciones.forzar && (asistencias > 0 || resumenes > 0)) {
      throw new ClaseConAsistenciasError(
        mensajeBorradoConHistorial(clase.nombre, conteos),
        conteos,
      );
    }

    if (asistencias > 0) {
      // Cascada explícita en la aplicación, no en la llave foránea: borrar el
      // respaldo de una constancia tiene que ser un acto deliberado.
      await tx.asistencia.deleteMany({ where: { sesion: { claseId: id } } });
    }

    // Las fechas se van con la sesión. `ResumenSesion` cae en cascada detrás de
    // cada `Sesion`; `ImagenClase` y `StaffClase`, detrás de la `Clase`.
    await tx.sesion.deleteMany({ where: { claseId: id } });

    return tx.clase.delete({ where: { id } });
  });
}

/**
 * Qué arrastraría consigo borrar esta sesión.
 *
 * Es la MISMA cuenta que hace `eliminarClase`, a propósito: la pantalla de
 * confirmación enseña estos números antes de pulsar y el servidor decide con
 * ellos al pulsar. Si fueran dos cuentas distintas, acabarían discrepando.
 * Dentro del borrado se llama con el cliente de la transacción; desde la
 * pantalla, con el cliente normal.
 */
async function contarArrastreDeClase(
  db: Prisma.TransactionClient,
  id: string,
): Promise<ConteosDeBorrado> {
  const [fechas, asistencias, inscripciones, resumenes, imagenes] =
    await Promise.all([
      db.sesion.count({ where: { claseId: id } }),
      db.asistencia.count({ where: { sesion: { claseId: id } } }),
      // Cuántos NIÑOS distintos, no cuántas marcas: "12 asistencias" no dice
      // a cuánta gente afecta, y es lo primero que pregunta el coordinador.
      db.asistencia.findMany({
        where:    { sesion: { claseId: id } },
        distinct: ["inscripcionId"],
        select:   { inscripcionId: true },
      }),
      db.resumenSesion.count({ where: { sesion: { claseId: id } } }),
      db.imagenClase.count({ where: { claseId: id } }),
    ]);

  return {
    fechas,
    asistencias,
    participantes: inscripciones.length,
    resumenes,
    imagenes,
  };
}

/** Lo mismo, para la pantalla de confirmación: cuenta y no borra nada. */
export async function contarBorradoDeClase(id: string): Promise<ConteosDeBorrado> {
  return contarArrastreDeClase(prisma, id);
}

/**
 * El aviso que ve el coordinador cuando el borrado se llevaría historial.
 *
 * Tiene que decir tres cosas, porque el mensaje viejo —"tiene 1 fecha
 * programada"— no decía ninguna: QUÉ sesión es, QUÉ se perdería (con números
 * que signifiquen algo: niños, no filas) y QUÉ hacer ahora.
 */
function mensajeBorradoConHistorial(
  nombre: string,
  { asistencias, participantes, resumenes }: ConteosDeBorrado,
): string {
  const partes: string[] = [];

  if (asistencias > 0) {
    const ninos = participantes === 1 ? "1 niño" : `${participantes} niños`;
    partes.push(
      `${asistencias} ${asistencias === 1 ? "asistencia registrada" : "asistencias registradas"} ` +
        `de ${ninos}, que es el respaldo de sus constancias`,
    );
  }

  if (resumenes > 0) {
    partes.push(
      `${
        resumenes === 1
          ? "el resumen de asistencia importado"
          : `${resumenes} resúmenes de asistencia importados`
      } del Excel del organizador, que alimenta las estadísticas de la edición`,
    );
  }

  const queSePierde = partes.join(", y ");

  const comoSigue =
    asistencias > 0
      ? "Si la sesión se creó por error, confirma el borrado y se eliminará junto con ese historial. " +
        "Si lo que sobra son unos cuantos niños, cancela y desmárcalos primero en la lista de asistencia."
      : "Confirma el borrado para eliminarla junto con esos totales; para recuperarlos habría que volver " +
        "a importar el Excel de la edición.";

  return `No se puede eliminar «${nombre}» sin confirmarlo: tiene ${queSePierde}. ${comoSigue}`;
}

// ── Listar sesiones de una clase ──────────────────────────────────────────────

export async function listarSesionesDeClase(claseId: string) {
  return prisma.sesion.findMany({
    where:   { claseId },
    orderBy: { fecha: "asc" },
    select: {
      id:              true,
      claseId:         true,
      fecha:           true,
      temas:           true,
      notas:           true,
      registradaPorId: true,
      createdAt:       true,
      _count: {
        select: {
          asistencias: true,
        },
      },
    },
  });
}

// ── Obtener una sesión por ID ─────────────────────────────────────────────────

export async function obtenerSesionPorId(id: string) {
  return prisma.sesion.findUnique({
    where: { id },
    select: {
      id:              true,
      claseId:         true,
      fecha:           true,
      temas:           true,
      notas:           true,
      registradaPorId: true,
      createdAt:       true,
      _count: {
        select: {
          asistencias: true,
        },
      },
    },
  });
}

// ── Obtener sesión con clase y edición (para la vista de asistencia) ──────────

export type SesionConClase = NonNullable<Awaited<ReturnType<typeof obtenerSesionConClase>>>;

export async function obtenerSesionConClase(id: string) {
  return prisma.sesion.findUnique({
    where: { id },
    select: {
      id:    true,
      fecha: true,
      temas: true,
      notas: true,
      clase: {
        select: {
          id:           true,
          nombre:       true,
          tipo:         true,
          investigador: true,
          edicionId:    true,
          edicion: {
            select: {
              id:     true,
              nombre: true,
              anio:   true,
              activa: true,
            },
          },
        },
      },
    },
  });
}

// ── Crear una sesión ──────────────────────────────────────────────────────────

export async function crearSesion(data: CrearSesionInput, registradaPorId?: string) {
  return prisma.sesion.create({
    data: {
      claseId:         data.claseId,
      // El schema ya normalizó la fecha a medianoche UTC del día de calendario.
      fecha:           data.fecha,
      temas:           data.temas  ?? null,
      notas:           data.notas  ?? null,
      registradaPorId: registradaPorId ?? null,
    },
  });
}

// ── Actualizar fecha, temas y notas de una sesión ─────────────────────────────

export async function actualizarSesion(id: string, data: ActualizarSesionInput) {
  return prisma.sesion.update({
    where: { id },
    data: {
      ...(data.fecha !== undefined && { fecha: data.fecha }),
      ...(data.temas !== undefined && { temas: data.temas }),
      ...(data.notas !== undefined && { notas: data.notas }),
    },
  });
}

// ── Rango de fechas de la edición a la que pertenece una clase / sesión ───────

/** Datos mínimos de la edición para validar que una sesión caiga dentro de ella. */
export type RangoEdicion = {
  edicionId:   string;
  nombre:      string;
  anio:        number;
  fechaInicio: Date;
  fechaFin:    Date;
};

/**
 * Rango de una edición por su id. Hace falta al crear una clase: la clase aún
 * no existe, así que no se puede llegar a la edición a través de ella.
 */
export async function obtenerRangoEdicion(
  edicionId: string,
): Promise<RangoEdicion | null> {
  const edicion = await prisma.edicion.findUnique({
    where:  { id: edicionId },
    select: { id: true, nombre: true, anio: true, fechaInicio: true, fechaFin: true },
  });

  if (!edicion) return null;

  const { id, ...resto } = edicion;
  return { edicionId: id, ...resto };
}

export async function obtenerRangoEdicionDeClase(
  claseId: string,
): Promise<RangoEdicion | null> {
  const clase = await prisma.clase.findUnique({
    where:  { id: claseId },
    select: {
      edicion: {
        select: { id: true, nombre: true, anio: true, fechaInicio: true, fechaFin: true },
      },
    },
  });

  if (!clase) return null;

  const { id, ...resto } = clase.edicion;
  return { edicionId: id, ...resto };
}

export async function obtenerRangoEdicionDeSesion(
  sesionId: string,
): Promise<RangoEdicion | null> {
  const sesion = await prisma.sesion.findUnique({
    where:  { id: sesionId },
    select: {
      clase: {
        select: {
          edicion: {
            select: { id: true, nombre: true, anio: true, fechaInicio: true, fechaFin: true },
          },
        },
      },
    },
  });

  if (!sesion) return null;

  const { id, ...resto } = sesion.clase.edicion;
  return { edicionId: id, ...resto };
}

// ── Eliminar una sesión (solo si no tiene asistencias) ────────────────────────

export async function eliminarSesion(id: string) {
  const conteo = await prisma.asistencia.count({
    where: { sesionId: id },
  });

  if (conteo > 0) {
    throw new SesionConAsistenciasError(
      `No se puede eliminar la sesión porque tiene ${conteo} asistencia(s) registrada(s). ` +
        "Si la sesión se capturó por error, desmarca primero a esos participantes en la lista de asistencia.",
    );
  }

  return prisma.sesion.delete({ where: { id } });
}

// ── Errores personalizados ────────────────────────────────────────────────────

/**
 * Borrar la sesión se llevaría historial de asistencia por delante.
 *
 * `conteos` viaja con el error hasta la pantalla: el diálogo de confirmación
 * necesita los mismos números que el mensaje para que el ADMIN sepa a qué
 * está diciendo que sí.
 */
export class ClaseConAsistenciasError extends Error {
  readonly conteos: ConteosDeBorrado;

  constructor(message: string, conteos: ConteosDeBorrado) {
    super(message);
    this.name = "ClaseConAsistenciasError";
    this.conteos = conteos;
  }
}

/** Se pidió borrar una sesión que ya no está (pestaña vieja, doble clic). */
export class ClaseNoEncontradaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClaseNoEncontradaError";
  }
}

export class SesionConAsistenciasError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SesionConAsistenciasError";
  }
}

/** La clase tiene más de una sesión: no se puede adivinar a cuál cambiarle la fecha. */
export class VariasSesionesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VariasSesionesError";
  }
}
