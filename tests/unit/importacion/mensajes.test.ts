import { describe, it, expect } from "vitest";
import { avisoDeErrores, tituloDeErrores } from "@/lib/importacion/mensajes";
import type { Incidencia } from "@/lib/importacion/parseo";

const deFila = (fila: number): Incidencia => ({ fila, mensaje: "la columna «Edad» dice «diez»" });
const deArchivo = (): Incidencia => ({
  fila: null,
  mensaje: "Falta la columna obligatoria «Apellidos».",
});

describe("tituloDeErrores", () => {
  it("concuerda en singular", () => {
    expect(tituloDeErrores(1)).toBe("1 error que impide importar");
  });

  it("concuerda en plural", () => {
    expect(tituloDeErrores(3)).toBe("3 errores que impiden importar");
  });
});

describe("avisoDeErrores", () => {
  it("cuenta filas cuando todos los problemas son de fila", () => {
    expect(avisoDeErrores([deFila(2), deFila(5)])).toContain("2 filas con problemas");
    expect(avisoDeErrores([deFila(2)])).toContain("1 fila con problemas");
  });

  // Lo que falla aquí no está en ninguna fila: mandar a quien importa a buscar
  // «la fila 1» de su hoja es mandarlo a un sitio donde no hay nada que
  // arreglar. Pasaba al faltar una columna obligatoria y al subir una hoja sin
  // datos, los dos tropiezos más comunes.
  it("no habla de filas cuando el problema es del archivo entero", () => {
    const aviso = avisoDeErrores([deArchivo()]);
    expect(aviso).not.toMatch(/fila/i);
    expect(aviso).toContain("no se puede importar");
  });

  it("distingue la mezcla de problemas de fila y de archivo", () => {
    const aviso = avisoDeErrores([deArchivo(), deFila(4)]);
    expect(aviso).toContain("2 problemas");
    expect(aviso).toContain("1 en filas concretas");
  });

  it("siempre remite al detalle de abajo", () => {
    for (const caso of [[deFila(2)], [deArchivo()], [deArchivo(), deFila(4)]]) {
      expect(avisoDeErrores(caso)).toContain("Revisa el detalle que aparece abajo.");
    }
  });
});
