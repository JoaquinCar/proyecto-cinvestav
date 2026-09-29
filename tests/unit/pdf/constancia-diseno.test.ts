import { describe, it, expect } from "vitest";
import {
  DISENO_CONSTANCIA,
  AVISO_PROVISIONAL,
  marcaProvisional,
  type DisenoConstancia,
} from "@/lib/pdf/diseno-constancia";
import { generarPDFConstancia } from "@/lib/pdf/constancia";

// ─────────────────────────────────────────────────────────────────────────────
// El arte de la constancia todavía no existe: el cliente pasará la imagen de
// fondo y las firmas más adelante. La maquinaria sí existe ya, y estas pruebas
// fijan las dos cosas que tienen que seguir siendo ciertas cuando lleguen:
//
//   1. Mientras no lleguen, el PDF sale marcado como provisional. Nadie debe
//      poder entregar por error un documento con el diseño de relleno.
//   2. Sustituirlo es cambiar constantes, no reescribir el generador.
// ─────────────────────────────────────────────────────────────────────────────

const datos = {
  nombre: "Ana",
  apellidos: "García López",
  escuela: "Primaria Centro",
  grado: "3° primaria",
  edicion: { nombre: "Pasaporte Científico Mérida", anio: 2026 },
  asistencias: 6,
  totalSesiones: 8,
  fechaEmision: "28 de septiembre de 2026",
};

/** PNG de 1×1 transparente: hace de imagen de fondo y de firma escaneada. */
const PNG_1X1 =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe("diseño de la constancia — estado provisional", () => {
  it("hoy el diseño está marcado como provisional y sin arte definitivo", () => {
    expect(DISENO_CONSTANCIA.provisional).toBe(true);
    expect(DISENO_CONSTANCIA.fondo).toBeNull();
    expect(DISENO_CONSTANCIA.firmas).toEqual([]);
  });

  it("la marca de provisional aparece mientras lo sea y desaparece sola al apagarla", () => {
    expect(marcaProvisional(DISENO_CONSTANCIA)).toBe(AVISO_PROVISIONAL);
    expect(marcaProvisional({ ...DISENO_CONSTANCIA, provisional: false })).toBeNull();
  });
});

describe("generarPDFConstancia — el arte definitivo entra por constantes", () => {
  it("sigue emitiendo un PDF válido con el diseño provisional", async () => {
    const buffer = await generarPDFConstancia(datos);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.slice(0, 4).toString()).toBe("%PDF");
  });

  it("acepta fondo y firmas sin tocar el generador", async () => {
    const definitivo: DisenoConstancia = {
      ...DISENO_CONSTANCIA,
      provisional: false,
      fondo: PNG_1X1,
      firmas: [
        { nombre: "Dra. Coordinadora", cargo: "Coordinación del programa", imagen: PNG_1X1 },
        { nombre: "Dr. Director", cargo: "Dirección de la Unidad", imagen: null },
      ],
    };

    const buffer = await generarPDFConstancia(datos, definitivo);
    expect(buffer.slice(0, 4).toString()).toBe("%PDF");
    // Con fondo e imagen de firma el documento pesa más que el provisional.
    expect(buffer.length).toBeGreaterThan(200);
  });
});
