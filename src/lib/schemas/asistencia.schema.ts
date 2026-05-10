import { z } from "zod";

// ── Marcar asistencia individual ──────────────────────────────────────────────

export const marcarAsistenciaSchema = z.object({
  inscripcionId: z.string().cuid("inscripcionId debe ser un cuid válido"),
  sesionId:      z.string().cuid("sesionId debe ser un cuid válido"),
  presente:      z.boolean(),
});

export type MarcarAsistenciaInput = z.infer<typeof marcarAsistenciaSchema>;

// ── Batch: múltiples asistencias en una sola operación ───────────────────────

export const batchAsistenciaSchema = z
  .array(marcarAsistenciaSchema)
  .min(1,   "Debe incluir al menos 1 elemento")
  .max(200, "No se pueden procesar más de 200 asistencias a la vez");

export type BatchAsistenciaInput = z.infer<typeof batchAsistenciaSchema>;

// ── Schema del body para el endpoint POST /api/asistencias ───────────────────

export const batchAsistenciaBodySchema = z.object({
  items: batchAsistenciaSchema,
});

export type BatchAsistenciaBodyInput = z.infer<typeof batchAsistenciaBodySchema>;
