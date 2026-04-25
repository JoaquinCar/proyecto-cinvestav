import { z } from "zod";

export const participanteSchema = z.object({
  nombre:    z.string().min(1, "Nombre requerido").max(100),
  apellidos: z.string().min(1, "Apellidos requeridos").max(100),
  edad:      z.number().int().min(5).max(15),
  escuela:   z.string().min(1, "Escuela requerida").max(200),
  grado:     z.enum(["1°", "2°", "3°", "4°", "5°", "6°"]),
});

export type ParticipanteInput = z.infer<typeof participanteSchema>;
