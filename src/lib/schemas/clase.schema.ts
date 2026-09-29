import { z } from "zod";
import { aFechaCalendario } from "@/lib/fechas";
import { VALORES_TIPO_SESION, TIPO_SESION_POR_DEFECTO } from "@/lib/tipos-sesion";

// ── Fecha de calendario ───────────────────────────────────────────────────────

/**
 * Fecha sin hora (el día en que ocurre una sesión).
 *
 * Acepta tanto "AAAA-MM-DD" —lo que manda un `<input type="date">`— como un ISO
 * 8601 completo, y normaliza ambos a la medianoche UTC de ese día. Es el único
 * punto donde una fecha de calendario se convierte a `Date`: así el día que
 * escribió la persona es el que se guarda, sin pasar por la zona local.
 */
export const fechaCalendarioSchema = z
  .string({ error: "La fecha es requerida" })
  .trim()
  .regex(
    /^\d{4}-\d{2}-\d{2}([T ].*)?$/,
    "La fecha debe tener el formato AAAA-MM-DD",
  )
  .refine(
    (valor) => {
      try {
        aFechaCalendario(valor);
        return true;
      } catch {
        return false;
      }
    },
    { message: "Esa fecha no existe en el calendario" },
  )
  .transform(aFechaCalendario);

// ── Tipo de actividad ─────────────────────────────────────────────────────────

/**
 * Qué clase de actividad es: sesión de pasaporte, de lectura o evento especial.
 *
 * Sin el campo se asume PASAPORTE, el mismo criterio que el DEFAULT de la
 * columna: así un cliente viejo —o una petición escrita a mano— sigue creando
 * lo que creaba antes.
 */
export const tipoSesionSchema = z.enum(VALORES_TIPO_SESION, {
  error: "Elige si es sesión de pasaporte, de lectura o un evento especial",
});

/**
 * Nombre del investigador cuando PUEDE faltar (eventos especiales).
 *
 * Normaliza a `null` lo que llega ausente, vacío o con espacios: un `<input>`
 * que nadie tocó manda `""`, y eso significa «no lo imparte nadie», no «campo
 * sin llenar».
 */
const investigadorOpcionalSchema = z
  .string()
  .max(200, "El nombre del investigador no puede exceder 200 caracteres")
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullish()
  .transform((v) => v ?? null);

/** Nombre del investigador cuando es OBLIGATORIO (pasaporte y lectura). */
const investigadorRequeridoSchema = z
  .string({ error: "El investigador es requerido" })
  .trim()
  .min(1, "El nombre del investigador no puede estar vacío")
  .max(200, "El nombre del investigador no puede exceder 200 caracteres");

// ── Schema para crear una clase ───────────────────────────────────────────────

/** Los campos que no dependen del tipo. */
const camposComunesClase = {
  edicionId: z.string({ error: "Falta indicar la edición" }).min(1, "Selecciona la edición a la que pertenece la sesión"),

  nombre: z
    .string({ error: "El nombre es requerido" })
    .min(1, "El nombre no puede estar vacío")
    .max(200, "El nombre no puede exceder 200 caracteres")
    .trim(),

  /** Día en que se imparte. Se crea con la clase, en la misma transacción. */
  fecha: fechaCalendarioSchema,

  descripcion: z
    .string()
    .max(1000, "La descripción no puede exceder 1000 caracteres")
    .trim()
    .optional(),

  /** Temas de la sesión; opcionales, se suelen capturar después de impartirla. */
  temas: z
    .string()
    .max(500, "Los temas no pueden exceder 500 caracteres")
    .trim()
    .optional(),
};

