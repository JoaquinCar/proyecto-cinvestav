import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Alta de un participante nuevo desde el formulario de registro.
//
// POST /api/participantes responde con el sobre { participante: {...} }.
// Si el cliente no lo desenvuelve, el id llega undefined a POST /api/inscripciones
// y el niño queda creado pero SIN inscripción a la edición (huérfano).
// ─────────────────────────────────────────────────────────────────────────────

const datosNuevo = {
  nombre: "Carlos",
  apellidos: "Sánchez",
  edad: 9,
  escuela: "Primaria Mérida",
  grado: "3° primaria",
} as const;

describe("crearParticipante (cliente) — desenvuelve la respuesta del API", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it("devuelve el participante con su id a partir de { participante }", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          { participante: { id: "p_new", ...datosNuevo } },
          { status: 201 },
        ),
      ),
    );

    const { crearParticipante } = await import("@/lib/api/participantes");
    const participante = await crearParticipante(datosNuevo);

    expect(participante.id).toBe("p_new");
    expect(participante.nombre).toBe("Carlos");
  });

  it("propaga el mensaje de error del API cuando falla", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ error: "Permiso insuficiente" }, { status: 403 }),
      ),
    );

    const { crearParticipante } = await import("@/lib/api/participantes");
    await expect(crearParticipante(datosNuevo)).rejects.toThrow(
      /permiso insuficiente/i,
    );
  });
});

describe("crearInscripcion (cliente)", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it("envía participanteId y edicionId al endpoint de inscripciones", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ inscripcion: { id: "i1" } }, { status: 201 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { crearInscripcion } = await import("@/lib/api/participantes");
    await crearInscripcion("p_new", "edicion-2027");

    const [url, init] = fetchMock.mock.calls[0]! as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("/api/inscripciones");
    expect(JSON.parse(init.body as string)).toEqual({
      participanteId: "p_new",
      edicionId: "edicion-2027",
    });
  });

  it("propaga el 409 de participante ya inscrito", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          { error: "El participante ya está inscrito en esta edición" },
          { status: 409 },
        ),
      ),
    );

    const { crearInscripcion } = await import("@/lib/api/participantes");
    await expect(crearInscripcion("p1", "edicion-2027")).rejects.toThrow(
      /ya está inscrito/i,
    );
  });
});
