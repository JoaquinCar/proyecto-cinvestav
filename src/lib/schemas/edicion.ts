import { z } from "zod";

export const edicionSchema = z.object({
  anio:             z.number().int().min(2020).max(2100),
  nombre:           z.string().min(1).max(200),
  fechaInicio:      z.string().datetime(),
  fechaFin:         z.string().datetime(),
  minAsistencias:   z.number().int().min(1).default(5),
  porcentajeMinimo: z.number().min(0).max(100).nullable().default(null),
  asistenciaGlobal: z.boolean().default(true),
});

export type EdicionInput = z.infer<typeof edicionSchema>;
