import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks de infraestructura ──────────────────────────────────────────────────
// Se declaran ANTES de cualquier import del módulo bajo prueba.

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

// Mock de Prisma — sustituye @/server/db que re-exporta @/lib/prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    participante: {
      findMany:   vi.fn(),
      findUnique: vi.fn(),
      create:     vi.fn(),
    },
    inscripcion: {
      findUnique: vi.fn(),
      create:     vi.fn(),
      delete:     vi.fn(),
    },
    edicion: {
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

// Mock de next-auth para las rutas: controla qué devuelve auth()
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(
  method: string,
  path: string,
  body?: unknown,
  params?: Record<string, string>,
): Request {
  const url = new URL(`http://localhost${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }
  return new Request(url.toString(), {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

// ── GET /api/participantes — autenticación ────────────────────────────────────

describe("GET /api/participantes — autenticación", () => {
  beforeEach(() => vi.clearAllMocks());

  it("responde 401 cuando no hay sesión activa", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(null as never);

    const { GET } = await import("@/app/api/participantes/route");
    const req = makeRequest("GET", "/api/participantes");
    // Next.js route handlers esperan (NextRequest, context) — pasamos solo req en tests
    const res = await GET(req as never);
    expect(res.status).toBe(401);

    const json = await res.json();
    expect(json.error).toMatch(/no autorizado/i);
  });

  it("responde 200 con lista vacía cuando no hay participantes", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce({
      user: { id: "u1", role: "BECARIO", email: "b@cinvestav.mx", name: null, image: null },
      expires: "",
    } as never);

    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.participante.findMany).mockResolvedValueOnce([]);

    const { GET } = await import("@/app/api/participantes/route");
    const req = makeRequest("GET", "/api/participantes");
    const res = await GET(req as never);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(Array.isArray(json.participantes)).toBe(true);
    expect(json.participantes).toHaveLength(0);
  });

  it("responde 200 con participantes cuando hay resultados", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce({
      user: { id: "u1", role: "READONLY", email: "r@cinvestav.mx", name: null, image: null },
      expires: "",
    } as never);

    const participantesMock = [
      {
        id:           "p1",
        nombre:       "María",
        apellidos:    "López",
        edad:         10,
        escuela:      "Primaria Centro",
        grado:        "4°",
        createdAt:    new Date(),
        updatedAt:    new Date(),
        inscripciones: [],
      },
    ];

    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.participante.findMany).mockResolvedValueOnce(
      participantesMock as never,
    );

    const { GET } = await import("@/app/api/participantes/route");
    const req = makeRequest("GET", "/api/participantes", undefined, { q: "María" });
    const res = await GET(req as never);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.participantes).toHaveLength(1);
    expect(json.participantes[0].nombre).toBe("María");
  });
});

// ── POST /api/participantes — autenticación y validación ─────────────────────

describe("POST /api/participantes — autenticación y validación", () => {
  beforeEach(() => vi.clearAllMocks());

  it("responde 401 cuando no hay sesión activa", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(null as never);

    const { POST } = await import("@/app/api/participantes/route");
    const req = makeRequest("POST", "/api/participantes", {
      nombre: "Luis", apellidos: "Pérez", edad: 11, escuela: "Escuela X", grado: "5°",
    });
    const res = await POST(req as never);
    expect(res.status).toBe(401);
  });

  it("responde 403 cuando el rol es READONLY", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce({
      user: { id: "u1", role: "READONLY", email: "r@cinvestav.mx", name: null, image: null },
      expires: "",
    } as never);

    const { POST } = await import("@/app/api/participantes/route");
    const req = makeRequest("POST", "/api/participantes", {
      nombre: "Luis", apellidos: "Pérez", edad: 11, escuela: "Escuela X", grado: "5°",
    });
    const res = await POST(req as never);
    expect(res.status).toBe(403);
  });

  it("responde 422 con datos inválidos (edad fuera de rango)", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce({
      user: { id: "u1", role: "ADMIN", email: "a@cinvestav.mx", name: null, image: null },
      expires: "",
    } as never);

    const { POST } = await import("@/app/api/participantes/route");
    const req = makeRequest("POST", "/api/participantes", {
      nombre: "Luis", apellidos: "Pérez", edad: 2, escuela: "Escuela X", grado: "5°",
    });
    const res = await POST(req as never);
    expect(res.status).toBe(422);

    const json = await res.json();
    expect(json.error).toMatch(/inválidos/i);
    expect(json.detalles).toBeDefined();
  });

  it("responde 201 y devuelve el participante creado", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce({
      user: { id: "u1", role: "ADMIN", email: "a@cinvestav.mx", name: null, image: null },
      expires: "",
    } as never);

    const creado = {
      id: "p_new", nombre: "Carlos", apellidos: "Sánchez",
      edad: 9, escuela: "Primaria Mérida", grado: "3°",
      createdAt: new Date(), updatedAt: new Date(),
    };

    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.participante.create).mockResolvedValueOnce(creado as never);

    const { POST } = await import("@/app/api/participantes/route");
    const req = makeRequest("POST", "/api/participantes", {
      nombre: "Carlos", apellidos: "Sánchez", edad: 9,
      escuela: "Primaria Mérida", grado: "3°",
    });
    const res = await POST(req as never);
    expect(res.status).toBe(201);

    const json = await res.json();
    expect(json.participante.nombre).toBe("Carlos");
  });

  it("responde 422 cuando faltan campos requeridos", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce({
      user: { id: "u1", role: "BECARIO", email: "b@cinvestav.mx", name: null, image: null },
      expires: "",
    } as never);

    const { POST } = await import("@/app/api/participantes/route");
    const req = makeRequest("POST", "/api/participantes", {});
    const res = await POST(req as never);
    expect(res.status).toBe(422);
  });
});

// ── GET /api/participantes/[id] — historial ───────────────────────────────────

describe("GET /api/participantes/[id] — historial", () => {
  beforeEach(() => vi.clearAllMocks());

  it("responde 401 sin sesión", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(null as never);

    const { GET } = await import("@/app/api/participantes/[id]/route");
    const req = makeRequest("GET", "/api/participantes/p1");
    const res = await GET(req as never, { params: Promise.resolve({ id: "p1" }) });
    expect(res.status).toBe(401);
  });

  it("responde 404 cuando el participante no existe", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce({
      user: { id: "u1", role: "ADMIN", email: "a@cinvestav.mx", name: null, image: null },
      expires: "",
    } as never);

    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.participante.findUnique).mockResolvedValueOnce(null);

    const { GET } = await import("@/app/api/participantes/[id]/route");
    const req = makeRequest("GET", "/api/participantes/p_noexiste");
    const res = await GET(req as never, {
      params: Promise.resolve({ id: "p_noexiste" }),
    });
    expect(res.status).toBe(404);
  });

  it("responde 200 con historial completo del participante", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce({
      user: { id: "u1", role: "BECARIO", email: "b@cinvestav.mx", name: null, image: null },
      expires: "",
    } as never);

    const historialMock = {
      id: "p1", nombre: "Ana", apellidos: "Martínez",
      edad: 12, escuela: "Primaria Norte", grado: "6°",
      createdAt: new Date(), updatedAt: new Date(),
      inscripciones: [
        {
          id: "i1", participanteId: "p1", edicionId: "e1",
          constanciaUrl: null, constanciaGenerada: false, createdAt: new Date(),
          edicion: { id: "e1", anio: 2024, nombre: "Edición 2024", activa: false,
                     fechaInicio: new Date(), fechaFin: new Date() },
          asistencias: [],
        },
      ],
    };

    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.participante.findUnique).mockResolvedValueOnce(
      historialMock as never,
    );

    const { GET } = await import("@/app/api/participantes/[id]/route");
    const req = makeRequest("GET", "/api/participantes/p1");
    const res = await GET(req as never, { params: Promise.resolve({ id: "p1" }) });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.participante.id).toBe("p1");
    expect(json.participante.inscripciones).toHaveLength(1);
  });
});

// ── POST /api/inscripciones ───────────────────────────────────────────────────

describe("POST /api/inscripciones", () => {
  beforeEach(() => vi.clearAllMocks());

  it("responde 401 sin sesión", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(null as never);

    const { POST } = await import("@/app/api/inscripciones/route");
    const req = makeRequest("POST", "/api/inscripciones", {
      participanteId: "clxyz1234567890abcdef0001",
      edicionId:      "clxyz1234567890abcdef0002",
    });
    const res = await POST(req as never);
    expect(res.status).toBe(401);
  });

  it("responde 403 cuando el rol es READONLY", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce({
      user: { id: "u1", role: "READONLY", email: "r@cinvestav.mx", name: null, image: null },
      expires: "",
    } as never);

    const { POST } = await import("@/app/api/inscripciones/route");
    const req = makeRequest("POST", "/api/inscripciones", {
      participanteId: "clxyz1234567890abcdef0001",
      edicionId:      "clxyz1234567890abcdef0002",
    });
    const res = await POST(req as never);
    expect(res.status).toBe(403);
  });

  it("responde 409 cuando la edición no está activa", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce({
      user: { id: "u1", role: "ADMIN", email: "a@cinvestav.mx", name: null, image: null },
      expires: "",
    } as never);

    // La query lanza EDICION_NO_ACTIVA
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.edicion.findUnique).mockResolvedValueOnce({
      id: "e1", activa: false, nombre: "Edición 2023",
    } as never);

    const { POST } = await import("@/app/api/inscripciones/route");
    const req = makeRequest("POST", "/api/inscripciones", {
      participanteId: "clxyz1234567890abcdef0001",
      edicionId:      "clxyz1234567890abcdef0002",
    });
    const res = await POST(req as never);
    expect(res.status).toBe(409);
  });

  it("responde 201 con la inscripción creada", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce({
      user: { id: "u1", role: "ADMIN", email: "a@cinvestav.mx", name: null, image: null },
      expires: "",
    } as never);

    const { prisma } = await import("@/lib/prisma");
    // Edición activa
    vi.mocked(prisma.edicion.findUnique).mockResolvedValueOnce({
      id: "e1", activa: true, nombre: "Edición 2025",
    } as never);
    // Participante existe
    vi.mocked(prisma.participante.findUnique).mockResolvedValueOnce({
      id: "p1",
    } as never);
    // Inscripción creada
    const inscripcionMock = {
      id: "i_new", participanteId: "p1", edicionId: "e1",
      constanciaUrl: null, constanciaGenerada: false, createdAt: new Date(),
      participante: { id: "p1", nombre: "Luis", apellidos: "Torres" },
      edicion:      { id: "e1", anio: 2025, nombre: "Edición 2025" },
    };
    vi.mocked(prisma.inscripcion.create).mockResolvedValueOnce(
      inscripcionMock as never,
    );

    const { POST } = await import("@/app/api/inscripciones/route");
    const req = makeRequest("POST", "/api/inscripciones", {
      participanteId: "clxyz1234567890abcdef0001",
      edicionId:      "clxyz1234567890abcdef0002",
    });
    const res = await POST(req as never);
    expect(res.status).toBe(201);

    const json = await res.json();
    expect(json.inscripcion.id).toBe("i_new");
  });
});

// ── DELETE /api/inscripciones/[id] ───────────────────────────────────────────

describe("DELETE /api/inscripciones/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("responde 401 sin sesión", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(null as never);

    const { DELETE } = await import("@/app/api/inscripciones/[id]/route");
    const req = makeRequest("DELETE", "/api/inscripciones/i1");
    const res = await DELETE(req as never, { params: Promise.resolve({ id: "i1" }) });
    expect(res.status).toBe(401);
  });

  it("responde 403 cuando el rol es BECARIO (solo ADMIN puede borrar)", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce({
      user: { id: "u1", role: "BECARIO", email: "b@cinvestav.mx", name: null, image: null },
      expires: "",
    } as never);

    const { DELETE } = await import("@/app/api/inscripciones/[id]/route");
    const req = makeRequest("DELETE", "/api/inscripciones/i1");
    const res = await DELETE(req as never, { params: Promise.resolve({ id: "i1" }) });
    expect(res.status).toBe(403);
  });

  it("responde 404 cuando la inscripción no existe", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce({
      user: { id: "u1", role: "ADMIN", email: "a@cinvestav.mx", name: null, image: null },
      expires: "",
    } as never);

    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.inscripcion.findUnique).mockResolvedValueOnce(null);

    const { DELETE } = await import("@/app/api/inscripciones/[id]/route");
    const req = makeRequest("DELETE", "/api/inscripciones/i_noexiste");
    const res = await DELETE(req as never, {
      params: Promise.resolve({ id: "i_noexiste" }),
    });
    expect(res.status).toBe(404);
  });

  it("responde 204 cuando ADMIN elimina inscripción existente", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce({
      user: { id: "u1", role: "ADMIN", email: "a@cinvestav.mx", name: null, image: null },
      expires: "",
    } as never);

    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.inscripcion.findUnique).mockResolvedValueOnce({
      id: "i1",
    } as never);
    vi.mocked(prisma.inscripcion.delete).mockResolvedValueOnce({
      id: "i1",
    } as never);

    const { DELETE } = await import("@/app/api/inscripciones/[id]/route");
    const req = makeRequest("DELETE", "/api/inscripciones/i1");
    const res = await DELETE(req as never, { params: Promise.resolve({ id: "i1" }) });
    expect(res.status).toBe(204);
  });
});
