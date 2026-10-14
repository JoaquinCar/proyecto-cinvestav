import { describe, it, expect } from "vitest";
import type { ReactElement } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Un diálogo nunca puede ser más alto que la ventana.
//
// Regresión del reporte de QA: al registrar un participante y desplegar el
// apartado de acompañante, el diálogo crecía de 664 px a 972 px en una ventana
// de 800 px. Como un diálogo modal bloquea el scroll de la página mientras
// está abierto (Base UI pone `overflow: hidden` en el <body>) y el diálogo no
// tenía scroll propio, lo que sobraba quedaba FUERA de la pantalla: el botón
// «Registrar participante» a y=821 y la «X» de cerrar a y=-77, sin nada que
// rodar en ningún sitio. La pantalla se veía congelada.
//
// El arreglo va en la primitiva, no en el formulario: así ningún diálogo
// futuro puede volver a encerrar a quien lo abre. El equivalente en móvil
// (BottomSheet) ya lo hacía bien desde el principio con max-h-[92dvh] y un
// contenedor con overflow-y-auto.
// ─────────────────────────────────────────────────────────────────────────────

/** Busca en el árbol el primer elemento con un `data-slot` dado. */
function buscarPorSlot(nodo: unknown, slot: string): ReactElement | null {
  if (!nodo || typeof nodo !== "object") return null;
  if (Array.isArray(nodo)) {
    for (const hijo of nodo) {
      const encontrado = buscarPorSlot(hijo, slot);
      if (encontrado) return encontrado;
    }
    return null;
  }
  const el = nodo as ReactElement<{
    "data-slot"?: string;
    children?: unknown;
  }>;
  if (el.props?.["data-slot"] === slot) return el;
  return el.props?.children ? buscarPorSlot(el.props.children, slot) : null;
}

/** Las clases que acaba llevando el popup del diálogo. */
async function clasesDelPopup(className?: string): Promise<string> {
  const { DialogContent } = await import("@/components/ui/dialog");
  const arbol = DialogContent({ className, children: null });
  const popup = buscarPorSlot(arbol, "dialog-content");
  expect(popup, "DialogContent debe renderizar el popup").not.toBeNull();
  return (popup!.props as { className?: string }).className ?? "";
}

describe("DialogContent — el diálogo no puede desbordar la ventana", () => {
  it("acota su alto a la ventana", async () => {
    const clases = await clasesDelPopup();

    const alto = clases.match(/(?:^|\s)max-h-\[([^\]]+)\]/);
    expect(
      alto,
      "el diálogo debe traer un alto máximo: sin él crece más que la pantalla " +
        "y el botón de guardar queda fuera, inalcanzable",
    ).not.toBeNull();

    // Un tope en píxeles fijos no sirve: en un portátil de 620 px de alto el
    // diálogo del alta ya mide 662 px sin tocar nada.
    expect(
      alto![1],
      "el tope debe ir en unidades de ventana (dvh/vh), no en píxeles fijos",
    ).toMatch(/d?vh/);
  });

  it("se puede rodar por dentro cuando el contenido no cabe", async () => {
    const clases = await clasesDelPopup();
    expect(
      clases,
      "acotar el alto sin dar scroll propio solo cambia un encierro por otro: " +
        "el contenido sobrante quedaría recortado",
    ).toMatch(/(?:^|\s)overflow-y-auto(?:\s|$)/);
  });

  it("conserva el tope con las clases que le pasa el alta de participante", async () => {
    // Exactamente lo que pasa DrawerRegistro en escritorio. tailwind-merge
    // podría tragarse el tope si alguien añadiera ahí otra clase de alto.
    const clases = await clasesDelPopup(
      "sm:max-w-lg bg-card border border-border",
    );
    expect(clases).toMatch(/(?:^|\s)max-h-\[[^\]]*d?vh[^\]]*\]/);
    expect(clases).toMatch(/(?:^|\s)overflow-y-auto(?:\s|$)/);
  });
});
