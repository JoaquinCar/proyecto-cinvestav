import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Etiqueta del contacto colectivo ("Grupo Zarigüeyas").
//
// Defecto original: se etiquetaba al contacto MÁS numeroso de cualquier edición
// con 5 o más registros. En una edición nueva —donde ese contacto no existe—
// el reporte inventaba un grupo que no está.
//
// Regla correcta: la etiqueta se aplica solo al contacto configurado en el
// entorno (CONTACTO_GRUPO). Sin configuración, nadie lleva etiqueta.
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    inscripcion: { findMany: vi.fn() },
    sesion: { findMany: vi.fn() },
  },
}));

function participante(nombre: string, telefono: string) {
  return {
    participante: {
      edad: 9,
      genero: "FEMENINO",
      nivel: "PRIMARIA",
      escuela: "Primaria Centro",
      telefono,
      correo: null,
      nombre,
      apellidos: "Pérez",
    },
  };
}

/** Seis niños con el mismo teléfono + dos familias sueltas. */
function inscripcionesDeGrupo(telGrupo: string) {
  return [
    ...["Ana", "Bea", "Caro", "Dana", "Eva", "Fer"].map((n) =>
      participante(n, telGrupo),
    ),
    participante("Gina", "9990000001"),
    participante("Hilda", "9990000002"),
  ];
}

const ENV_ORIGINAL = { ...process.env };

describe("obtenerAnalisisProfundo — etiqueta de contacto colectivo", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => {
    process.env = { ...ENV_ORIGINAL };
    vi.resetModules();
  });

  it("no inventa un grupo cuando no hay contacto configurado", async () => {
    delete process.env.CONTACTO_GRUPO;
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.inscripcion.findMany).mockResolvedValue(
      inscripcionesDeGrupo("9995550000") as never,
    );
    vi.mocked(prisma.sesion.findMany).mockResolvedValue([] as never);

    const { obtenerAnalisisProfundo } = await import(
      "@/server/queries/estadisticas"
    );
    const a = await obtenerAnalisisProfundo("ed-2027");

    expect(a.registrosPorContacto[0].cantidad).toBe(6);
    expect(a.registrosPorContacto.every((c) => c.label === null)).toBe(true);
  });

  it("etiqueta únicamente al contacto configurado", async () => {
    process.env.CONTACTO_GRUPO = "9995550000";
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.inscripcion.findMany).mockResolvedValue(
      inscripcionesDeGrupo("9995550000") as never,
    );
    vi.mocked(prisma.sesion.findMany).mockResolvedValue([] as never);

    const { obtenerAnalisisProfundo } = await import(
      "@/server/queries/estadisticas"
    );
    const a = await obtenerAnalisisProfundo("ed-2026");

    expect(a.registrosPorContacto[0].label).toBe("Grupo Zarigüeyas");
    expect(a.registrosPorContacto.filter((c) => c.label !== null)).toHaveLength(
      1,
    );
  });

  it("nunca etiqueta el cajón 'Sin contacto'", async () => {
    // No es un contacto: es el grupo de los registros sin teléfono ni correo,
    // y aparece en todas las ediciones. Era justo el que se llevaba la etiqueta.
    process.env.CONTACTO_GRUPO = "Sin contacto";
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.inscripcion.findMany).mockResolvedValue(
      ["Ana", "Bea", "Caro", "Dana", "Eva", "Fer"].map((n) =>
        participante(n, ""),
      ) as never,
    );
    vi.mocked(prisma.sesion.findMany).mockResolvedValue([] as never);

    const { obtenerAnalisisProfundo } = await import(
      "@/server/queries/estadisticas"
    );
    const a = await obtenerAnalisisProfundo("ed-2027");

    expect(a.registrosPorContacto[0].contacto).toBe("Sin contacto");
    expect(a.registrosPorContacto[0].label).toBeNull();
  });

  it("no etiqueta en una edición donde ese contacto no aparece", async () => {
    process.env.CONTACTO_GRUPO = "9995550000";
    const { prisma } = await import("@/lib/prisma");
    // Otra edición: mismo patrón de volumen, contacto distinto.
    vi.mocked(prisma.inscripcion.findMany).mockResolvedValue(
      inscripcionesDeGrupo("9991112222") as never,
    );
    vi.mocked(prisma.sesion.findMany).mockResolvedValue([] as never);

    const { obtenerAnalisisProfundo } = await import(
      "@/server/queries/estadisticas"
    );
    const a = await obtenerAnalisisProfundo("ed-2027");

    expect(a.registrosPorContacto.every((c) => c.label === null)).toBe(true);
  });
});
