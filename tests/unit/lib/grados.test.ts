import { describe, it, expect } from "vitest";

import { GRADOS, GRADOS_POR_NIVEL } from "@/lib/grados";
import { derivarNivel, type Nivel } from "@/lib/importacion/texto";

// ─────────────────────────────────────────────────────────────────────────────
// El catálogo de grados del formulario y `derivarNivel` tienen que ir de la
// mano: cada etiqueta que se ofrece al registrar debe caer en el nivel que le
// corresponde, porque ese nivel es el que agrupa las gráficas. Una etiqueta que
// `derivarNivel` no reconozca acaba contada en el nivel equivocado —o en
// "Sin especificar"— sin que nadie se entere.
//
// El formulario solo ofrecía primaria: no se podía capturar ni preescolar ni
// secundaria, y en producción ya hay niños de ambos.
// ─────────────────────────────────────────────────────────────────────────────

/** Edad típica de cada nivel: `derivarNivel` también mira la edad. */
const EDAD_TIPICA: Record<Nivel, number> = {
  PREESCOLAR:     5,
  PRIMARIA:       9,
  SECUNDARIA:     13,
  MEDIA_SUPERIOR: 16,
  UNIVERSIDAD:    18,
  SIN_ESCUELA:    10,
};

describe("catálogo de grados del formulario", () => {
  it("cubre preescolar, primaria, secundaria, media superior, universidad y sin escuela", () => {
    const niveles = Object.keys(GRADOS_POR_NIVEL);
    expect(niveles).toContain("PREESCOLAR");
    expect(niveles).toContain("PRIMARIA");
    expect(niveles).toContain("SECUNDARIA");
    expect(niveles).toContain("MEDIA_SUPERIOR");
    expect(niveles).toContain("UNIVERSIDAD");
    expect(niveles).toContain("SIN_ESCUELA");
  });

  it("ofrece los tres grados de secundaria y los tres de media superior", () => {
    expect(GRADOS_POR_NIVEL.SECUNDARIA).toHaveLength(3);
    expect(GRADOS_POR_NIVEL.MEDIA_SUPERIOR).toHaveLength(3);
  });

  it("GRADOS es exactamente el aplanado de GRADOS_POR_NIVEL, sin repetidos", () => {
    const aplanado = Object.values(GRADOS_POR_NIVEL).flat();
    expect([...GRADOS]).toEqual(aplanado);
    expect(new Set(GRADOS).size).toBe(GRADOS.length);
  });

  it.each(
    Object.entries(GRADOS_POR_NIVEL).flatMap(([nivel, grados]) =>
      (grados as readonly string[]).map((grado) => [grado, nivel as Nivel] as const),
    ),
  )("«%s» se clasifica como %s", (grado, nivel) => {
    // La escuela se deja vacía a propósito: al registrar desde el formulario el
    // grado es lo único fiable, y es lo que debe mandar.
    expect(derivarNivel(grado, "", EDAD_TIPICA[nivel])).toBe(nivel);
  });

  it("clasifica bien aunque la escuela apunte a otro lado", () => {
    // Caso real: un niño de secundaria cuya escuela se capturó como "Primaria
    // Emma Godoy" por arrastre. El grado manda.
    expect(derivarNivel("2° secundaria", "Primaria Emma Godoy", 13)).toBe("SECUNDARIA");
    // Y el que no estudia sigue sin estudiar aunque tenga escuela escrita.
    expect(derivarNivel("No estudia", "Sin escuela", 10)).toBe("SIN_ESCUELA");
  });

  it("universidad no se confunde con una prepa universitaria", () => {
    // Las prepas de la UADY llevan "Universidad" en el nombre de la escuela:
    // el grado de prepa tiene que ganar.
    expect(derivarNivel("3° preparatoria", "Prepa de la Universidad Autónoma", 17))
      .toBe("MEDIA_SUPERIOR");
    expect(derivarNivel("5.º Semestre", "Prepa CECYTEY #6", 17)).toBe("MEDIA_SUPERIOR");
  });
});
