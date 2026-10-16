import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// ─────────────────────────────────────────────────────────────────────────────
// TODO LO QUE ESCRIBE, REFRESCA.
//
// ── El defecto ──────────────────────────────────────────────────────────────
// Se pasaba lista, se guardaba bien en la base, y al volver al panel de
// asistencia el contador seguía enseñando el número de antes. Comprobado en un
// navegador real contra la base de QA: tras guardar cinco marcas nuevas, la
// vuelta al panel seguía diciendo 7 y solo un F5 enseñaba el 12 bueno.
//
// La causa NO es el servidor: una petición limpia con curl ya devolvía el dato
// nuevo. Es la Router Cache del cliente de Next, que vive en el navegador y
// sirve la carga del panel que ya se había visto. Por eso `revalidatePath` en
// la ruta de API no arreglaba nada —purga cachés del servidor, que aquí no
// tenían nada viejo que purgar— y `router.refresh()` sí: es lo único que
// invalida la caché del cliente y vuelve a pedir el árbol de servidor.
//
// ── El patrón ───────────────────────────────────────────────────────────────
// Un solo patrón, el que ya usaba el resto del proyecto en 21 sitios: el
// componente de cliente que lanza la escritura llama a `router.refresh()`
// cuando el servidor confirma. La asistencia era la excepción, no la regla.
//
// ── Qué hace esta prueba ────────────────────────────────────────────────────
// Barre los componentes de cliente de src/ y, para cada uno que escriba
// —`fetch` con método que muta, o una de las ayudas de `@/lib/api/*` que
// escriben—, exige que llame a `router.refresh()`. No comprueba que se llame
// en el momento correcto (eso es la prueba a mano en el navegador): comprueba
// que nadie vuelva a escribir sin refrescar, que es como nació el fallo.
//
// Si un componente nuevo escribe y de verdad no tiene nada que refrescar
// —porque navega con `router.push()` a otra página, que ya trae datos
// frescos— se añade a EXENTOS con el motivo. La lista corta es la gracia.
// ─────────────────────────────────────────────────────────────────────────────

const RAIZ = join(__dirname, "..", "..", "..", "src");

/** Las ayudas de `@/lib/api/*` que ESCRIBEN. Buscar/listar no cuenta. */
const AYUDAS_QUE_ESCRIBEN = [
  "asignarAcompanante",
  "quitarAcompanante",
  "eliminarClase",
  "cambiarExclusionConstancia",
  "generarConstancia",
  "reordenarImagenes",
  "crearParticipante",
  "crearInscripcion",
  "editarParticipante",
  "eliminarParticipante",
  "darDeBajaInscripcion",
  "asignarStaff",
  "quitarStaff",
];

/**
 * Componentes que escriben y no refrescan por un motivo explícito.
 * Todo lo que entre aquí lleva su razón escrita al lado.
 *
 * Está vacía a propósito, y esa es la gracia: la regla es «quien escribe,
 * refresca», sin delegar en quien monta el componente. Delegar fue lo que
 * dejó el alta de participantes sin refrescar —el formulario avisaba con
 * `onSuccess` y el cajón que lo abría solo se cerraba—, y la lista del
 * servidor se quedaba sin el niño recién inscrito.
 */
const EXENTOS: Record<string, string> = {};

function archivosFuente(dir: string, acc: string[] = []): string[] {
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) archivosFuente(ruta, acc);
    else if (/\.tsx$/.test(entrada)) acc.push(ruta);
  }
  return acc;
}

const MUTA = /method:\s*["'](POST|PUT|PATCH|DELETE)["']/;

/** Los componentes de cliente que escriben algo. */
function componentesQueEscriben(): string[] {
  return archivosFuente(RAIZ)
    .filter((ruta) => {
      const fuente = readFileSync(ruta, "utf8");
      if (!/^\s*["']use client["']/m.test(fuente)) return false;
      if (MUTA.test(fuente)) return true;
      // ¿Importa alguna ayuda de @/lib/api que escriba?
      const importaApi = /from\s+["']@\/lib\/api\/[^"']+["']/.test(fuente);
      return (
        importaApi &&
        AYUDAS_QUE_ESCRIBEN.some((f) => new RegExp(`\\b${f}\\b`).test(fuente))
      );
    })
    .map((ruta) => relative(RAIZ, ruta).split(/[\\/]/).join("/"));
}

describe("revalidación — lo que escribe, refresca", () => {
  it("todo componente de cliente que escribe llama a router.refresh()", () => {
    const sinRefrescar = componentesQueEscriben().filter((rel) => {
      if (rel in EXENTOS) return false;
      const fuente = readFileSync(join(RAIZ, rel), "utf8");
      return !/router\.refresh\(\)/.test(fuente);
    });

    expect(
      sinRefrescar,
      "estos componentes guardan en la base y dejan la pantalla con el dato " +
        "viejo: la Router Cache del cliente sirve lo que ya se había visto. " +
        "Añade router.refresh() cuando el servidor confirme, o apúntalo en " +
        "EXENTOS con el motivo",
    ).toEqual([]);
  });

  it("la pantalla de pasar lista refresca tras guardar", () => {
    // El caso que lo originó, fijado aparte para que no se diluya en el barrido.
    const fuente = readFileSync(
      join(RAIZ, "components/asistencia/ListaAsistencia.tsx"),
      "utf8",
    );
    expect(fuente).toMatch(/useRouter/);
    expect(fuente).toMatch(/router\.refresh\(\)/);
  });

  it("el barrido encuentra componentes (no se quedó mirando una carpeta vacía)", () => {
    // Si un refactor mueve src/ o cambia la convención, el barrido devolvería
    // cero y las otras dos pruebas pasarían sin comprobar nada.
    expect(componentesQueEscriben().length).toBeGreaterThan(8);
  });
});
