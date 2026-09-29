import { prisma } from "@/server/db";
import type { RolStaff } from "@/lib/schemas/staff.schema";
import type { TipoSesion } from "@/lib/tipos-sesion";

// ─────────────────────────────────────────────────────────────────────────────
// LA LISTA DE UNA SESIÓN: los niños que asistieron y el staff asignado.
//
// Esto es lo que el cliente pidió «anexar» a la sesión. Es también lo que va
// dentro del formato Word exportable que pidió en la misma reunión: quien
// genere ese Word NO tiene que volver a consultar la base ni recomponer nada,
// solo llamar a `obtenerListaDeSesion(claseId)` y maquetar lo que devuelve.
//
//   ┌─ CONTRATO PARA QUIEN GENERE EL WORD ─────────────────────────────────┐
//   │                                                                      │
//   │  import { obtenerListaDeSesion } from "@/server/queries/listas-sesion"│
//   │                                                                      │
//   │  const lista = await obtenerListaDeSesion(claseId, {                 │
//   │    incluirContactoStaff: esAdminOBecario,   // opcional, por omisión  │
//   │  });                                        // false                 │
//   │                                                                      │
//   │  · Devuelve `null` si esa sesión no existe → responder 404.          │
//   │  · `lista.sesion`  — nombre, descripción, tipo (PASAPORTE/LECTURA/   │
//   │                      EVENTO), investigador y edición. OJO:           │
//   │                      `investigador` puede ser `null` — un evento     │
//   │                      especial no lo imparte nadie.                   │
//   │  · `lista.fechas`  — las fechas en que se impartió (modelo `Sesion`).│
//   │  · `lista.ninos`   — SOLO los que asistieron (`presente = true`) a   │
//   │                      alguna fecha, ordenados por apellidos y sin     │
//   │                      repetirse aunque hayan venido a varias.         │
//   │  · `lista.staff`   — quien la impartió u organizó, en el orden en    │
//   │                      que se asignó.                                  │
//   │  · `lista.totales` — { ninos, staff, fechas }, ya contados.          │
//   │                                                                      │
//   │  El teléfono y el correo del staff llegan en `null` salvo que se     │
//   │  pida `incluirContactoStaff: true`. Es deliberado: un anexo que      │
//   │  circula por correo no debería llevar teléfonos por omisión, y       │
//   │  READONLY no los ve nunca (mismo criterio que                        │
//   │  GET /api/acompanantes/[id]). Quien llame decide, y tiene que        │
//   │  decidirlo a propósito.                                              │
//   │                                                                      │
//   │  Los niños NO traen contacto: el anexo lista a quién asistió, no     │
//   │  cómo localizar a un menor.                                          │
//   └──────────────────────────────────────────────────────────────────────┘
//
// Recordatorio de vocabulario: `claseId` es el id de lo que la interfaz llama
// «sesión»; las `fechas` son el modelo `Sesion`. Ver el comentario sobre
// `model Clase` en prisma/schema.prisma.
// ─────────────────────────────────────────────────────────────────────────────

// ── Lo que devuelve ───────────────────────────────────────────────────────────

export type NinoEnLista = {
  inscripcionId:  string;
  participanteId: string;
  nombre:         string;
  apellidos:      string;
  edad:           number;
  escuela:        string;
  grado:          string;
  genero:         "FEMENINO" | "MASCULINO" | null;
  nivel:          string | null;
  /** Fechas de ESTA sesión a las que vino, en orden. Casi siempre una. */
  fechasAsistidas: Date[];
};

export type StaffEnLista = {
  id:          string;
  nombre:      string;
  apellidos:   string | null;
  rol:         RolStaff;
  institucion: string | null;
  /** `null` salvo que se pida `incluirContactoStaff`. */
  telefono:    string | null;
  /** `null` salvo que se pida `incluirContactoStaff`. */
  correo:      string | null;
};

export type FechaEnLista = {
  id:    string;
  fecha: Date;
  temas: string | null;
};

export type ListaDeSesion = {
  sesion: {
    id:          string;
    nombre:      string;
    descripcion: string | null;
    /** PASAPORTE, LECTURA o EVENTO. Ver `etiquetaTipo` en lib/tipos-sesion. */
    tipo:        TipoSesion;
    /**
     * Quién la imparte. `null` en los eventos especiales (una clausura no la
     * imparte nadie), así que quien maquete el anexo debe comprobarlo antes de
     * pintar la línea.
     */
    investigador: string | null;
    edicion: { id: string; anio: number; nombre: string };
  };
  fechas:  FechaEnLista[];
  ninos:   NinoEnLista[];
  staff:   StaffEnLista[];
  totales: { ninos: number; staff: number; fechas: number };
};

