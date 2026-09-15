import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// El nivel escolar se deriva también al capturar a mano.
//
// Defecto encontrado al probar contra la base local: `crearParticipante` nunca
// escribía `nivel`, así que TODO niño registrado desde el formulario quedaba en
// null y aparecía como "Sin especificar" en las gráficas por nivel. Solo los
// importados desde Excel tenían nivel, porque el importador sí lo deriva.
//
// Con el formulario ofreciendo secundaria, preparatoria y universidad eso deja
// de ser un detalle: los niveles nuevos no aparecerían en ninguna gráfica.
// Aquí se usa la MISMA función que el importador, para que los dos caminos
// dejen el dato homologado.
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    participante: {
      findUnique: vi.fn(),
      create:     vi.fn(),
      update:     vi.fn(),
    },
  },
}));

describe("crearParticipante — deriva el nivel", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    ["4° primaria",     "Primaria Emma Godoy", 9,  "PRIMARIA"],
    ["2° secundaria",   "Secundaria Técnica",  13, "SECUNDARIA"],
    ["3° preescolar",   "Chak Pepen",          5,  "PREESCOLAR"],
    ["1° preparatoria", "CECYTEY",             16, "MEDIA_SUPERIOR"],
    ["Universidad",     "UADY",                18, "UNIVERSIDAD"],
    ["No estudia",      "Sin escuela",         10, "SIN_ESCUELA"],
  ])("«%s» se guarda con nivel %s", async (grado, escuela, edad, nivel) => {
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.participante.create).mockResolvedValueOnce({ id: "p1" } as never);

    const { crearParticipante } = await import("@/server/queries/participantes");
    await crearParticipante({
      nombre: "Ana",
      apellidos: "López",
      edad: edad as number,
      escuela: escuela as string,
      grado: grado as string,
    });

    expect(prisma.participante.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ nivel }),
      }),
    );
  });
});

describe("editarParticipante — recalcula el nivel cuando cambia la escolaridad", () => {
  beforeEach(() => vi.clearAllMocks());

  it("corregir el grado a secundaria mueve al niño de nivel", async () => {
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.participante.findUnique).mockResolvedValueOnce({
      id: "p1", grado: "6° primaria", escuela: "Primaria Sor Juana", edad: 11,
      nivel: "PRIMARIA",
    } as never);
    vi.mocked(prisma.participante.update).mockResolvedValueOnce({ id: "p1" } as never);

    const { editarParticipante } = await import("@/server/queries/participantes");
    await editarParticipante("p1", { grado: "1° secundaria", edad: 12 });

    expect(prisma.participante.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { grado: "1° secundaria", edad: 12, nivel: "SECUNDARIA" },
    });
  });

  it("corregir una falta de ortografía en el nombre NO toca el nivel", async () => {
    // Hay fichas cuyo nivel vino explícito en el Excel del organizador. Una
    // corrección que no cambia escolaridad no tiene por qué recalcularlo.
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.participante.findUnique).mockResolvedValueOnce({
      id: "p1", grado: "2° año", escuela: "Esc. Sec. #26", edad: 14,
      nivel: "SECUNDARIA",
    } as never);
    vi.mocked(prisma.participante.update).mockResolvedValueOnce({ id: "p1" } as never);

    const { editarParticipante } = await import("@/server/queries/participantes");
    await editarParticipante("p1", { nombre: "Ana" });

    expect(prisma.participante.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { nombre: "Ana" },
    });
  });
});
