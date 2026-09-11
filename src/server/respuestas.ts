// Respuestas de error comunes a todos los endpoints.
//
// Dos reglas que este módulo hace cumplir:
//
// 1. Lo que NO se le cuenta a quien usa la app se registra en el servidor. Un
//    500 sin `console.error` deja el motivo real fuera de los logs y vuelve
//    imposible diagnosticar nada en producción.
// 2. Lo que sí se le cuenta no incluye rutas de archivo, nombres de tabla ni
//    trazas: quien opera esto es el coordinador del programa y los becarios,
//    no alguien que pueda interpretar un stack trace.

import { NextResponse } from "next/server";
import type { ZodError } from "zod";

/**
 * Último recurso: el fallo no era previsible y no hay nada concreto que decir.
 * Aun así indica que la acción no se completó y cuál es el siguiente paso.
 */
export const MENSAJE_FALLO_INESPERADO =
  "Ocurrió un problema en el servidor y la acción no se completó. Vuelve a intentarlo; si sigue igual, avisa a quien administra el sistema.";

/**
 * El cuerpo de la petición no era JSON válido. Antes esto reventaba dentro del
 * `try` y salía como 500 "Error interno del servidor" en unas rutas y como 400
 * en otras. No es un fallo del servidor: no se leyó nada, no se guardó nada.
 */
export const MENSAJE_CUERPO_ILEGIBLE =
  "Los datos del formulario llegaron dañados y no se guardó nada. Vuelve a cargar la página e inténtalo de nuevo.";

/** Nombres de campo tal como aparecen en los formularios. */
const ETIQUETAS_CAMPO: Record<string, string> = {
  anio:             "año",
  apellidos:        "apellidos",
  claseId:          "clase",
  contacto:         "contacto",
  data:             "archivo de la imagen",
  descripcion:      "descripción",
  edad:             "edad",
  edicionId:        "edición",
  escuela:          "escuela",
  fecha:            "fecha",
  fechaFin:         "fecha de fin",
  fechaInicio:      "fecha de inicio",
  genero:           "género",
  grado:            "grado",
  inscripcionId:    "participante",
  items:            "lista de asistencia",
  mimeType:         "tipo de imagen",
  minAsistencias:   "mínimo de asistencias",
  nombre:           "nombre",
  notas:            "notas",
  participanteId:   "participante",
  porcentajeMinimo: "porcentaje mínimo",
  presente:         "asistencia",
  sesionId:         "sesión",
  temas:            "temas",
};

function etiquetaDe(campo: string): string {
  return ETIQUETAS_CAMPO[campo] ?? campo;
}

/**
 * Convierte el resultado de Zod en una frase que nombra los campos que fallaron
 * y por qué. "Datos inválidos" a secas no le dice a nadie qué corregir.
 */
export function mensajeCamposInvalidos(error: ZodError): string {
  const { formErrors, fieldErrors } = error.flatten() as {
    formErrors: string[];
    fieldErrors: Record<string, string[] | undefined>;
  };

  const porCampo = Object.entries(fieldErrors)
    .map(([campo, mensajes]) => {
      const primero = mensajes?.[0];
      return primero ? `${etiquetaDe(campo)} (${primero})` : etiquetaDe(campo);
    })
    .filter(Boolean);

  if (porCampo.length > 0) {
    return `Revisa estos datos antes de guardar: ${porCampo.join(", ")}.`;
  }

  if (formErrors.length > 0) {
    return formErrors[0];
  }

  return "Los datos enviados no tienen el formato esperado. Revisa el formulario e inténtalo de nuevo.";
}

/** Respuesta 422 que nombra los campos mal llenados. */
export function respuestaCamposInvalidos(error: ZodError): NextResponse {
  return NextResponse.json(
    { error: mensajeCamposInvalidos(error), detalles: error.flatten() },
    { status: 422 },
  );
}

type CuerpoLeido =
  | { ok: true; datos: unknown }
  | { ok: false; respuesta: NextResponse };

/**
 * Lee el cuerpo JSON de la petición. Un cuerpo ilegible es 400 en TODAS las
 * rutas, con el mismo texto: antes dependía de si el `await request.json()`
 * caía dentro o fuera del `try` de cada archivo.
 */
export async function leerCuerpoJson(request: Request): Promise<CuerpoLeido> {
  try {
    return { ok: true, datos: await request.json() };
  } catch {
    return {
      ok: false,
      respuesta: NextResponse.json(
        { error: MENSAJE_CUERPO_ILEGIBLE },
        { status: 400 },
      ),
    };
  }
}

/**
 * Registra el error real en el servidor y responde 500 con un texto que no
 * filtra nada del interior. `contexto` es el identificador de la ruta, para
 * poder encontrarlo en los logs; `mensaje` permite decir qué acción concreta
 * no se completó en vez del texto genérico.
 */
export function fallaInesperada(
  contexto: string,
  error: unknown,
  mensaje: string = MENSAJE_FALLO_INESPERADO,
): NextResponse {
  console.error(`[${contexto}]`, error);
  return NextResponse.json({ error: mensaje }, { status: 500 });
}
