import { prisma } from "@/server/db";
import type {
  ParticipanteInput,
  EditarParticipanteInput,
} from "@/lib/schemas/participante.schema";

// ── Errores de dominio ────────────────────────────────────────────────────────
// Se lanzan desde las queries y las rutas los traducen a un código HTTP con un
// mensaje que dice exactamente qué impide la operación (mismo criterio que
// eliminarClase en queries/clases.ts).

export class ParticipanteNoEncontradoError extends Error {
  constructor(message = "Participante no encontrado") {
    super(message);
    this.name = "ParticipanteNoEncontradoError";
  }
}

export type ConteosParticipante = {
  inscripciones: number;
  asistencias:   number;
  constancias:   number;
};

export class ParticipanteConDependenciasError extends Error {
  constructor(
    message: string,
    public readonly conteos: ConteosParticipante,
  ) {
    super(message);
    this.name = "ParticipanteConDependenciasError";
  }
}

export type ConteosInscripcion = {
  asistencias: number;
  presentes:   number;
};

export class InscripcionConAsistenciasError extends Error {
  constructor(
    message: string,
    public readonly conteos: ConteosInscripcion,
  ) {
    super(message);
    this.name = "InscripcionConAsistenciasError";
  }
}

export class InscripcionConConstanciaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InscripcionConConstanciaError";
  }
}

// ── Tipos de retorno ──────────────────────────────────────────────────────────

export type ParticipanteConInscripciones = Awaited<
  ReturnType<typeof buscarParticipantes>
>[number];

export type ParticipanteHistorial = Awaited<
  ReturnType<typeof obtenerHistorialParticipante>
>;

// ── Buscar participantes (búsqueda por nombre / apellidos) ────────────────────
// `edicionId` acota el resultado a los INSCRITOS en esa edición: es el listado
// de "Participantes · <edición>". Sin `edicionId` la búsqueda es global (todas
// las ediciones), que es lo que necesita el buscador de reinscripción para
// encontrar a un niño que ya participó en años anteriores.
// Límite: el listado de una edición no se trunca a 50 (una edición puede tener
// más niños); la búsqueda global sí, porque alimenta un typeahead.

const LIMITE_BUSQUEDA_GLOBAL = 50;
const LIMITE_LISTADO_EDICION = 500;