/**
 * Crear una clase crea también su sesión: en el programa una clase ES una
 * charla impartida en una fecha (las 12 clases reales tienen exactamente una
 * sesión). Por eso `fecha` es obligatoria — sin ella la clase nacía con cero
 * sesiones y no se le podía pasar lista hasta "agregarle" una a mano.
 *
 * POR QUÉ UNA UNIÓN DISCRIMINADA Y NO UN `superRefine`
 *
 * El investigador es obligatorio en unos tipos y no en otros, así que es una
 * regla cruzada entre dos campos. La versión obvia —un objeto con
 * `.superRefine()`— tiene un defecto que se nota justo cuando más molesta: un
 * refinamiento de objeto solo corre si TODO el resto del objeto validó. Mandar
 * el formulario vacío devolvía «revisa nombre, edición y fecha», el usuario los
 * llenaba, volvía a mandar, y solo ENTONCES se enteraba de que además faltaba
 * el investigador. Dos viajes para un formulario en blanco.
 *
 * Con una rama por tipo, el investigador es un campo normal dentro de su rama y
 * se reporta a la vez que los demás. `tipo` se rellena antes (ver el
 * `preprocess`) para que la unión siempre tenga discriminante.
 *
 * Qué rama exige investigador lo decide `exigeInvestigador`, el mismo helper
 * que usan los formularios y la ruta de edición; la prueba
 * «las ramas del schema respetan exigeInvestigador» impide que se separen.
 */
const ramaPasaporte = z.object({
  ...camposComunesClase,
  tipo: z.literal("PASAPORTE"),
  investigador: investigadorRequeridoSchema,
});

const ramaLectura = z.object({
  ...camposComunesClase,
  tipo: z.literal("LECTURA"),
  investigador: investigadorRequeridoSchema,
});

const ramaEvento = z.object({
  ...camposComunesClase,
  tipo: z.literal("EVENTO"),
  // Aquí y solo aquí puede faltar: una clausura no la imparte ningún
  // investigador. Si lo ponen, se guarda.
  investigador: investigadorOpcionalSchema,
});

export const crearClaseSchema = z.preprocess(
  // Sin `tipo` la unión no sabría por dónde entrar. Se rellena con el mismo
  // valor por defecto que tiene la columna, así que un cliente viejo —o una
  // petición escrita a mano— sigue creando exactamente lo que creaba antes.
  (valor) => {
    if (typeof valor !== "object" || valor === null || Array.isArray(valor)) {
      return valor;
    }
    const obj = valor as Record<string, unknown>;
    return obj.tipo === undefined || obj.tipo === null
      ? { ...obj, tipo: TIPO_SESION_POR_DEFECTO }
      : obj;
  },
  z.discriminatedUnion("tipo", [ramaPasaporte, ramaLectura, ramaEvento], {
    error: "Elige si es sesión de pasaporte, de lectura o un evento especial",
  }),
);

/** Las ramas, expuestas para que las pruebas comprueben que no se desvían. */
export const RAMAS_CREAR_CLASE = {
  PASAPORTE: ramaPasaporte,
  LECTURA: ramaLectura,
  EVENTO: ramaEvento,
} as const;

// ── Schema para editar una clase (todos los campos opcionales) ────────────────

export const editarClaseSchema = z.object({
  /**
   * Fecha de la sesión de la clase. Vive aquí porque el detalle de la clase ya
   * no ofrece "Agregar Sesión": si la fecha no se pudiera corregir al editar,
   * un dedazo quedaría permanente.
   */
  fecha: fechaCalendarioSchema.optional(),

  nombre: z
    .string()
    .min(1, "El nombre no puede estar vacío")
    .max(200, "El nombre no puede exceder 200 caracteres")
    .trim()
    .optional(),

  /**
   * Cambiar el tipo de una sesión ya creada. Es lo que permite corregir una
   * captura equivocada sin borrarla y rehacerla —lo que se llevaría por delante
   * las asistencias—, y cambia si esa asistencia cuenta o no para la constancia.
   */
  tipo: tipoSesionSchema.optional(),

  /**
   * `null` deja la sesión sin investigador. Solo vale para un evento especial,
   * y como aquí no se sabe el tipo final —puede no venir en la petición— esa
   * comprobación se hace en la ruta, con el tipo ya resuelto contra lo guardado.
   */
  investigador: investigadorOpcionalSchema.optional(),

  descripcion: z
    .string()
    .max(1000, "La descripción no puede exceder 1000 caracteres")
    .trim()
    .nullable()
    .optional(),
});

// ── Schema para crear una sesión ──────────────────────────────────────────────