export type OpcionesListaDeSesion = {
  /**
   * Incluir teléfono y correo del staff. Por omisión `false`. Quien llama lo
   * pone en `true` solo tras comprobar que el rol es ADMIN o BECARIO.
   */
  incluirContactoStaff?: boolean;
};

// ── La consulta ───────────────────────────────────────────────────────────────

export async function obtenerListaDeSesion(
  claseId: string,
  opciones: OpcionesListaDeSesion = {},
): Promise<ListaDeSesion | null> {
  const { incluirContactoStaff = false } = opciones;

  const clase = await prisma.clase.findUnique({
    where: { id: claseId },
    select: {
      id:           true,
      nombre:       true,
      descripcion:  true,
      tipo:         true,
      investigador: true,
      edicion: { select: { id: true, anio: true, nombre: true } },
      sesiones: {
        orderBy: { fecha: "asc" },
        select: {
          id:    true,
          fecha: true,
          temas: true,
          // Solo las presencias confirmadas: la lista dice quién VINO, no
          // quién estaba inscrito. Una fila con `presente: false` es alguien a
          // quien se pasó lista y no estaba.
          asistencias: {
            where:  { presente: true },
            select: { inscripcionId: true },
          },
        },
      },
      staff: {
        orderBy: { createdAt: "asc" },
        select: {
          staff: {
            select: {
              id:          true,
              nombre:      true,
              apellidos:   true,
              telefono:    true,
              correo:      true,
              rol:         true,
              institucion: true,
            },
          },
        },
      },
    },
  });

  if (!clase) return null;

  // A qué fechas vino cada inscripción. Un niño que asistió a dos fechas de la
  // misma sesión aparece UNA vez con sus dos fechas, no dos veces: en el anexo,
  // una lista con nombres repetidos se lee como un error de captura.
  const fechasPorInscripcion = new Map<string, Date[]>();
  for (const fecha of clase.sesiones) {
    for (const { inscripcionId } of fecha.asistencias) {
      const previas = fechasPorInscripcion.get(inscripcionId);
      if (previas) previas.push(fecha.fecha);
      else fechasPorInscripcion.set(inscripcionId, [fecha.fecha]);
    }
  }

  const inscripcionIds = [...fechasPorInscripcion.keys()];

  // Se piden SOLO las inscripciones que asistieron, no las de toda la edición:
  // en 2026 fueron más de 200 niños inscritos y a una sesión concreta van
  // treinta. Traer las 200 para descartar 170 en memoria sería gratuito nada
  // más el primer año.
  const inscripciones =
    inscripcionIds.length === 0
      ? []
      : await prisma.inscripcion.findMany({
          where: { id: { in: inscripcionIds } },
          orderBy: [
            { participante: { apellidos: "asc" } },
            { participante: { nombre:    "asc" } },
          ],
          select: {
            id: true,
            participante: {
              select: {
                id:        true,
                nombre:    true,
                apellidos: true,
                edad:      true,
                escuela:   true,
                grado:     true,
                genero:    true,
                nivel:     true,
              },
            },
          },
        });

  const ninos: NinoEnLista[] = inscripciones.map(({ id, participante }) => ({
    inscripcionId:  id,
    participanteId: participante.id,
    nombre:         participante.nombre,
    apellidos:      participante.apellidos,
    edad:           participante.edad,
    escuela:        participante.escuela,
    grado:          participante.grado,
    genero:         participante.genero,
    nivel:          participante.nivel,
    fechasAsistidas: fechasPorInscripcion.get(id) ?? [],
  }));

  const staff: StaffEnLista[] = clase.staff.map(({ staff: persona }) => ({
    id:          persona.id,
    nombre:      persona.nombre,
    apellidos:   persona.apellidos,
    rol:         persona.rol,
    institucion: persona.institucion,
    telefono:    incluirContactoStaff ? persona.telefono : null,
    correo:      incluirContactoStaff ? persona.correo   : null,
  }));

  return {
    sesion: {
      id:           clase.id,
      nombre:       clase.nombre,
      descripcion:  clase.descripcion,
      tipo:         clase.tipo,
      investigador: clase.investigador,
      edicion:      clase.edicion,
    },
    fechas: clase.sesiones.map(({ id, fecha, temas }) => ({ id, fecha, temas })),
    ninos,
    staff,
    totales: {
      ninos:  ninos.length,
      staff:  staff.length,
      fechas: clase.sesiones.length,
    },
  };
}
