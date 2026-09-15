import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Acompañantes: el adulto (o el grupo) con el que llega el niño.
//
// Se liga a la INSCRIPCIÓN, no al participante: un niño puede venir con su mamá
// en 2026 y con su abuela en 2027, y cada año tiene que quedar registrado quién
// lo acompañó.
//
// Lo que estas pruebas protegen es la reutilización: al inscribir al segundo
// hermano se manda el id del acompañante que ya existe y NO se crea otra ficha.
// Si se creara una por niño, la función no serviría para nada.
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("next-auth", () => ({
  default: vi.fn(() => ({
    handlers: { GET: vi.fn(), POST: vi.fn() },
    auth:     vi.fn(),
    signIn:   vi.fn(),
    signOut:  vi.fn(),
  })),
}));

vi.mock("@auth/prisma-adapter", () => ({
  PrismaAdapter: vi.fn(() => ({})),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    acompanante: {
      findMany:   vi.fn(),
      findUnique: vi.fn(),
      create:     vi.fn(),
    },
    participante: {
      findUnique: vi.fn(),
    },
    inscripcion: {
      findUnique: vi.fn(),
      create:     vi.fn(),
      update:     vi.fn(),
    },
    edicion: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(
  method: string,
  path: string,
  body?: unknown,
  params?: Record<string, string>,
): Request {
  const url = new URL(`http://localhost${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }
  return new Request(url.toString(), {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

async function mockSesion(role: "ADMIN" | "BECARIO" | "READONLY" | null) {
  const { auth } = await import("@/lib/auth");
  vi.mocked(auth).mockResolvedValueOnce(
    role === null
      ? (null as never)
      : ({
          user: {
            id: "u1",
            role,
            email: `${role.toLowerCase()}@cinvestav.mx`,
            name: null,
            image: null,
          },
          expires: "",
        } as never),
  );
}

const ACOMPANANTE = {
  id:         "a1",
  nombre:     "Laura",
  apellidos:  "Pérez",
  telefono:   "9991234567",
  correo:     "laura@example.com",
  parentesco: "MADRE",
  createdAt:  new Date(),
  updatedAt:  new Date(),
};

// ── GET /api/acompanantes — buscador para reutilizar ─────────────────────────

describe("GET /api/acompanantes — buscador", () => {
  beforeEach(() => vi.clearAllMocks());

  it("responde 401 sin sesión", async () => {
    await mockSesion(null);
    const { GET } = await import("@/app/api/acompanantes/route");
    const res = await GET(makeRequest("GET", "/api/acompanantes") as never);
    expect(res.status).toBe(401);
  });

  it("responde 403 a READONLY: el buscador expone el contacto del adulto", async () => {
    await mockSesion("READONLY");
    const { GET } = await import("@/app/api/acompanantes/route");
    const res = await GET(makeRequest("GET", "/api/acompanantes") as never);
    expect(res.status).toBe(403);
  });

  it("responde 200 con los acompañantes y cuántos niños acompañan", async () => {
    await mockSesion("BECARIO");
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.acompanante.findMany).mockResolvedValueOnce([
      { ...ACOMPANANTE, _count: { inscripciones: 2 } },
    ] as never);

    const { GET } = await import("@/app/api/acompanantes/route");
    const res = await GET(
      makeRequest("GET", "/api/acompanantes", undefined, { q: "Laura" }) as never,
    );
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.acompanantes).toHaveLength(1);
    expect(json.acompanantes[0].nombre).toBe("Laura");
  });
});

// ── GET /api/acompanantes/[id] — a quién acompaña ────────────────────────────

describe("GET /api/acompanantes/[id] — ficha", () => {
  beforeEach(() => vi.clearAllMocks());

  it("responde 401 sin sesión", async () => {
    await mockSesion(null);
    const { GET } = await import("@/app/api/acompanantes/[id]/route");
    const res = await GET(makeRequest("GET", "/api/acompanantes/a1") as never, {
      params: Promise.resolve({ id: "a1" }),
    });
    expect(res.status).toBe(401);
  });

  it("responde 404 cuando no existe", async () => {
    await mockSesion("ADMIN");
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.acompanante.findUnique).mockResolvedValueOnce(null);

    const { GET } = await import("@/app/api/acompanantes/[id]/route");
    const res = await GET(makeRequest("GET", "/api/acompanantes/nope") as never, {
      params: Promise.resolve({ id: "nope" }),
    });
    expect(res.status).toBe(404);
  });

  it("READONLY consulta la ficha pero sin el teléfono ni el correo del adulto", async () => {
    await mockSesion("READONLY");
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.acompanante.findUnique).mockResolvedValueOnce({
      ...ACOMPANANTE,
      inscripciones: [],
    } as never);

    const { GET } = await import("@/app/api/acompanantes/[id]/route");
    const res = await GET(makeRequest("GET", "/api/acompanantes/a1") as never, {
      params: Promise.resolve({ id: "a1" }),
    });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.acompanante.nombre).toBe("Laura");
    expect(json.acompanante.telefono).toBeNull();
    expect(json.acompanante.correo).toBeNull();
  });

  it("ADMIN sí ve el contacto", async () => {
    await mockSesion("ADMIN");
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.acompanante.findUnique).mockResolvedValueOnce({
      ...ACOMPANANTE,
      inscripciones: [],
    } as never);

    const { GET } = await import("@/app/api/acompanantes/[id]/route");
    const res = await GET(makeRequest("GET", "/api/acompanantes/a1") as never, {
      params: Promise.resolve({ id: "a1" }),
    });
    const json = await res.json();
    expect(json.acompanante.telefono).toBe("9991234567");
  });
});

// ── PUT /api/inscripciones/[id]/acompanante — asignar / cambiar ──────────────

describe("PUT /api/inscripciones/[id]/acompanante", () => {
  beforeEach(() => vi.clearAllMocks());

  it("responde 401 sin sesión", async () => {
    await mockSesion(null);
    const { PUT } = await import("@/app/api/inscripciones/[id]/acompanante/route");
    const res = await PUT(
      makeRequest("PUT", "/api/inscripciones/i1/acompanante", {
        acompananteId: "a1",
      }) as never,
      { params: Promise.resolve({ id: "i1" }) },
    );
    expect(res.status).toBe(401);
  });

  it("responde 403 a READONLY", async () => {
    await mockSesion("READONLY");
    const { PUT } = await import("@/app/api/inscripciones/[id]/acompanante/route");
    const res = await PUT(
      makeRequest("PUT", "/api/inscripciones/i1/acompanante", {
        acompananteId: "a1",
      }) as never,
      { params: Promise.resolve({ id: "i1" }) },
    );
    expect(res.status).toBe(403);
  });

  it("responde 422 si no se dice a quién ligar", async () => {
    await mockSesion("BECARIO");
    const { PUT } = await import("@/app/api/inscripciones/[id]/acompanante/route");
    const res = await PUT(
      makeRequest("PUT", "/api/inscripciones/i1/acompanante", {}) as never,
      { params: Promise.resolve({ id: "i1" }) },
    );
    expect(res.status).toBe(422);
  });

  it("REUTILIZA: con acompananteId no crea otra ficha de acompañante", async () => {
    await mockSesion("BECARIO");
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.inscripcion.findUnique).mockResolvedValueOnce({
      id: "i2",
    } as never);
    vi.mocked(prisma.acompanante.findUnique).mockResolvedValueOnce(
      ACOMPANANTE as never,
    );
    vi.mocked(prisma.inscripcion.update).mockResolvedValueOnce({
      id: "i2",
      acompananteId: "a1",
      acompanante: ACOMPANANTE,
    } as never);

    const { PUT } = await import("@/app/api/inscripciones/[id]/acompanante/route");
    const res = await PUT(
      makeRequest("PUT", "/api/inscripciones/i2/acompanante", {
        acompananteId: "a1",
      }) as never,
      { params: Promise.resolve({ id: "i2" }) },
    );

    expect(res.status).toBe(200);
    // Lo que importa: NO se creó un acompañante duplicado para el hermano.
    expect(prisma.acompanante.create).not.toHaveBeenCalled();
    expect(prisma.inscripcion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "i2" },
        data:  { acompananteId: "a1" },
      }),
    );
  });

  it("responde 404 cuando el acompañante elegido ya no existe", async () => {
    await mockSesion("ADMIN");
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.inscripcion.findUnique).mockResolvedValueOnce({
      id: "i1",
    } as never);
    vi.mocked(prisma.acompanante.findUnique).mockResolvedValueOnce(null);

    const { PUT } = await import("@/app/api/inscripciones/[id]/acompanante/route");
    const res = await PUT(
      makeRequest("PUT", "/api/inscripciones/i1/acompanante", {
        acompananteId: "borrado",
      }) as never,
      { params: Promise.resolve({ id: "i1" }) },
    );
    expect(res.status).toBe(404);
    expect(prisma.inscripcion.update).not.toHaveBeenCalled();
  });

  it("CREA uno nuevo cuando se mandan sus datos y lo liga a la inscripción", async () => {
    await mockSesion("ADMIN");
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.inscripcion.findUnique).mockResolvedValueOnce({
      id: "i1",
    } as never);
    vi.mocked(prisma.acompanante.create).mockResolvedValueOnce(
      ACOMPANANTE as never,
    );
    vi.mocked(prisma.inscripcion.update).mockResolvedValueOnce({
      id: "i1",
      acompananteId: "a1",
      acompanante: ACOMPANANTE,
    } as never);

    const { PUT } = await import("@/app/api/inscripciones/[id]/acompanante/route");
    const res = await PUT(
      makeRequest("PUT", "/api/inscripciones/i1/acompanante", {
        acompanante: {
          nombre: "Laura",
          apellidos: "Pérez",
          telefono: "9991234567",
          parentesco: "MADRE",
        },
      }) as never,
      { params: Promise.resolve({ id: "i1" }) },
    );

    expect(res.status).toBe(200);
    expect(prisma.acompanante.create).toHaveBeenCalledOnce();

    const json = await res.json();
    expect(json.inscripcion.acompanante.id).toBe("a1");
  });

  it("responde 404 cuando la inscripción no existe", async () => {
    await mockSesion("ADMIN");
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.inscripcion.findUnique).mockResolvedValueOnce(null);

    const { PUT } = await import("@/app/api/inscripciones/[id]/acompanante/route");
    const res = await PUT(
      makeRequest("PUT", "/api/inscripciones/nope/acompanante", {
        acompananteId: "a1",
      }) as never,
      { params: Promise.resolve({ id: "nope" }) },
    );
    expect(res.status).toBe(404);
  });
});

// ── DELETE /api/inscripciones/[id]/acompanante — quitar ──────────────────────

describe("DELETE /api/inscripciones/[id]/acompanante", () => {
  beforeEach(() => vi.clearAllMocks());

  it("responde 403 a READONLY", async () => {
    await mockSesion("READONLY");
    const { DELETE } = await import("@/app/api/inscripciones/[id]/acompanante/route");
    const res = await DELETE(
      makeRequest("DELETE", "/api/inscripciones/i1/acompanante") as never,
      { params: Promise.resolve({ id: "i1" }) },
    );
    expect(res.status).toBe(403);
  });

  it("quita el acompañante de la inscripción sin borrar su ficha", async () => {
    await mockSesion("BECARIO");
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.inscripcion.findUnique).mockResolvedValueOnce({
      id: "i1",
    } as never);
    vi.mocked(prisma.inscripcion.update).mockResolvedValueOnce({
      id: "i1",
      acompananteId: null,
    } as never);

    const { DELETE } = await import("@/app/api/inscripciones/[id]/acompanante/route");
    const res = await DELETE(
      makeRequest("DELETE", "/api/inscripciones/i1/acompanante") as never,
      { params: Promise.resolve({ id: "i1" }) },
    );

    expect(res.status).toBe(204);
    expect(prisma.inscripcion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "i1" },
        data:  { acompananteId: null },
      }),
    );
  });
});

// ── POST /api/inscripciones con acompañante ──────────────────────────────────
// El registro de un niño nuevo son dos pasos (ficha + inscripción). El
// acompañante viaja en el segundo para no añadir un tercero.

describe("POST /api/inscripciones — acompañante opcional", () => {
  beforeEach(() => vi.clearAllMocks());

  async function prepararInscripcionValida() {
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.edicion.findUnique).mockResolvedValueOnce({
      id: "e1", activa: true, nombre: "Edición 2026",
    } as never);
    vi.mocked(prisma.participante.findUnique).mockResolvedValueOnce({
      id: "p1",
    } as never);
    return prisma;
  }

  it("inscribe sin acompañante: el campo es opcional y no estorba", async () => {
    await mockSesion("BECARIO");
    const prisma = await prepararInscripcionValida();
    vi.mocked(prisma.inscripcion.create).mockResolvedValueOnce({
      id: "i1", acompananteId: null,
    } as never);

    const { POST } = await import("@/app/api/inscripciones/route");
    const res = await POST(
      makeRequest("POST", "/api/inscripciones", {
        participanteId: "p1",
        edicionId:      "e1",
      }) as never,
    );

    expect(res.status).toBe(201);
    expect(prisma.acompanante.create).not.toHaveBeenCalled();
  });

  it("inscribe al segundo hermano reutilizando el acompañante ya creado", async () => {
    await mockSesion("BECARIO");
    const prisma = await prepararInscripcionValida();
    vi.mocked(prisma.acompanante.findUnique).mockResolvedValueOnce(
      ACOMPANANTE as never,
    );
    vi.mocked(prisma.inscripcion.create).mockResolvedValueOnce({
      id: "i2", acompananteId: "a1", acompanante: ACOMPANANTE,
    } as never);

    const { POST } = await import("@/app/api/inscripciones/route");
    const res = await POST(
      makeRequest("POST", "/api/inscripciones", {
        participanteId: "p2",
        edicionId:      "e1",
        acompananteId:  "a1",
      }) as never,
    );

    expect(res.status).toBe(201);
    expect(prisma.acompanante.create).not.toHaveBeenCalled();
    expect(prisma.inscripcion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ acompananteId: "a1" }),
      }),
    );
  });

  it("crea el acompañante junto con la inscripción del primer hermano", async () => {
    await mockSesion("ADMIN");
    const prisma = await prepararInscripcionValida();
    vi.mocked(prisma.acompanante.create).mockResolvedValueOnce(
      ACOMPANANTE as never,
    );
    vi.mocked(prisma.inscripcion.create).mockResolvedValueOnce({
      id: "i1", acompananteId: "a1", acompanante: ACOMPANANTE,
    } as never);

    const { POST } = await import("@/app/api/inscripciones/route");
    const res = await POST(
      makeRequest("POST", "/api/inscripciones", {
        participanteId: "p1",
        edicionId:      "e1",
        acompanante: { nombre: "Laura", apellidos: "Pérez", parentesco: "MADRE" },
      }) as never,
    );

    expect(res.status).toBe(201);
    expect(prisma.acompanante.create).toHaveBeenCalledOnce();
  });

  it("responde 422 si el acompañante llega sin nombre", async () => {
    await mockSesion("ADMIN");
    const { POST } = await import("@/app/api/inscripciones/route");
    const res = await POST(
      makeRequest("POST", "/api/inscripciones", {
        participanteId: "p1",
        edicionId:      "e1",
        acompanante: { nombre: "  ", parentesco: "MADRE" },
      }) as never,
    );
    expect(res.status).toBe(422);
  });
});
