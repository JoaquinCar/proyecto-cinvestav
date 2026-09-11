import { z } from "zod";

// ── Participante ──────────────────────────────────────────────────────────────

// El .trim() va ANTES del .min(1): al revés, una cadena de solo espacios pasa
// el mínimo y se recorta después, guardando un nombre vacío en la base — y ese
// nombre es el que se imprime en la constancia del niño.

export const participanteSchema = z.object({
  nombre:    z.string().trim().min(1, "Nombre requerido").max(100),
  apellidos: z.string().trim().min(1, "Apellidos requeridos").max(100),
  edad:      z.number().int().min(5, "Edad mínima 5 años").max(18, "Edad máxima 18 años"),
  escuela:   z.string().trim().min(1, "Escuela requerida").max(200),
  grado:     z.string().trim().min(1, "Grado requerido").max(50),
  genero:    z.enum(["FEMENINO", "MASCULINO"]).optional(),
});

export type ParticipanteInput = z.infer<typeof participanteSchema>;

// ── Edición de participante ───────────────────────────────────────────────────
// Parcial sobre el schema de alta: el formulario puede mandar solo los campos
// que cambiaron (corregir una falta de ortografía en el nombre, por ejemplo).
// Se exige al menos un campo para que un PUT vacío no cuente como éxito.

export const editarParticipanteSchema = participanteSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Envía al menos un campo para actualizar",
  });

export type EditarParticipanteInput = z.infer<typeof editarParticipanteSchema>;

// ── Query params para búsqueda ────────────────────────────────────────────────

export const busquedaParticipanteSchema = z.object({
  q:         z.string().max(100).optional(),
  edicionId: z.string().min(1).optional(),
});

export type BusquedaParticipanteInput = z.infer<typeof busquedaParticipanteSchema>;

// ── Inscripción ───────────────────────────────────────────────────────────────

export const inscripcionSchema = z.object({
  participanteId: z.string().min(1, "Falta indicar el participante que se va a inscribir"),
  edicionId:      z.string().min(1, "Falta indicar la edición en la que se va a inscribir"),
});

export type InscripcionInput = z.infer<typeof inscripcionSchema>;