export async function buscarParticipantes(q?: string, edicionId?: string) {
  const where = {
    ...(q?.trim()
      ? {
          OR: [
            { nombre:    { contains: q.trim(), mode: "insensitive" as const } },
            { apellidos: { contains: q.trim(), mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(edicionId ? { inscripciones: { some: { edicionId } } } : {}),
  };

  return prisma.participante.findMany({
    where,
    orderBy: [{ apellidos: "asc" }, { nombre: "asc" }],
    take: edicionId ? LIMITE_LISTADO_EDICION : LIMITE_BUSQUEDA_GLOBAL,
    // select explícito: NO exponer correo/teléfono (contacto de padres) ni otros
    // campos sensibles al cliente. Solo lo que la UI de búsqueda/listado usa.
    select: {
      id: true,
      nombre: true,
      apellidos: true,
      edad: true,
      escuela: true,
      grado: true,
      createdAt: true,
      inscripciones: {
        select: {
          id: true,
          constanciaGenerada: true,
          edicion: { select: { id: true, anio: true, nombre: true, activa: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

// ── Crear participante ────────────────────────────────────────────────────────

export async function crearParticipante(data: ParticipanteInput) {
  return prisma.participante.create({
    data: {
      nombre:    data.nombre,
      apellidos: data.apellidos,
      edad:      data.edad,
      escuela:   data.escuela,
      grado:     data.grado,
      genero:    data.genero ?? null,
    },
  });
}

// ── Editar participante ───────────────────────────────────────────────────────
// Corrige los datos del niño (una captura mal hecha se imprime tal cual en la
// constancia). Solo cambia lo que viene en `data`: los campos ausentes quedan
// como estaban, porque Prisma ignora las claves con valor undefined.

export async function editarParticipante(
  id: string,
  data: EditarParticipanteInput,
) {
  const existente = await prisma.participante.findUnique({
    where:  { id },
    select: { id: true },
  });

  if (!existente) {
    throw new ParticipanteNoEncontradoError();
  }

  return prisma.participante.update({
    where: { id },
    data,
  });
}

// ── Eliminar participante ─────────────────────────────────────────────────────
// Borrado real, pero SOLO si no arrastra historial. Un niño con inscripciones o
// asistencias es la evidencia que respalda una constancia oficial: no se borra
// desde un botón. Para sacarlo de una edición concreta está la desinscripción.

export async function eliminarParticipante(id: string) {
  const existente = await prisma.participante.findUnique({
    where:  { id },
    select: { id: true },
  });

  if (!existente) {
    throw new ParticipanteNoEncontradoError();
  }

  const [inscripciones, constancias, asistencias] = await Promise.all([
    prisma.inscripcion.count({ where: { participanteId: id } }),
    prisma.inscripcion.count({
      where: { participanteId: id, constanciaGenerada: true },
    }),
    prisma.asistencia.count({
      where: { inscripcion: { participanteId: id } },
    }),
  ]);

  if (inscripciones > 0 || asistencias > 0) {
    throw new ParticipanteConDependenciasError(
      `No se puede eliminar al participante porque conserva historial: ` +
        `${inscripciones} inscripción(es), ${asistencias} asistencia(s) registrada(s) ` +
        `y ${constancias} constancia(s) generada(s). ` +
        `Da de baja sus inscripciones antes de eliminarlo.`,
      { inscripciones, asistencias, constancias },
    );
  }

  return prisma.participante.delete({ where: { id } });
}

// ── Historial completo de un participante ─────────────────────────────────────

export async function obtenerHistorialParticipante(id: string) {
  return prisma.participante.findUnique({
    where: { id },
    include: {
      inscripciones: {
        include: {
          edicion: {
            select: {
              id:               true,
              anio:             true,
              nombre:           true,
              activa:           true,
              fechaInicio:      true,
              fechaFin:         true,
              minAsistencias:   true,
              porcentajeMinimo: true,
            },
          },
          asistencias: {
            where: { presente: true },
            include: {
              sesion: {
                select: {
                  id:     true,
                  fecha:  true,
                  temas:  true,
                  clase: {
                    select: { id: true, nombre: true },
                  },
                },
              },
            },
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

// ── Inscribir participante a una edición ──────────────────────────────────────

export async function inscribirParticipante(
  participanteId: string,
  edicionId: string,
) {
  // Verificar que la edición existe y está activa
  const edicion = await prisma.edicion.findUnique({
    where: { id: edicionId },
    select: { id: true, activa: true, nombre: true },
  });

  if (!edicion) {
    throw new Error("EDICION_NO_ENCONTRADA");
  }

  if (!edicion.activa) {
    throw new Error("EDICION_NO_ACTIVA");
  }

  // Verificar que el participante existe
  const participante = await prisma.participante.findUnique({
    where: { id: participanteId },
    select: { id: true },
  });

  if (!participante) {
    throw new Error("PARTICIPANTE_NO_ENCONTRADO");
  }

  // Crear inscripción (falla con P2002 si ya existe el unique[participanteId, edicionId])
  return prisma.inscripcion.create({
    data: { participanteId, edicionId },
    include: {
      participante: {
        select: { id: true, nombre: true, apellidos: true },
      },
      edicion: {
        select: { id: true, anio: true, nombre: true },
      },
    },
  });
}

// ── Desinscribir participante ─────────────────────────────────────────────────

// Borra la inscripción de un niño en una edición. Las asistencias NO caen solas:
// la relación Asistencia → Inscripcion no declara onDelete: Cascade a propósito
// (ver prisma/schema.prisma), porque esas filas son el respaldo de la constancia
// de ese niño en esa edición. Si hay historial, la operación se rechaza con el
// conteo exacto; borrarlo requiere pedirlo explícitamente con `forzar`, y aun
// así se hace en una transacción para no dejar asistencias huérfanas.

export async function desinscribirParticipante(
  inscripcionId: string,
  opciones: { forzar?: boolean } = {},
) {
  // Verificar que la inscripción existe antes de borrar
  const inscripcion = await prisma.inscripcion.findUnique({
    where: { id: inscripcionId },
    select: { id: true, constanciaGenerada: true },
  });

  if (!inscripcion) {
    throw new Error("INSCRIPCION_NO_ENCONTRADA");
  }

  const [asistencias, presentes] = await Promise.all([
    prisma.asistencia.count({ where: { inscripcionId } }),
    prisma.asistencia.count({ where: { inscripcionId, presente: true } }),
  ]);

  // Una constancia ya emitida es un documento oficial entregado: su respaldo no
  // se borra ni pidiéndolo explícitamente.
  if (inscripcion.constanciaGenerada) {
    throw new InscripcionConConstanciaError(
      "No se puede dar de baja esta inscripción porque ya tiene una constancia generada. " +
        "La constancia entregada quedaría sin respaldo de asistencias.",
    );
  }

  if (asistencias > 0 && !opciones.forzar) {
    throw new InscripcionConAsistenciasError(
      `No se puede dar de baja esta inscripción porque tiene ${asistencias} ` +
        `registro(s) de asistencia (${presentes} con asistencia confirmada). ` +
        `Dar de baja borra ese historial de la edición: confírmalo para continuar.`,
      { asistencias, presentes },
    );
  }

  if (asistencias === 0) {
    return prisma.inscripcion.delete({ where: { id: inscripcionId } });
  }

  // Cascada explícita en la aplicación, no en la llave foránea.
  return prisma.$transaction([
    prisma.asistencia.deleteMany({ where: { inscripcionId } }),
    prisma.inscripcion.delete({ where: { id: inscripcionId } }),
  ]);
}
