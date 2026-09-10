import { z } from "zod";

// ── Schema para crear una clase ───────────────────────────────────────────────

export const crearClaseSchema = z.object({
  edicionId: z.string({ error: "El ID de edición es requerido" }).min(1, "ID de edición inválido"),

  nombre: z
    .string({ error: "El nombre es requerido" })
    .min(1, "El nombre no puede estar vacío")
    .max(200, "El nombre no puede exceder 200 caracteres")
    .trim(),

  investigador: z
    .string({ error: "El investigador es requerido" })
    .min(1, "El nombre del investigador no puede estar vacío")
    .max(200, "El nombre del investigador no puede exceder 200 caracteres")
    .trim(),

  descripcion: z
    .string()
    .max(1000, "La descripción no puede exceder 1000 caracteres")
    .trim()
    .optional(),
});

// ── Schema para editar una clase (todos los campos opcionales) ────────────────

export const editarClaseSchema = z.object({
  nombre: z
    .string()
    .min(1, "El nombre no puede estar vacío")
    .max(200, "El nombre no puede exceder 200 caracteres")
    .trim()
    .optional(),

  investigador: z
    .string()
    .min(1, "El nombre del investigador no puede estar vacío")
    .max(200, "El nombre del investigador no puede exceder 200 caracteres")
    .trim()
    .optional(),

  descripcion: z
    .string()
    .max(1000, "La descripción no puede exceder 1000 caracteres")
    .trim()
    .nullable()
    .optional(),
});

// ── Schema para crear una sesión ──────────────────────────────────────────────

export const crearSesionSchema = z.object({
  claseId: z.string({ error: "El ID de clase es requerido" }).min(1, "ID de clase inválido"),

  fecha: z
    .string({ error: "La fecha es requerida" })
    .datetime({ message: "La fecha debe ser una fecha ISO 8601 válida" }),

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

// ── Schema para actualizar temas/notas de una sesión (BECARIO+) ───────────────

export const actualizarSesionSchema = z.object({
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

// ── Tipos inferidos ───────────────────────────────────────────────────────────

export type CrearClaseInput     = z.infer<typeof crearClaseSchema>;
export type EditarClaseInput    = z.infer<typeof editarClaseSchema>;
export type CrearSesionInput    = z.infer<typeof crearSesionSchema>;
export type ActualizarSesionInput = z.infer<typeof actualizarSesionSchema>;
export type SubirImagenClaseInput = z.infer<typeof subirImagenClaseSchema>;
