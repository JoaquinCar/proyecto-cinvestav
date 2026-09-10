import { prisma } from "@/server/db";

// ─────────────────────────────────────────────────────────────────────────────
// Congelar una edición terminada.
//
// Por qué un campo `cerrada` explícito y no otra cosa:
//
//   • No se deduce de `fechaFin`. La captura real va detrás de la última sesión
//     (resúmenes que llegan por Excel días después, listas de campo que se pasan
//     el lunes siguiente). Deducirlo de la fecha cerraría la edición justo
//     cuando todavía hace falta escribir, y peor: un dedazo al editar `fechaFin`
//     congelaría o descongelaría la edición como efecto secundario invisible.
//
//   • No sirve `activa`. `activa` marca la edición en curso y solo puede haber
//     una; al abrir 2027, la 2026 deja de ser activa pero aún tiene capturas
//     pendientes. Cerrar y desactivar son decisiones distintas y en momentos
//     distintos.
//
//   • Cerrar es reversible, pero solo por ADMIN (POST .../cerrar y .../reabrir).
//     Un becario no puede reabrir 2025 para "corregir" una lista: si de verdad
//     hace falta, lo pide al coordinador, que deja rastro en `cerradaAt`.
//
// Qué congela: escrituras del ciclo de captura — asistencias, sesiones y temas.
// Qué NO congela: lectura, estadísticas, reportes, constancias, exportación a
// Excel. Una edición cerrada se sigue consultando exactamente igual.
// ─────────────────────────────────────────────────────────────────────────────

export class EdicionCerradaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EdicionCerradaError";
  }
}

/** Lanza si la edición está cerrada (o no existe). */
export async function assertEdicionAbierta(edicionId: string): Promise<void> {
  const edicion = await prisma.edicion.findUnique({
    where: { id: edicionId },
    select: { anio: true, cerrada: true },
  });

  if (!edicion) {
    throw new EdicionCerradaError("La edición no existe");
  }

  if (edicion.cerrada) {
    throw new EdicionCerradaError(
      `La edición ${edicion.anio} está cerrada y no admite cambios. Un administrador puede reabrirla.`,
    );
  }
}

/** Igual, pero partiendo de una sesión (la edición se alcanza vía la clase). */
export async function assertEdicionDeSesionAbierta(
  sesionId: string,
): Promise<void> {
  const sesion = await prisma.sesion.findUnique({
    where: { id: sesionId },
    select: {
      clase: { select: { edicion: { select: { anio: true, cerrada: true } } } },
    },
  });

  if (!sesion) {
    throw new EdicionCerradaError("La sesión no existe");
  }

  const { edicion } = sesion.clase;
  if (edicion.cerrada) {
    throw new EdicionCerradaError(
      `La edición ${edicion.anio} está cerrada y no admite cambios. Un administrador puede reabrirla.`,
    );
  }
}

/** Igual, pero partiendo de una clase. */
export async function assertEdicionDeClaseAbierta(
  claseId: string,
): Promise<void> {
  const clase = await prisma.clase.findUnique({
    where: { id: claseId },
    select: { edicion: { select: { anio: true, cerrada: true } } },
  });

  if (!clase) {
    throw new EdicionCerradaError("La clase no existe");
  }

  if (clase.edicion.cerrada) {
    throw new EdicionCerradaError(
      `La edición ${clase.edicion.anio} está cerrada y no admite cambios. Un administrador puede reabrirla.`,
    );
  }
}
