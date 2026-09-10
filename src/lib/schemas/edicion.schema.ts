import { z } from "zod";

// ── Schema base para crear una edición ───────────────────────────────────────

export const crearEdicionSchema = z
  .object({
    anio: z
      .number({ error: "El año es requerido" })
      .int("El año debe ser un entero")
      .min(2020, "El año mínimo es 2020")
      .max(2100, "El año máximo es 2100"),

    nombre: z
      .string({ error: "El nombre es requerido" })
      .min(1, "El nombre no puede estar vacío")
      .max(200, "El nombre no puede exceder 200 caracteres")
      .trim(),

    fechaInicio: z
      .string({ error: "La fecha de inicio es requerida" })
      .datetime({ message: "fechaInicio debe ser una fecha ISO 8601 válida" }),

    fechaFin: z
      .string({ error: "La fecha de fin es requerida" })
      .datetime({ message: "fechaFin debe ser una fecha ISO 8601 válida" }),

    // Número de asistencias necesarias para recibir constancia. Debe ser al
    // menos 1 (si fuera 0 todo inscrito tendría constancia) y como mucho 60:
    // el programa nunca ha pasado de ~20 sesiones, así que un valor mayor
    // significa que alguien tecleó de más y dejaría a todos sin constancia.
    minAsistencias: z
      .number()
      .int("minAsistencias debe ser un entero")
      .min(1, "Debe requerir al menos 1 asistencia")
      .max(60, "El mínimo de asistencias no puede superar 60")
      .default(5),

    porcentajeMinimo: z
      .number()
      .min(0, "El porcentaje no puede ser negativo")
      .max(100, "El porcentaje no puede superar 100")
      .nullable()
      .default(null),

    asistenciaGlobal: z.boolean().default(true),
  })
  .refine(
    (data) => new Date(data.fechaFin) > new Date(data.fechaInicio),
    {
      message: "fechaFin debe ser posterior a fechaInicio",
      path: ["fechaFin"],
    }
  );

// ── Schema para editar (todos los campos opcionales excepto coherencia) ───────

export const editarEdicionSchema = z
  .object({
    anio: z
      .number()
      .int("El año debe ser un entero")
      .min(2020, "El año mínimo es 2020")
      .max(2100, "El año máximo es 2100")
      .optional(),

    nombre: z
      .string()
      .min(1, "El nombre no puede estar vacío")
      .max(200, "El nombre no puede exceder 200 caracteres")
      .trim()
      .optional(),

    fechaInicio: z
      .string()
      .datetime({ message: "fechaInicio debe ser una fecha ISO 8601 válida" })
      .optional(),

    fechaFin: z
      .string()
      .datetime({ message: "fechaFin debe ser una fecha ISO 8601 válida" })
      .optional(),

    minAsistencias: z
      .number()
      .int("minAsistencias debe ser un entero")
      .min(1, "Debe requerir al menos 1 asistencia")
      .max(60, "El mínimo de asistencias no puede superar 60")
      .optional(),

    porcentajeMinimo: z
      .number()
      .min(0, "El porcentaje no puede ser negativo")
      .max(100, "El porcentaje no puede superar 100")
      .nullable()
      .optional(),

    asistenciaGlobal: z.boolean().optional(),
  })
  .refine(
    (data) => {
      if (data.fechaInicio && data.fechaFin) {
        return new Date(data.fechaFin) > new Date(data.fechaInicio);
      }
      return true;
    },
    {
      message: "fechaFin debe ser posterior a fechaInicio",
      path: ["fechaFin"],
    }
  );

// ── Edición parcial coherente con lo ya guardado ─────────────────────────────
//
// `editarEdicionSchema` solo puede comparar las dos fechas cuando ambas vienen
// en el mismo payload. Enviando SOLO `fechaFin` no había nada que comparar y se
// aceptaba un fin meses anterior al inicio (devolvía 200).
//
// La coherencia de fechas no es una propiedad del payload sino del resultado:
// hay que contrastar lo que llega contra lo que ya está en la base. Por eso el
// esquema se construye con los valores actuales de la edición y compara la
// combinación final.
//
// Uso en la API:
//   const existente = await obtenerEdicionPorId(id);
//   const parsed = editarEdicionConActualSchema(existente).safeParse(body);

export function editarEdicionConActualSchema(actual: {
  fechaInicio: Date | string;
  fechaFin: Date | string;
}) {
  return editarEdicionSchema.refine(
    (data) => {
      const inicio = new Date(data.fechaInicio ?? actual.fechaInicio);
      const fin = new Date(data.fechaFin ?? actual.fechaFin);
      return fin > inicio;
    },
    {
      message:
        "fechaFin debe ser posterior a fechaInicio (comparado con las fechas ya guardadas)",
      path: ["fechaFin"],
    }
  );
}

// ── Tipos inferidos ───────────────────────────────────────────────────────────

export type CrearEdicionInput = z.infer<typeof crearEdicionSchema>;
export type EditarEdicionInput = z.infer<typeof editarEdicionSchema>;
