import { z } from "zod";
import { acompananteSchema } from "@/lib/schemas/acompanante.schema";
import { LARGO_MAXIMO_CIUDAD, normalizarCiudad } from "@/lib/ciudades";

// ── Participante ──────────────────────────────────────────────────────────────

// El .trim() va ANTES del .min(1): al revés, una cadena de solo espacios pasa
// el mínimo y se recorta después, guardando un nombre vacío en la base — y ese
// nombre es el que se imprime en la constancia del niño.

// La ciudad de la que viene el niño. OPCIONAL y canonizada — el porqué de las
// dos cosas está en src/lib/ciudades.ts, que es donde vive la decisión:
//   · Opcional porque en los respaldos hay fichas sin ciudad y porque la carga
//     la hace una persona a mano; un campo obligatorio que no puede rellenar la
//     deja atascada.
//   · Canonizada porque el campo se pidió PARA la estadística «de dónde vienen
//     los niños», y cuatro grafías de Mérida son cuatro barras que no dicen
//     nada. Lo que no esté en el catálogo se conserva tal cual, capitalizado.
// Tres estados, y los tres significan algo distinto:
//   · ausente (`undefined`) — la petición no habla de la ciudad. Al editar eso
//     es «no la toques»; al dar de alta, el participante nace sin ella.
//   · cadena vacía o `null` — se capturó explícitamente que no se sabe, o se
//     está borrando una ciudad mal escrita. Se guarda NULL.
//   · con texto — se canoniza antes de guardar.
export const ciudadSchema = z
  .string()
  .max(LARGO_MAXIMO_CIUDAD, `La ciudad no puede exceder ${LARGO_MAXIMO_CIUDAD} caracteres`)
  .nullable()
  .transform((valor) => normalizarCiudad(valor))
  // El `.optional()` va EL ÚLTIMO, envolviendo a la transformación: así la
  // clave queda opcional también en el tipo (`ciudad?: string | null`) y
  // ninguna llamada que no hable de la ciudad tiene que inventarse el campo.
  // Al revés —optional dentro del pipe— el tipo la seguiría exigiendo.
  .optional();

export const participanteSchema = z.object({
  nombre:    z.string().trim().min(1, "Nombre requerido").max(100),
  apellidos: z.string().trim().min(1, "Apellidos requeridos").max(100),
  edad:      z.number().int().min(5, "Edad mínima 5 años").max(18, "Edad máxima 18 años"),
  escuela:   z.string().trim().min(1, "Escuela requerida").max(200),
  grado:     z.string().trim().min(1, "Grado requerido").max(50),
  genero:    z.enum(["FEMENINO", "MASCULINO"]).optional(),
  ciudad:    ciudadSchema,
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

// El acompañante viaja aquí, en la inscripción, y no en el alta del
// participante: es de la edición, no del niño. Y es opcional — registrar a
// quien viene solo no debe pedir nada de más.

export const inscripcionSchema = z
  .object({
    participanteId: z.string().min(1, "Falta indicar el participante que se va a inscribir"),
    edicionId:      z.string().min(1, "Falta indicar la edición en la que se va a inscribir"),

    /** Acompañante que YA existe: el segundo hermano reutiliza el del primero. */
    acompananteId: z.string().min(1).optional(),

    /** Acompañante que nadie había capturado todavía: se crea y se liga. */
    acompanante: acompananteSchema.optional(),
  })
  .refine((d) => !(d.acompananteId && d.acompanante), {
    message:
      "Elige un acompañante de la lista o captura uno nuevo, pero no las dos cosas a la vez",
  });

export type InscripcionInput = z.infer<typeof inscripcionSchema>;
