import { z } from "zod";

// ── Participante ──────────────────────────────────────────────────────────────

export const participanteSchema = z.object({
  nombre:    z.string().min(1, "Nombre requerido").max(100).trim(),
  apellidos: z.string().min(1, "Apellidos requeridos").max(100).trim(),
  edad:      z.number().int().min(5, "Edad mínima 5 años").max(18, "Edad máxima 18 años"),
  escuela:   z.string().min(1, "Escuela requerida").max(200).trim(),
  grado:     z.string().min(1, "Grado requerido").max(50).trim(),
});

export type ParticipanteInput = z.infer<typeof participanteSchema>;

// ── Query params para búsqueda ────────────────────────────────────────────────

export const busquedaParticipanteSchema = z.object({
  q:         z.string().max(100).optional(),
  edicionId: z.cuid().optional(),
});

export type BusquedaParticipanteInput = z.infer<typeof busquedaParticipanteSchema>;

// ── Inscripción ───────────────────────────────────────────────────────────────

export const inscripcionSchema = z.object({
  participanteId: z.cuid("ID de participante inválido"),
  edicionId:      z.cuid("ID de edición inválido"),
});

export type InscripcionInput = z.infer<typeof inscripcionSchema>;
