import { describe, it, expect } from "vitest";

import { derivarNivel, type Nivel } from "@/lib/importacion/texto";

// ─────────────────────────────────────────────────────────────────────────────
// Las 34 grafías reales de «grado» que hay en producción para 59 niños.
//
// `grado` es texto libre y así llegó del Excel del organizador: "3ero Primaria",
// "3.º de primaria.", "5°grado", "1°", "no asiste a la escuela"… El nivel que
// agrupa las gráficas NO está capturado, se deriva de esas cadenas. Añadir
// universidad, preescolar y secundaria al formulario obliga a tocar
// `derivarNivel`, y esta tabla es el candado: si una regla nueva reclasifica a
// un niño ya cargado, aquí se ve.
//
// Cada fila es [grado, escuela, edad, nivel esperado], copiada de la base.
// ─────────────────────────────────────────────────────────────────────────────

const REALES: ReadonlyArray<readonly [string, string, number, Nivel]> = [
  ["1°",                      "Sor Juana",                                  6,  "PRIMARIA"],
  ["1ero Primaria",           "Centro Educativo Montessori de Mérida",      6,  "PRIMARIA"],
  ["1ero Primaria",           "Centro de Estudios Mérida CEEMIH",           6,  "PRIMARIA"],
  ["1.º grado preescolar",    "Preescolar Chak pepen",                      6,  "PREESCOLAR"],
  ["1.º grado Secundaria",    "Secundaria Vazco de Quiroga (Teresiano)",    12, "SECUNDARIA"],
  ["2° año",                  "Esc. Sec. #26",                              14, "SECUNDARIA"],
  ["2do Primaria",            "Corem",                                      7,  "PRIMARIA"],
  ["2do Primaria",            "Centro Educativo Montessori de Mérida",      7,  "PRIMARIA"],
  ["2° grado primaria",       "Emma Godoy",                                 7,  "PRIMARIA"],
  ["2.º de primaria.",        "Sor Juana Inez de la Cruz",                  7,  "PRIMARIA"],
  ["2.º de secundaria",       "Secundaria Técnica #26",                     13, "SECUNDARIA"],
  ["2.º grado primaria",      "Primaria Emma Godoy",                        7,  "PRIMARIA"],
  ["2.º grado Secundaria",    "Secundaria Gonzalo Lopez Manzanero",         13, "SECUNDARIA"],
  ["3ero Primaria",           "Homeschool Mérida",                          8,  "PRIMARIA"],
  ["3ero Primaria",           "Centro Educativo Montessori de Mérida",      8,  "PRIMARIA"],
  ["3ero Primaria",           "Benito Juárez García",                       8,  "PRIMARIA"],
  ["3.º de preescolar",       "Preescolar Chak Pepen",                      5,  "PREESCOLAR"],
  ["3.º de primaria.",        "Primaria Sor Juana Inez de la Cruz",         8,  "PRIMARIA"],
  ["3.º de primaria.",        "Sor Juana Inez de la Cruz",                  9,  "PRIMARIA"],
  ["3.º grado",               "Primaria Emma Godoy",                        8,  "PRIMARIA"],
  ["4.º de primaria.",        "Sor Juana Inez de la Cruz",                  11, "PRIMARIA"],
  ["4.º grado",               "Primaria Emma Godoy",                        9,  "PRIMARIA"],
  ["4.º grado primaria",      "Primaria Emma Godoy",                        9,  "PRIMARIA"],
  ["4to Primaria",            "Centro Educativo Montessori de Mérida",      9,  "PRIMARIA"],
  ["4to Primaria",            "Emiliano Zapata",                            9,  "PRIMARIA"],
  ["4to Primaria",            "Mano amiga Conkal",                          9,  "PRIMARIA"],
  ["4to Primaria",            "Centro Educativo Montessori de Mérida",      10, "PRIMARIA"],
  ["5°grado",                 "Primaria Emma Godoy",                        11, "PRIMARIA"],
  ["5.º de primaria.",        "Primaria Emma Godoy",                        10, "PRIMARIA"],
  ["5.º Semestre",            "Prepa CECYTEY #6",                           17, "MEDIA_SUPERIOR"],
  ["5to Primaria",            "Centro Educativo Montessori de Mérida",      10, "PRIMARIA"],
  ["6° grado",                "Sor Juana",                                  10, "PRIMARIA"],
  ["6° primaria",             "Sor Juana Inez de la Cruz",                  11, "PRIMARIA"],
  ["6.º de primaria.",        "Sor Juana Inez de la Cruz",                  11, "PRIMARIA"],
  ["6to Primaria",            "Emiliano Zapata",                            11, "PRIMARIA"],
  ["6to Primaria",            "Cedunoel",                                   11, "PRIMARIA"],
  ["no asiste a la escuela",  "Sin escuela",                                4,  "SIN_ESCUELA"],
  ["No va a escuela",         "Sin escuela",                                11, "SIN_ESCUELA"],
  ["No va a escuela",         "Sin escuela",                                15, "SIN_ESCUELA"],
  ["Preescolar",              "Centro Educativo Montessori de Mérida",      5,  "PREESCOLAR"],
  ["Preescolar",              "Centro Educativo Montessori de Mérida",      4,  "PREESCOLAR"],
  ["Secundaria",              "Secundaria No.22 de febrero CROC",           12, "SECUNDARIA"],
  ["Secundaria",              "Aurelio Pinto Ramírez",                      12, "SECUNDARIA"],
  ["Secundaria",              "Corem",                                      12, "SECUNDARIA"],
  ["Secundaria",              "Centro de Estudios Mérida CEEMIH",           12, "SECUNDARIA"],
];

describe("derivarNivel — grafías reales de producción", () => {
  it.each(REALES)(
    "«%s» (%s, %i años) → %s",
    (grado, escuela, edad, esperado) => {
      expect(derivarNivel(grado, escuela, edad)).toBe(esperado);
    },
  );

  it("no pierde a nadie: toda grafía real cae en un nivel conocido", () => {
    // Las gráficas agrupan por nivel; si alguna cadena devolviera algo fuera de
    // la unión, ese niño saldría en una barra sin etiqueta.
    const NIVELES: Nivel[] = [
      "PREESCOLAR",
      "PRIMARIA",
      "SECUNDARIA",
      "MEDIA_SUPERIOR",
      "UNIVERSIDAD",
      "SIN_ESCUELA",
    ];
    for (const [grado, escuela, edad] of REALES) {
      expect(NIVELES).toContain(derivarNivel(grado, escuela, edad));
    }
  });
});

describe("derivarNivel — grafías nuevas que antes no existían", () => {
  it.each([
    ["Universidad",      "UADY",                        18, "UNIVERSIDAD"],
    ["universidad",      "",                            18, "UNIVERSIDAD"],
    ["1er semestre",     "Universidad Modelo",          18, "UNIVERSIDAD"],
    ["Licenciatura",     "",                            18, "UNIVERSIDAD"],
    ["No estudia",       "",                            10, "SIN_ESCUELA"],
    ["no estudia",       "Sin escuela",                 15, "SIN_ESCUELA"],
    ["1° secundaria",    "",                            12, "SECUNDARIA"],
    ["3° preparatoria",  "",                            17, "MEDIA_SUPERIOR"],
    ["2° preescolar",    "",                            4,  "PREESCOLAR"],
  ] as const)("«%s» (%s, %i años) → %s", (grado, escuela, edad, esperado) => {
    expect(derivarNivel(grado, escuela, edad)).toBe(esperado);
  });
});
