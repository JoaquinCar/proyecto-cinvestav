import { z } from "zod";
import { TIPOS_IMPORTACION } from "@/lib/importacion/columnas";

// ── Petición (multipart) ──────────────────────────────────────────────────────

export const tipoImportacionSchema = z.enum(TIPOS_IMPORTACION);

export const peticionImportacionSchema = z.object({
  tipo: tipoImportacionSchema,
  edicionId: z.string().min(1, "Selecciona una edición"),
});

export type PeticionImportacionInput = z.infer<typeof peticionImportacionSchema>;

export const plantillaSchema = z.object({ tipo: tipoImportacionSchema });

/** Tope de tamaño del .xlsx aceptado (5 MB). */
export const TAMANO_MAXIMO_ARCHIVO = 5 * 1024 * 1024;

/** Tope de filas de datos por archivo, para no tumbar la transacción. */
export const FILAS_MAXIMAS = 2000;

// ── Filas ya convertidas (el parser hace la coerción; Zod pone los límites) ────

export const filaParticipanteSchema = z.object({
  nombre: z.string().min(1, "el nombre no puede quedar vacío").max(100, "el nombre supera 100 caracteres"),
  apellidos: z.string().min(1, "los apellidos no pueden quedar vacíos").max(100, "los apellidos superan 100 caracteres"),
  edad: z
    .number()
    .int("la edad debe ser un número entero")
    .min(2, "la edad debe ser de al menos 2 años")
    .max(18, "la edad no puede ser mayor a 18 años"),
  genero: z.enum(["FEMENINO", "MASCULINO"]).nullable(),
  grado: z.string().max(50, "el grado supera 50 caracteres"),
  nivel: z.enum(["PREESCOLAR", "PRIMARIA", "SECUNDARIA", "MEDIA_SUPERIOR", "SIN_ESCUELA"]),
  escuela: z.string().min(1).max(200, "la escuela supera 200 caracteres"),
  ciudad: z.string().max(100, "la ciudad supera 100 caracteres"),
  correo: z.string().max(150, "el correo supera 150 caracteres"),
  telefono: z.string().max(50, "el teléfono supera 50 caracteres"),
  /**
   * Claves cuya celda venía con contenido en el archivo. Sirve para no pisar un
   * dato bueno de la base con un valor por omisión que el archivo nunca trajo.
   */
  provistos: z.array(z.string()),
});

export type FilaParticipante = z.infer<typeof filaParticipanteSchema>;

export const filaSesionSchema = z.object({
  orden: z.number().int().nullable(),
  tema: z.string().min(1, "el tema de la sesión no puede quedar vacío").max(300, "el tema supera 300 caracteres"),
  clase: z.string().min(1).max(300, "el nombre de la clase supera 300 caracteres"),
  investigador: z.string().min(1).max(200, "el investigador supera 200 caracteres"),
  sede: z.string().max(100, "la sede supera 100 caracteres"),
  fecha: z.date(),
  notas: z.string().max(500, "las notas superan 500 caracteres"),
  conDatos: z.boolean(),
  ninas: z.number().int().min(0, "el número de niñas no puede ser negativo"),
  ninos: z.number().int().min(0, "el número de niños no puede ser negativo"),
  total: z.number().int().min(0, "el total no puede ser negativo"),
  mamas: z.number().int().min(0, "el número de mamás no puede ser negativo"),
  papas: z.number().int().min(0, "el número de papás no puede ser negativo"),
  preescolar: z.number().int().min(0),
  primaria: z.number().int().min(0),
  secundaria: z.number().int().min(0),
  mediaSuperior: z.number().int().min(0),
  porEdad: z.record(z.string(), z.number().int().min(0)),
});

export type FilaSesion = z.infer<typeof filaSesionSchema>;

export const filaAsistenciaSchema = z.object({
  nombre: z.string().min(1, "el nombre no puede quedar vacío").max(100),
  apellidos: z.string().min(1, "los apellidos no pueden quedar vacíos").max(100),
  marcas: z.array(
    z.object({
      columna: z.string(),
      etiqueta: z.string(),
      fecha: z.date().nullable(),
      presente: z.boolean(),
    }),
  ),
});

export type FilaAsistencia = z.infer<typeof filaAsistenciaSchema>;
