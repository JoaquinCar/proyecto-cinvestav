// Lectura del multipart de importación, compartida por /previsualizar y /ejecutar.
// No toca la base: solo valida la forma de la petición y devuelve el archivo.

import {
  TAMANO_MAXIMO_ARCHIVO,
  peticionImportacionSchema,
} from "@/lib/schemas/importacion.schema";
import type { TipoImportacion } from "./columnas";

export class ErrorPeticion extends Error {
  constructor(
    message: string,
    readonly estado: number,
    readonly detalles?: unknown,
  ) {
    super(message);
  }
}

export interface PeticionImportacion {
  tipo: TipoImportacion;
  edicionId: string;
  archivo: ArrayBuffer;
  nombreArchivo: string;
}

const EXTENSIONES = [".xlsx", ".xls", ".xlsm"];

export async function leerPeticionImportacion(
  request: Request,
): Promise<PeticionImportacion> {
  let formulario: FormData;
  try {
    formulario = await request.formData();
  } catch {
    throw new ErrorPeticion("La petición no trae un formulario válido.", 400);
  }

  const parsed = peticionImportacionSchema.safeParse({
    tipo: formulario.get("tipo"),
    edicionId: formulario.get("edicionId"),
  });
  if (!parsed.success) {
    throw new ErrorPeticion("Datos inválidos", 422, parsed.error.flatten());
  }

  const archivo = formulario.get("archivo");
  if (!(archivo instanceof File)) {
    throw new ErrorPeticion("Falta el archivo de Excel.", 400);
  }
  if (archivo.size === 0) {
    throw new ErrorPeticion("El archivo está vacío.", 400);
  }
  if (archivo.size > TAMANO_MAXIMO_ARCHIVO) {
    throw new ErrorPeticion(
      `El archivo pesa ${(archivo.size / 1024 / 1024).toFixed(1)} MB; el máximo es ${
        TAMANO_MAXIMO_ARCHIVO / 1024 / 1024
      } MB.`,
      413,
    );
  }
  const nombre = archivo.name.toLowerCase();
  if (!EXTENSIONES.some((e) => nombre.endsWith(e))) {
    throw new ErrorPeticion(
      `«${archivo.name}» no es una hoja de cálculo. Se aceptan archivos ${EXTENSIONES.join(", ")}.`,
      415,
    );
  }

  return {
    tipo: parsed.data.tipo,
    edicionId: parsed.data.edicionId,
    archivo: await archivo.arrayBuffer(),
    nombreArchivo: archivo.name,
  };
}
