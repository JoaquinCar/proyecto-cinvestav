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

    minAsistencias: z
      .number()
      .int("minAsistencias debe ser un entero")
      .min(1, "Debe requerir al menos 1 asistencia")
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

// ── Tipos inferidos ───────────────────────────────────────────────────────────

export type CrearEdicionInput = z.infer<typeof crearEdicionSchema>;
export type EditarEdicionInput = z.infer<typeof editarEdicionSchema>;
