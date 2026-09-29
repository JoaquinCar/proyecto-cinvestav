import { z } from "zod";

// ── Rol del staff ─────────────────────────────────────────────────────────────
// Qué hace esa persona en el programa. NO es el rol del sistema (`Role`:
// ADMIN / BECARIO / READONLY): eso es un permiso de la app y la mayoría del
// staff ni siquiera tiene cuenta. Esto describe a la persona, como `Parentesco`
// describe a un acompañante.

export const ROLES_STAFF = [
  "INVESTIGADOR",
  "BECARIO",
  "COORDINACION",
  "APOYO",
  "VOLUNTARIO",
  "OTRO",
] as const;

export type RolStaff = (typeof ROLES_STAFF)[number];

/** Cómo se nombra cada rol en pantalla. */
export const ROL_STAFF_LABEL: Record<RolStaff, string> = {
  INVESTIGADOR: "Investigador o investigadora",
  BECARIO:      "Becario o becaria",
  COORDINACION: "Coordinación",
  APOYO:        "Apoyo",
  VOLUNTARIO:   "Voluntario o voluntaria",
  OTRO:         "Otro",
};

// ── Campos opcionales ─────────────────────────────────────────────────────────
// Mismo tratamiento que en acompanante.schema: un campo vacío del formulario
// llega como "" y no como ausente. Sin normalizarlo, `z.email()` rechazaría un
// alta en la que simplemente no se capturó el correo.

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

// ── Alta de una persona de staff ──────────────────────────────────────────────
// Solo el nombre es obligatorio. En la práctica, al armar la lista de una
// sesión lo que se sabe seguro es el nombre; el teléfono aparece después.

export const staffSchema = z.object({
  nombre: z
    .string({ error: "El nombre de la persona de staff es requerido" })
    .trim()
    .min(1, "Escribe al menos el nombre de la persona")
    .max(100, "El nombre no puede exceder 100 caracteres"),

  apellidos: textoOpcional(100, "Los apellidos no pueden exceder 100 caracteres"),

  telefono: textoOpcional(30, "El teléfono no puede exceder 30 caracteres"),

  correo: correoOpcional,

  institucion: textoOpcional(120, "La institución no puede exceder 120 caracteres"),

  rol: z.enum(ROLES_STAFF, {
    error: "Elige qué hace esta persona en el programa (investigador, becario…)",
  }),
});

export type StaffInput = z.infer<typeof staffSchema>;

// ── Asignar staff a una sesión ────────────────────────────────────────────────
//
// Dos caminos, exactamente uno por petición — el mismo contrato que ya usa
// `asignarAcompananteSchema`, y por la misma razón:
//   · `staffId`  — la persona YA existe. Es el camino normal: el mismo becario
//     está en veinte sesiones y en diecinueve de ellas se reutiliza su ficha.
//   · `staff`    — nadie la había capturado; se crea y se asigna.
//
// Mandar las dos se rechaza: significaría "reutiliza esta… y además crea esta
// otra", que es exactamente cómo aparecen los duplicados.

export const asignarStaffSchema = z
  .object({
    staffId: z.string().min(1).optional(),
    staff:   staffSchema.optional(),
  })
  .refine((d) => Boolean(d.staffId) !== Boolean(d.staff), {
    message:
      "Elige a alguien de la lista o captura a una persona nueva, pero no las dos cosas a la vez",
  });

export type AsignarStaffInput = z.infer<typeof asignarStaffSchema>;

// ── Búsqueda ──────────────────────────────────────────────────────────────────

export const busquedaStaffSchema = z.object({
  q: z.string().max(100).optional(),
});

export type BusquedaStaffInput = z.infer<typeof busquedaStaffSchema>;
