import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Excluir (o reincorporar) participantes de la entrega de constancias.
//
// El motivo es OBLIGATORIO al excluir. La política es que la constancia le toca
// a todo inscrito, así que quitársela a un niño es una excepción que alguien
// —el coordinador, ante la familia o ante la unidad— va a tener que justificar
// meses después. Una casilla marcada sin motivo no se puede justificar; una
// frase sí. Al reincorporar no se pide nada: devolver un derecho no necesita
// defensa.
//
// La lista admite varios a la vez porque el caso real es ese: 59 niños delante
// y cinco bajas que se marcan de una sentada.
// ─────────────────────────────────────────────────────────────────────────────

export const MOTIVO_MIN = 3;
export const MOTIVO_MAX = 300;
export const MAX_INSCRIPCIONES_POR_LOTE = 500;

export const exclusionConstanciaSchema = z
  .object({
    inscripcionIds: z
      .array(z.string().min(1, "hay un identificador vacío"), {
        error: "Falta la lista de participantes",
      })
      .min(1, "Selecciona al menos un participante")
      .max(
        MAX_INSCRIPCIONES_POR_LOTE,
        `No se pueden cambiar más de ${MAX_INSCRIPCIONES_POR_LOTE} participantes de una vez`,
      ),

    excluida: z.boolean({
      error: "Falta indicar si se excluye o se reincorpora",
    }),

    motivo: z
      .string()
      .trim()
      .max(MOTIVO_MAX, `El motivo no puede pasar de ${MOTIVO_MAX} caracteres`)
      .nullable()
      .optional(),
  })
  .refine(
    (datos) => !datos.excluida || (datos.motivo ?? "").trim().length >= MOTIVO_MIN,
    {
      message:
        "Escribe por qué no se le entrega la constancia: queda guardado junto a tu nombre y la fecha",
      path: ["motivo"],
    },
  );

export type ExclusionConstanciaInput = z.infer<typeof exclusionConstanciaSchema>;
