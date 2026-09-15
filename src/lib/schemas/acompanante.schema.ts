import { z } from "zod";

// ── Parentesco ────────────────────────────────────────────────────────────────
// Quién es el acompañante respecto del niño.
//
// La lista incluye GRUPO e INSTITUCION porque el dato real lo exige: en 2026 un
// mismo contacto inscribió a 25 niños, y esos 25 no son hermanos ni tienen un
// tutor común. Forzarlos a "TUTOR" guardaría una mentira en la base.

export const PARENTESCOS = [
  "MADRE",
  "PADRE",
  "ABUELA",
  "ABUELO",
  "TIA",
  "TIO",
  "TUTOR",
  "GRUPO",
  "INSTITUCION",
  "OTRO",
] as const;

export type Parentesco = (typeof PARENTESCOS)[number];

/** Cómo se nombra cada parentesco en pantalla. */
export const PARENTESCO_LABEL: Record<Parentesco, string> = {
  MADRE:       "Mamá",
  PADRE:       "Papá",
  ABUELA:      "Abuela",
  ABUELO:      "Abuelo",
  TIA:         "Tía",
  TIO:         "Tío",
  TUTOR:       "Tutor o tutora",
  GRUPO:       "Grupo",
  INSTITUCION: "Institución",
  OTRO:        "Otro",
};

// ── Campos opcionales de contacto ─────────────────────────────────────────────
// Un campo vacío en el formulario llega como "" y no como ausente. Sin esta
// normalización, `z.email()` rechazaría un formulario en el que simplemente no
// se capturó el correo — que es el caso normal.

const textoOpcional = (max: number, mensajeMax: string) =>
  z
    .string()
    .trim()
    .max(max, mensajeMax)
    .transform((v) => (v.length === 0 ? undefined : v))
    .optional();

const correoOpcional = z
  .string()
  .trim()
  .transform((v) => (v.length === 0 ? undefined : v))
  .optional()
  .refine(
    (v) => v === undefined || z.email().safeParse(v).success,
    { message: "El correo no parece un correo (falta la @ o el dominio)" },
  );

// ── Alta de un acompañante ────────────────────────────────────────────────────
// Solo el nombre es obligatorio: en campo, muchas veces lo único que se alcanza
// a capturar es "Laura, la mamá de Ana". El .trim() va antes del .min(1) por lo
// mismo que en participante.schema: una cadena de espacios no es un nombre, y
// ese texto es el que verá el becario el año que viene para reutilizarlo.

export const acompananteSchema = z.object({
  nombre: z
    .string({ error: "El nombre del acompañante es requerido" })
    .trim()
    .min(1, "Escribe al menos el nombre del acompañante")
    .max(100, "El nombre no puede exceder 100 caracteres"),

  apellidos: textoOpcional(100, "Los apellidos no pueden exceder 100 caracteres"),

  telefono: textoOpcional(30, "El teléfono no puede exceder 30 caracteres"),

  correo: correoOpcional,

  parentesco: z.enum(PARENTESCOS, {
    error: "Elige qué es el acompañante del niño (mamá, papá, grupo…)",
  }),
});

export type AcompananteInput = z.infer<typeof acompananteSchema>;

// ── Ligar un acompañante a una inscripción ────────────────────────────────────
//
// Dos caminos, exactamente uno por petición:
//   · `acompananteId` — se eligió uno que YA existe. Es el camino del segundo
//     hermano y del grupo de 25: reutiliza la ficha en vez de duplicarla.
//   · `acompanante`   — nadie lo había capturado todavía; se crea y se liga.
//
// Mandar los dos se rechaza: significaría "reutiliza este… y además crea este
// otro", que es justo cómo aparecen los duplicados.

export const asignarAcompananteSchema = z
  .object({
    acompananteId: z.string().min(1).optional(),
    acompanante:   acompananteSchema.optional(),
  })
  .refine(
    (d) => Boolean(d.acompananteId) !== Boolean(d.acompanante),
    {
      message:
        "Elige un acompañante de la lista o captura uno nuevo, pero no las dos cosas a la vez",
    },
  );

export type AsignarAcompananteInput = z.infer<typeof asignarAcompananteSchema>;

/**
 * La misma elección, pero opcional: es como viaja el acompañante dentro de
 * `POST /api/inscripciones`. Sin acompañante la inscripción es válida — la
 * mayoría de los niños llega sin nadie a quien registrar.
 */
export const acompananteOpcionalSchema = z
  .object({
    acompananteId: z.string().min(1).optional(),
    acompanante:   acompananteSchema.optional(),
  })
  .refine((d) => !(d.acompananteId && d.acompanante), {
    message:
      "Elige un acompañante de la lista o captura uno nuevo, pero no las dos cosas a la vez",
  });

// ── Búsqueda ──────────────────────────────────────────────────────────────────

export const busquedaAcompananteSchema = z.object({
  q: z.string().max(100).optional(),
});

export type BusquedaAcompananteInput = z.infer<typeof busquedaAcompananteSchema>;