export const crearSesionSchema = z.object({
  claseId: z.string({ error: "Falta indicar la sesión" }).min(1, "Selecciona la sesión a la que pertenece la fecha"),

  fecha: fechaCalendarioSchema,

  temas: z
    .string()
    .max(500, "Los temas no pueden exceder 500 caracteres")
    .trim()
    .optional(),

  notas: z
    .string()
    .max(1000, "Las notas no pueden exceder 1000 caracteres")
    .trim()
    .optional(),
});

// ── Schema para actualizar una sesión (BECARIO+) ──────────────────────────────

export const actualizarSesionSchema = z.object({
  /** Corregir la fecha: un dedazo en el año no debe quedar permanente. */
  fecha: fechaCalendarioSchema.optional(),

  temas: z
    .string()
    .max(500, "Los temas no pueden exceder 500 caracteres")
    .trim()
    .nullable()
    .optional(),

  notas: z
    .string()
    .max(1000, "Las notas no pueden exceder 1000 caracteres")
    .trim()
    .nullable()
    .optional(),
});

// ── Imágenes de clase ─────────────────────────────────────────────────────────

/** Tipos de imagen aceptados al subir o pegar contenido en una clase. */
export const TIPOS_IMAGEN_PERMITIDOS = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;

/** Tamaño máximo del binario decodificado (3 MB). */
export const TAMANO_MAXIMO_IMAGEN = 3 * 1024 * 1024;

/** Longitud máxima de la cadena base64 (~4 MB, deja margen sobre el binario). */
const LARGO_MAXIMO_BASE64 = Math.ceil((TAMANO_MAXIMO_IMAGEN * 4) / 3) + 1024;

export const subirImagenClaseSchema = z.object({
  mimeType: z.enum(TIPOS_IMAGEN_PERMITIDOS, {
    error: "Formato no permitido. Usa PNG, JPG, WebP o GIF",
  }),

  /** Contenido de la imagen en base64, sin el prefijo `data:`. */
  data: z
    .string({ error: "El contenido de la imagen es requerido" })
    .min(1, "La imagen está vacía")
    .max(LARGO_MAXIMO_BASE64, "La imagen supera el tamaño máximo de 3 MB")
    .regex(/^[A-Za-z0-9+/=\r\n]+$/, "El contenido de la imagen no es base64 válido"),

  titulo: z
    .string()
    .max(200, "El título no puede exceder 200 caracteres")
    .trim()
    .optional(),
});

/**
 * Tope de imágenes que se pueden reordenar de una vez.
 *
 * No es un límite del dominio sino del cuerpo de la petición: el reordenado
 * manda la lista COMPLETA de ids de la sesión, y 500 cuids son ~12 KB. Una
 * sesión real tiene decenas de fotos; muy por encima de eso lo que hay es un
 * cliente roto o alguien probando.
 */
const MAXIMO_IMAGENES_REORDENADAS = 500;

/**
 * Nuevo orden de las imágenes de una sesión: la lista completa de ids, de la
 * primera a la última.
 *
 * Aquí solo se valida la forma. Que la lista sea exactamente el conjunto de
 * imágenes de esa sesión —ni de más, ni de menos, ni repetidas— se comprueba
 * contra la base dentro de la transacción, que es el único sitio donde ese dato
 * no puede cambiar mientras se mira.
 */
export const reordenarImagenesSchema = z.object({
  orden: z
    .array(
      z
        .string({ error: "Cada imagen se identifica con su id" })
        .min(1, "Hay un id de imagen vacío en la lista"),
      { error: "Falta la lista con el nuevo orden de las imágenes" },
    )
    .min(1, "La lista con el nuevo orden no puede estar vacía")
    .max(
      MAXIMO_IMAGENES_REORDENADAS,
      `No se pueden reordenar más de ${MAXIMO_IMAGENES_REORDENADAS} imágenes a la vez`,
    ),
});

// ── Tipos inferidos ───────────────────────────────────────────────────────────

export type CrearClaseInput     = z.infer<typeof crearClaseSchema>;
export type EditarClaseInput    = z.infer<typeof editarClaseSchema>;
export type CrearSesionInput    = z.infer<typeof crearSesionSchema>;
export type ActualizarSesionInput = z.infer<typeof actualizarSesionSchema>;
export type SubirImagenClaseInput = z.infer<typeof subirImagenClaseSchema>;
export type ReordenarImagenesInput = z.infer<typeof reordenarImagenesSchema>;
