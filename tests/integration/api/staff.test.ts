import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Staff: quien IMPARTE U ORGANIZA una sesión.
//
// OJO con el vocabulario: en pantalla «sesión» es el modelo `Clase` (la
// charla), y «fecha» es el modelo `Sesion`. El staff se asigna a la SESIÓN, o
// sea a `Clase`, y por eso las rutas cuelgan de /api/clases/[id]/staff.
//
// Lo que estas pruebas protegen es la reutilización, que es lo que decide si la
// función se usa o se abandona: un mismo becario está en veinte sesiones, y en
// las diecinueve siguientes se manda su id y NO se crea otra ficha. Si se
// creara una por sesión, la lista se llenaría de duplicados y no serviría.
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
    staff: {
      findMany:   vi.fn(),
      findUnique: vi.fn(),
      create:     vi.fn(),
      delete:     vi.fn(),
    },
    staffClase: {
      findMany:   vi.fn(),
      findUnique: vi.fn(),
      upsert:     vi.fn(),
      delete:     vi.fn(),
    },
    clase: {
      findUnique: vi.fn(),
    },
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

const STAFF = {
  id:          "s1",
  nombre:      "Rocío",
  apellidos:   "Canul",
  telefono:    "9997654321",
  correo:      "rocio@cinvestav.mx",
  rol:         "BECARIO",
  institucion: "CINVESTAV Mérida",
  createdAt:   new Date(),
  updatedAt:   new Date(),
};

// ── POST /api/staff — alta de una persona ────────────────────────────────────

describe("POST /api/staff — alta de staff", () => {
  beforeEach(() => vi.clearAllMocks());

  it("responde 401 sin sesión", async () => {
    await mockSesion(null);
    const { POST } = await import("@/app/api/staff/route");
    const res = await POST(
      makeRequest("POST", "/api/staff", { nombre: "Rocío", rol: "BECARIO" }) as never,
    );
    expect(res.status).toBe(401);
  });

  it("responde 403 a READONLY: solo consulta, no da de alta", async () => {
    await mockSesion("READONLY");
    const { POST } = await import("@/app/api/staff/route");
    const res = await POST(
      makeRequest("POST", "/api/staff", { nombre: "Rocío", rol: "BECARIO" }) as never,
    );
    expect(res.status).toBe(403);
  });

  it("responde 422 si llega sin nombre", async () => {
    await mockSesion("ADMIN");
    const { POST } = await import("@/app/api/staff/route");
    const res = await POST(
      makeRequest("POST", "/api/staff", { nombre: "   ", rol: "BECARIO" }) as never,
    );
    expect(res.status).toBe(422);
  });

  it("BECARIO da de alta a una persona nueva", async () => {
    await mockSesion("BECARIO");
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.staff.create).mockResolvedValueOnce(STAFF as never);

    const { POST } = await import("@/app/api/staff/route");
    const res = await POST(
      makeRequest("POST", "/api/staff", {
        nombre:      "Rocío",
        apellidos:   "Canul",
        telefono:    "9997654321",
        correo:      "rocio@cinvestav.mx",
        institucion: "CINVESTAV Mérida",
        rol:         "BECARIO",
      }) as never,
    );

    expect(res.status).toBe(201);
    expect(prisma.staff.create).toHaveBeenCalledOnce();

    const json = await res.json();
    expect(json.staff.nombre).toBe("Rocío");
  });
});

// ── GET /api/staff — buscador para reutilizar ────────────────────────────────

describe("GET /api/staff — buscador", () => {
  beforeEach(() => vi.clearAllMocks());

  it("responde 401 sin sesión", async () => {
    await mockSesion(null);
    const { GET } = await import("@/app/api/staff/route");
    const res = await GET(makeRequest("GET", "/api/staff") as never);
    expect(res.status).toBe(401);
  });

  it("responde 403 a READONLY: el buscador expone el contacto de la persona", async () => {
    await mockSesion("READONLY");
    const { GET } = await import("@/app/api/staff/route");
    const res = await GET(makeRequest("GET", "/api/staff") as never);
    expect(res.status).toBe(403);
  });

  it("devuelve a la persona y en cuántas sesiones participa", async () => {
    await mockSesion("BECARIO");
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.staff.findMany).mockResolvedValueOnce([
      { ...STAFF, _count: { sesiones: 20 } },
    ] as never);

    const { GET } = await import("@/app/api/staff/route");
    const res = await GET(
      makeRequest("GET", "/api/staff", undefined, { q: "Rocío" }) as never,
    );
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.staff).toHaveLength(1);
    expect(json.staff[0]._count.sesiones).toBe(20);
  });
});

// ── GET /api/staff/[id] — ficha ──────────────────────────────────────────────

