import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactElement } from "react";
import Link from "next/link";

// ─────────────────────────────────────────────────────────────────────────────
// «Editar participante» tiene que decir dónde está el acompañante.
//
// El apartado existe desde hace meses, pero vive en la FICHA del niño, dentro
// de la tarjeta de cada edición, porque el acompañante es de la inscripción y
// no del niño. Quien lo busca, sin embargo, entra por «Editar» —es el sitio
// obvio— y al no verlo concluye que no existe. Le pasó al coordinador.
//
// Mover el apartado no es opción: «Editar» es solo de ADMIN y toca campos que
// salen en la constancia, mientras que apuntar con quién vino el niño es
// trabajo del becario. Así que lo que se protege aquí es el letrero.
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/server/db", () => ({
  prisma: { participante: { findUnique: vi.fn() } },
}));
vi.mock("@/components/participantes/FormEditarParticipante", () => ({
  FormEditarParticipante: function FormEditarParticipanteMock() {
    return null;
  },
}));

const { auth } = await import("@/lib/auth");
const { prisma } = await import("@/server/db");
const { default: EditarParticipantePage } = await import(
  "@/app/(dashboard)/participantes/[id]/editar/page"
);

const PARTICIPANTE = {
  id:        "p-1",
  nombre:    "Ana",
  apellidos: "Gómez",
  edad:      9,
  escuela:   "Primaria Centro",
  grado:     "4° primaria",
  genero:    "FEMENINO" as const,
};

/** Concatena todo el texto suelto del árbol, ejecutando los componentes. */
function textoDe(nodo: unknown, profundidad = 0): string {
  if (nodo === null || nodo === undefined || profundidad > 40) return "";
  if (typeof nodo === "string") return nodo;
  if (typeof nodo === "number") return String(nodo);
  if (Array.isArray(nodo)) return nodo.map((n) => textoDe(n, profundidad + 1)).join("");
  if (typeof nodo !== "object") return "";
  const el = nodo as ReactElement<{ children?: unknown }>;
  if (typeof el.type === "function") {
    try {
      const render = el.type as (props: unknown) => unknown;
      return textoDe(render(el.props), profundidad + 1);
    } catch {
      return "";
    }
  }
  return textoDe(el.props?.children, profundidad + 1);
}

/** Todos los `<Link>` del árbol, con su destino y su texto. */
function enlaces(
  nodo: unknown,
  acc: { href: string; texto: string }[] = [],
  profundidad = 0,
): { href: string; texto: string }[] {
  if (!nodo || typeof nodo !== "object" || profundidad > 40) return acc;
  if (Array.isArray(nodo)) {
    for (const hijo of nodo) enlaces(hijo, acc, profundidad + 1);
    return acc;
  }
  const el = nodo as ReactElement<{ children?: unknown; href?: string }>;
  if (el.type === Link && typeof el.props?.href === "string") {
    acc.push({ href: el.props.href, texto: textoDe(el.props.children) });
  }
  if (typeof el.type === "function") {
    try {
      const render = el.type as (props: unknown) => unknown;
      enlaces(render(el.props), acc, profundidad + 1);
    } catch {
      // Componente de cliente: no estorba.
    }
    return acc;
  }
  enlaces(el.props?.children, acc, profundidad + 1);
  return acc;
}

async function renderizar() {
  vi.mocked(auth).mockResolvedValue({
    user: { id: "u-1", email: "admin@cinvestav.mx", role: "ADMIN", name: "Admin", image: null },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  vi.mocked(prisma.participante.findUnique).mockResolvedValue(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PARTICIPANTE as any,
  );
  return EditarParticipantePage({ params: Promise.resolve({ id: "p-1" }) });
}

describe("«Editar participante» dice dónde está el acompañante", () => {
  beforeEach(() => vi.clearAllMocks());

  it("menciona al acompañante, que no se edita en esta pantalla", async () => {
    const texto = textoDe(await renderizar()).toLowerCase();
    expect(texto).toContain("acompañante");
  });

  it("enlaza a la ficha del participante, que es donde sí se edita", async () => {
    // No basta con que haya un enlace al perfil: el botón «Volver a la ficha»
    // ya apunta ahí desde siempre y haría pasar esta prueba sin letrero
    // ninguno. Lo que se exige es un enlace que diga que ALLÍ se edita.
    const alPerfil = enlaces(await renderizar()).filter(
      (e) => e.href === "/participantes/p-1",
    );
    expect(alPerfil.length).toBeGreaterThan(1);
    expect(
      alPerfil.some((e) => /pone|cambia|quita/i.test(e.texto)),
    ).toBe(true);
  });

  it("explica POR QUÉ no está aquí, no solo que no está", async () => {
    // Sin el motivo (es de la edición, no del niño) el letrero parece una
    // disculpa por una pantalla incompleta en vez de una decisión.
    const texto = textoDe(await renderizar()).toLowerCase();
    expect(texto).toContain("edición");
  });
});
