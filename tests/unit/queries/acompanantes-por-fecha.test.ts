import { describe, it, expect } from "vitest";
import {
  asistenciaDeSesion,
  type SesionConAsistencia,
} from "@/server/queries/asistencia-de-sesion";

// ─────────────────────────────────────────────────────────────────────────────
// ACOMPAÑANTES POR FECHA — cuántas mamás y cuántos papás fueron.
//
// El defecto: el tablero enseñaba «Acompañantes 0 · 0 mamás · 0 papás» en
// cuanto la asistencia se capturaba en la aplicación en vez de importarse del
// Excel. No era un error de cuenta: el dato NO EXISTÍA. Los únicos acompañantes
// que el sistema sabía contar eran los del `ResumenSesion`, que solo entra por
// el importador.
//
// Lo que se pidió es un conteo por fecha —dos números— que se captura al pasar
// lista. OJO: NO es la lista nominal de adultos. Esa ya existe
// (`Acompanante` ligado a la `Inscripcion`: con quién llega el niño ESE año) y
// es otra cosa; aquí no se toca.
//
// Dónde viven los dos números: en la propia `Sesion` (la «fecha» en pantalla),
// en `acompanantesMamas` / `acompanantesPapas`. NULLables a propósito: NULL es
// «nadie los contó» y 0 es «no vino ninguno», y son respuestas distintas.
// ─────────────────────────────────────────────────────────────────────────────

type Nino = { genero: "FEMENINO" | "MASCULINO" | null; edad: number; nivel: string | null };

const nina = (edad = 9): Nino => ({ genero: "FEMENINO", edad, nivel: "PRIMARIA" });
const nino = (edad = 10): Nino => ({ genero: "MASCULINO", edad, nivel: "PRIMARIA" });

/** Agregado tal como lo deja el importador del Excel del organizador. */
function agregadoExcel(over: Partial<NonNullable<SesionConAsistencia["resumen"]>> = {}) {
  return {
    ninas: 10,
    ninos: 12,
    total: 22,
    mamas: 0,
    papas: 0,
    preescolar: 0,
    primaria: 22,
    secundaria: 0,
    mediaSuperior: 0,
    porEdad: null,
    ...over,
  };
}

function fecha({
  resumen = null as SesionConAsistencia["resumen"],
  lista = [] as Nino[],
  acompanantesMamas = null as number | null,
  acompanantesPapas = null as number | null,
}): SesionConAsistencia {
  return {
    resumen,
    acompanantesMamas,
    acompanantesPapas,
    asistencias: lista.map((participante) => ({ inscripcion: { participante } })),
  };
}

describe("asistenciaDeSesion · acompañantes capturados en la aplicación", () => {
  it("cuenta las mamás y los papás que se capturaron al pasar lista", () => {
    const a = asistenciaDeSesion(
      fecha({ lista: [nina(), nino(), nina()], acompanantesMamas: 5, acompanantesPapas: 4 }),
    );

    expect(a).not.toBeNull();
    expect(a!.mamas).toBe(5);
    expect(a!.papas).toBe(4);
    // Los adultos NO entran en el total de asistentes: el total son los niños
    // de la lista, y mezclarlos inflaría el promedio de asistencia.
    expect(a!.total).toBe(3);
    expect(a!.origen).toBe("LISTA");
  });

  it("distingue «no vino ninguno» de «nadie los contó»", () => {
    const contados = asistenciaDeSesion(
      fecha({ lista: [nina()], acompanantesMamas: 0, acompanantesPapas: 0 }),
    );
    expect(contados!.mamas).toBe(0);
    expect(contados!.papas).toBe(0);

    const sinContar = asistenciaDeSesion(fecha({ lista: [nina()] }));
    expect(sinContar!.mamas).toBe(0);
    expect(sinContar!.papas).toBe(0);
  });

  it("no da por capturada una fecha en la que solo se contaron adultos", () => {
    // Apuntar que fueron cuatro mamás no es pasar lista: la tarjeta
    // «Asistencia capturada» seguiría mintiéndole al coordinador sobre el
    // trabajo que le falta.
    const a = asistenciaDeSesion(fecha({ acompanantesMamas: 4, acompanantesPapas: 5 }));
    expect(a).toBeNull();
  });

  it("deja intactos los números históricos del Excel", () => {
    // Las fechas ya importadas nacen con los dos campos nuevos en NULL: su
    // conteo de acompañantes tiene que seguir saliendo del agregado, igual que
    // antes del cambio.
    const a = asistenciaDeSesion(
      fecha({ resumen: agregadoExcel({ mamas: 18, papas: 7 }) }),
    );

    expect(a!.mamas).toBe(18);
    expect(a!.papas).toBe(7);
    expect(a!.total).toBe(22);
    expect(a!.origen).toBe("AGREGADA");
  });

  it("un 0 del Excel no silencia a los que alguien contó a mano", () => {
    // Casi todos los `ResumenSesion` traen mamas/papas en 0 porque la hoja del
    // organizador no siempre llevaba esas columnas, y 0 es el DEFAULT de la
    // columna. Ese 0 por omisión no puede tapar un 4 que alguien contó de pie
    // en la sesión.
    const a = asistenciaDeSesion(
      fecha({
        resumen: agregadoExcel({ mamas: 0, papas: 0 }),
        acompanantesMamas: 4,
        acompanantesPapas: 3,
      }),
    );

    expect(a!.mamas).toBe(4);
    expect(a!.papas).toBe(3);
    // Para los NIÑOS sigue mandando el agregado: el Excel ve también al
    // público que no está inscrito, y la lista de la aplicación no.
    expect(a!.total).toBe(22);
    expect(a!.origen).toBe("AGREGADA");
  });
});