describe("GET /api/staff/[id] — ficha", () => {
  beforeEach(() => vi.clearAllMocks());

  it("responde 404 cuando no existe", async () => {
    await mockSesion("ADMIN");
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.staff.findUnique).mockResolvedValueOnce(null);

    const { GET } = await import("@/app/api/staff/[id]/route");
    const res = await GET(makeRequest("GET", "/api/staff/nope") as never, {
      params: Promise.resolve({ id: "nope" }),
    });
    expect(res.status).toBe(404);
  });

  it("READONLY consulta la ficha pero sin teléfono ni correo", async () => {
    await mockSesion("READONLY");
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.staff.findUnique).mockResolvedValueOnce({
      ...STAFF,
      sesiones: [],
    } as never);

    const { GET } = await import("@/app/api/staff/[id]/route");
    const res = await GET(makeRequest("GET", "/api/staff/s1") as never, {
      params: Promise.resolve({ id: "s1" }),
    });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.staff.nombre).toBe("Rocío");
    expect(json.staff.telefono).toBeNull();
    expect(json.staff.correo).toBeNull();
  });

  it("ADMIN sí ve el contacto", async () => {
    await mockSesion("ADMIN");
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.staff.findUnique).mockResolvedValueOnce({
      ...STAFF,
      sesiones: [],
    } as never);

    const { GET } = await import("@/app/api/staff/[id]/route");
    const res = await GET(makeRequest("GET", "/api/staff/s1") as never, {
      params: Promise.resolve({ id: "s1" }),
    });
    const json = await res.json();
    expect(json.staff.telefono).toBe("9997654321");
    expect(json.staff.correo).toBe("rocio@cinvestav.mx");
  });
});

// ── PUT /api/clases/[id]/staff — asignar a una sesión ────────────────────────

describe("PUT /api/clases/[id]/staff — asignar", () => {
  beforeEach(() => vi.clearAllMocks());

  it("responde 401 sin sesión", async () => {
    await mockSesion(null);
    const { PUT } = await import("@/app/api/clases/[id]/staff/route");
    const res = await PUT(
      makeRequest("PUT", "/api/clases/c1/staff", { staffId: "s1" }) as never,
      { params: Promise.resolve({ id: "c1" }) },
    );
    expect(res.status).toBe(401);
  });

  it("responde 403 a READONLY", async () => {
    await mockSesion("READONLY");
    const { PUT } = await import("@/app/api/clases/[id]/staff/route");
    const res = await PUT(
      makeRequest("PUT", "/api/clases/c1/staff", { staffId: "s1" }) as never,
      { params: Promise.resolve({ id: "c1" }) },
    );
    expect(res.status).toBe(403);
  });

  it("responde 422 si no se dice a quién asignar", async () => {
    await mockSesion("BECARIO");
    const { PUT } = await import("@/app/api/clases/[id]/staff/route");
    const res = await PUT(
      makeRequest("PUT", "/api/clases/c1/staff", {}) as never,
      { params: Promise.resolve({ id: "c1" }) },
    );
    expect(res.status).toBe(422);
  });

  it("responde 404 cuando la sesión no existe", async () => {
    await mockSesion("ADMIN");
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.clase.findUnique).mockResolvedValueOnce(null);

    const { PUT } = await import("@/app/api/clases/[id]/staff/route");
    const res = await PUT(
      makeRequest("PUT", "/api/clases/nope/staff", { staffId: "s1" }) as never,
      { params: Promise.resolve({ id: "nope" }) },
    );
    expect(res.status).toBe(404);
  });

  it("responde 404 cuando la persona elegida ya no existe", async () => {
    await mockSesion("ADMIN");
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.clase.findUnique).mockResolvedValueOnce({ id: "c1" } as never);
    vi.mocked(prisma.staff.findUnique).mockResolvedValueOnce(null);

    const { PUT } = await import("@/app/api/clases/[id]/staff/route");
    const res = await PUT(
      makeRequest("PUT", "/api/clases/c1/staff", { staffId: "borrada" }) as never,
      { params: Promise.resolve({ id: "c1" }) },
    );
    expect(res.status).toBe(404);
    expect(prisma.staffClase.upsert).not.toHaveBeenCalled();
  });

  it("CREA la ficha cuando se capturan sus datos y la asigna a la sesión", async () => {
    await mockSesion("BECARIO");
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.clase.findUnique).mockResolvedValueOnce({ id: "c1" } as never);
    vi.mocked(prisma.staff.create).mockResolvedValueOnce(STAFF as never);
    vi.mocked(prisma.staffClase.upsert).mockResolvedValueOnce({
      id: "sc1", claseId: "c1", staffId: "s1", staff: STAFF,
    } as never);

    const { PUT } = await import("@/app/api/clases/[id]/staff/route");
    const res = await PUT(
      makeRequest("PUT", "/api/clases/c1/staff", {
        staff: { nombre: "Rocío", apellidos: "Canul", rol: "BECARIO" },
      }) as never,
      { params: Promise.resolve({ id: "c1" }) },
    );

    expect(res.status).toBe(201);
    expect(prisma.staff.create).toHaveBeenCalledOnce();

    const json = await res.json();
    expect(json.asignacion.staff.id).toBe("s1");
  });

  it("REUTILIZA: la misma persona en DOS sesiones distintas y UNA sola ficha", async () => {
    const { prisma } = await import("@/lib/prisma");

    // Sesión 1 — se captura por primera vez.
    await mockSesion("BECARIO");
    vi.mocked(prisma.clase.findUnique).mockResolvedValueOnce({ id: "c1" } as never);
    vi.mocked(prisma.staff.create).mockResolvedValueOnce(STAFF as never);
    vi.mocked(prisma.staffClase.upsert).mockResolvedValueOnce({
      id: "sc1", claseId: "c1", staffId: "s1", staff: STAFF,
    } as never);

    const { PUT } = await import("@/app/api/clases/[id]/staff/route");
    const res1 = await PUT(
      makeRequest("PUT", "/api/clases/c1/staff", {
        staff: { nombre: "Rocío", apellidos: "Canul", rol: "BECARIO" },
      }) as never,
      { params: Promise.resolve({ id: "c1" }) },
    );
    expect(res1.status).toBe(201);

    // Sesión 2 — se elige de la lista. No debe nacer una segunda ficha.
    await mockSesion("BECARIO");
    vi.mocked(prisma.clase.findUnique).mockResolvedValueOnce({ id: "c2" } as never);
    vi.mocked(prisma.staff.findUnique).mockResolvedValueOnce(STAFF as never);
    vi.mocked(prisma.staffClase.upsert).mockResolvedValueOnce({
      id: "sc2", claseId: "c2", staffId: "s1", staff: STAFF,
    } as never);

    const res2 = await PUT(
      makeRequest("PUT", "/api/clases/c2/staff", { staffId: "s1" }) as never,
      { params: Promise.resolve({ id: "c2" }) },
    );
    expect(res2.status).toBe(201);

    // Lo que importa: una sola ficha para las dos sesiones.
    expect(prisma.staff.create).toHaveBeenCalledOnce();
    expect(prisma.staffClase.upsert).toHaveBeenCalledTimes(2);

    const json2 = await res2.json();
    expect(json2.asignacion.staff.id).toBe("s1");
    expect(json2.asignacion.claseId).toBe("c2");
  });
});

// ── DELETE /api/clases/[id]/staff/[staffId] — quitar de una sesión ───────────

describe("DELETE /api/clases/[id]/staff/[staffId] — quitar", () => {
  beforeEach(() => vi.clearAllMocks());

  it("responde 403 a READONLY", async () => {
    await mockSesion("READONLY");
    const { DELETE } = await import("@/app/api/clases/[id]/staff/[staffId]/route");
    const res = await DELETE(
      makeRequest("DELETE", "/api/clases/c1/staff/s1") as never,
      { params: Promise.resolve({ id: "c1", staffId: "s1" }) },
    );
    expect(res.status).toBe(403);
  });

  it("responde 404 si esa persona no estaba asignada a esa sesión", async () => {
    await mockSesion("ADMIN");
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.staffClase.findUnique).mockResolvedValueOnce(null);

    const { DELETE } = await import("@/app/api/clases/[id]/staff/[staffId]/route");
    const res = await DELETE(
      makeRequest("DELETE", "/api/clases/c1/staff/s9") as never,
      { params: Promise.resolve({ id: "c1", staffId: "s9" }) },
    );
    expect(res.status).toBe(404);
    expect(prisma.staffClase.delete).not.toHaveBeenCalled();
  });

  it("quita la asignación SIN borrar la ficha de la persona", async () => {
    await mockSesion("BECARIO");
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.staffClase.findUnique).mockResolvedValueOnce({
      id: "sc1", claseId: "c1", staffId: "s1",
    } as never);
    vi.mocked(prisma.staffClase.delete).mockResolvedValueOnce({ id: "sc1" } as never);

    const { DELETE } = await import("@/app/api/clases/[id]/staff/[staffId]/route");
    const res = await DELETE(
      makeRequest("DELETE", "/api/clases/c1/staff/s1") as never,
      { params: Promise.resolve({ id: "c1", staffId: "s1" }) },
    );

    expect(res.status).toBe(204);
    expect(prisma.staffClase.delete).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { staffId_claseId: { staffId: "s1", claseId: "c1" } },
      }),
    );
    // La persona sigue existiendo: el año que viene se reutiliza.
    expect(prisma.staff.delete).not.toHaveBeenCalled();
  });
});

// ── GET /api/clases/[id]/staff — quién está asignado ─────────────────────────

describe("GET /api/clases/[id]/staff — asignados a la sesión", () => {
  beforeEach(() => vi.clearAllMocks());

  it("READONLY puede consultar, pero sin contacto", async () => {
    await mockSesion("READONLY");
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.staffClase.findMany).mockResolvedValueOnce([
      { id: "sc1", claseId: "c1", staffId: "s1", createdAt: new Date(), staff: STAFF },
    ] as never);

    const { GET } = await import("@/app/api/clases/[id]/staff/route");
    const res = await GET(makeRequest("GET", "/api/clases/c1/staff") as never, {
      params: Promise.resolve({ id: "c1" }),
    });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.staff).toHaveLength(1);
    expect(json.staff[0].nombre).toBe("Rocío");
    expect(json.staff[0].telefono).toBeNull();
    expect(json.staff[0].correo).toBeNull();
  });
});
