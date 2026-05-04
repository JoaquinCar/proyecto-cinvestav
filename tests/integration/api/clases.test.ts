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

// Mock de NextAuth auth()
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

// Mock de queries de clases
vi.mock("@/server/queries/clases", () => ({
  listarClasesDeEdicion: vi.fn(),
  obtenerClasePorId:     vi.fn(),
  crearClase:            vi.fn(),
  editarClase:           vi.fn(),
  eliminarClase:         vi.fn(),
  listarSesionesDeClase: vi.fn(),
  obtenerSesionPorId:    vi.fn(),
  crearSesion:           vi.fn(),
  actualizarSesion:      vi.fn(),
  eliminarSesion:        vi.fn(),
  ClaseConAsistenciasError: class ClaseConAsistenciasError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "ClaseConAsistenciasError";
    }
  },
  SesionConAsistenciasError: class SesionConAsistenciasError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "SesionConAsistenciasError";
    }
  },
}));

// Mock de queries de ediciones (para verificar existencia)
vi.mock("@/server/queries/ediciones", () => ({
  existeEdicion: vi.fn(),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const sessionAdmin = {
  user: { id: "user-1", email: "admin@cinvestav.mx", role: "ADMIN", name: "Admin", image: null },
};

const sessionBecario = {
  user: { id: "user-2", email: "becario@cinvestav.mx", role: "BECARIO", name: "Becario", image: null },
};

const sessionReadonly = {
  user: { id: "user-3", email: "readonly@cinvestav.mx", role: "READONLY", name: "Readonly", image: null },
};

const claseMock = {
  id:           "clase-1",
  edicionId:    "edicion-1",
  nombre:       "Astronomía",
  investigador: "Dr. Juan Pérez",
  descripcion:  "Introducción al universo",
  createdAt:    new Date("2025-01-01T00:00:00.000Z"),
  _count:       { sesiones: 3 },
};

const sesionMock = {
  id:              "sesion-1",
  claseId:         "clase-1",
  fecha:           new Date("2025-03-15T10:00:00.000Z"),
  temas:           "Sistema solar",
  notas:           "Excelente sesión",
  registradaPorId: "user-1",
  createdAt:       new Date("2025-03-10T00:00:00.000Z"),
  _count:          { asistencias: 15 },
};

function makeRequest(
  method: string,
  path: string,
  body?: unknown,
): Request {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

// ── GET /api/ediciones/[id]/clases ────────────────────────────────────────────

describe("GET /api/ediciones/[id]/clases", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retorna 401 cuando no hay sesión activa", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(null as never);

    const { GET } = await import("@/app/api/ediciones/[id]/clases/route");
    const req = makeRequest("GET", "/api/ediciones/edicion-1/clases");
    const res = await GET(req, { params: Promise.resolve({ id: "edicion-1" }) });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: "No autorizado" });
  });

  it("retorna 404 cuando la edición no existe", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionAdmin as never);

    const { existeEdicion } = await import("@/server/queries/ediciones");
    vi.mocked(existeEdicion).mockResolvedValueOnce(false);

    const { GET } = await import("@/app/api/ediciones/[id]/clases/route");
    const req = makeRequest("GET", "/api/ediciones/no-existe/clases");
    const res = await GET(req, { params: Promise.resolve({ id: "no-existe" }) });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/no encontrada/i);
  });

  it("retorna 200 con lista de clases para BECARIO", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionBecario as never);

    const { existeEdicion } = await import("@/server/queries/ediciones");
    vi.mocked(existeEdicion).mockResolvedValueOnce(true);

    const { listarClasesDeEdicion } = await import("@/server/queries/clases");
    vi.mocked(listarClasesDeEdicion).mockResolvedValueOnce([claseMock]);

    const { GET } = await import("@/app/api/ediciones/[id]/clases/route");
    const req = makeRequest("GET", "/api/ediciones/edicion-1/clases");
    const res = await GET(req, { params: Promise.resolve({ id: "edicion-1" }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.clases)).toBe(true);
    expect(body.clases[0].nombre).toBe("Astronomía");
    expect(body.clases[0]._count.sesiones).toBe(3);
  });

  it("retorna 200 con arreglo vacío cuando no hay clases", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionAdmin as never);

    const { existeEdicion } = await import("@/server/queries/ediciones");
    vi.mocked(existeEdicion).mockResolvedValueOnce(true);

    const { listarClasesDeEdicion } = await import("@/server/queries/clases");
    vi.mocked(listarClasesDeEdicion).mockResolvedValueOnce([]);

    const { GET } = await import("@/app/api/ediciones/[id]/clases/route");
    const req = makeRequest("GET", "/api/ediciones/edicion-1/clases");
    const res = await GET(req, { params: Promise.resolve({ id: "edicion-1" }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ clases: [] });
  });
});

// ── POST /api/clases ──────────────────────────────────────────────────────────

describe("POST /api/clases", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retorna 401 cuando no hay sesión activa", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(null as never);

    const { POST } = await import("@/app/api/clases/route");
    const req = makeRequest("POST", "/api/clases", {
      edicionId: "clxyz1234567890abcdef0001",
      nombre: "Robótica",
      investigador: "Dr. Martínez",
    });
    const res = await POST(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: "No autorizado" });
  });

  it("retorna 403 cuando el rol no es ADMIN", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionBecario as never);

    const { POST } = await import("@/app/api/clases/route");
    const req = makeRequest("POST", "/api/clases", {
      edicionId: "clxyz1234567890abcdef0001",
      nombre: "Robótica",
      investigador: "Dr. Martínez",
    });
    const res = await POST(req);

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toEqual({ error: "Prohibido" });
  });

  it("retorna 422 cuando el body tiene datos inválidos", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionAdmin as never);

    const { POST } = await import("@/app/api/clases/route");
    const req = makeRequest("POST", "/api/clases", { nombre: "" });
    const res = await POST(req);

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe("Datos inválidos");
    expect(body.details).toBeDefined();
  });

  it("retorna 404 cuando la edición no existe", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionAdmin as never);

    const { existeEdicion } = await import("@/server/queries/ediciones");
    vi.mocked(existeEdicion).mockResolvedValueOnce(false);

    const { POST } = await import("@/app/api/clases/route");
    const req = makeRequest("POST", "/api/clases", {
      edicionId: "clxyz1234567890abcdef0001",
      nombre: "Robótica",
      investigador: "Dr. Martínez",
    });
    const res = await POST(req);

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/no encontrada/i);
  });

  it("retorna 201 con la clase creada cuando los datos son válidos", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionAdmin as never);

    const { existeEdicion } = await import("@/server/queries/ediciones");
    vi.mocked(existeEdicion).mockResolvedValueOnce(true);

    const { crearClase } = await import("@/server/queries/clases");
    vi.mocked(crearClase).mockResolvedValueOnce(claseMock);

    const { POST } = await import("@/app/api/clases/route");
    const req = makeRequest("POST", "/api/clases", {
      edicionId: "clxyz1234567890abcdef0001",
      nombre: "Astronomía",
      investigador: "Dr. Juan Pérez",
    });
    const res = await POST(req);

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.nombre).toBe("Astronomía");
  });
});

// ── PUT /api/clases/[id] ──────────────────────────────────────────────────────

describe("PUT /api/clases/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retorna 401 cuando no hay sesión activa", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(null as never);

    const { PUT } = await import("@/app/api/clases/[id]/route");
    const req = makeRequest("PUT", "/api/clases/clase-1", { nombre: "Nueva" });
    const res = await PUT(req, { params: Promise.resolve({ id: "clase-1" }) });

    expect(res.status).toBe(401);
  });

  it("retorna 403 cuando el rol no es ADMIN", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionBecario as never);

    const { PUT } = await import("@/app/api/clases/[id]/route");
    const req = makeRequest("PUT", "/api/clases/clase-1", { nombre: "Nueva" });
    const res = await PUT(req, { params: Promise.resolve({ id: "clase-1" }) });

    expect(res.status).toBe(403);
  });

  it("retorna 404 cuando la clase no existe", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionAdmin as never);

    const { obtenerClasePorId } = await import("@/server/queries/clases");
    vi.mocked(obtenerClasePorId).mockResolvedValueOnce(null);

    const { PUT } = await import("@/app/api/clases/[id]/route");
    const req = makeRequest("PUT", "/api/clases/no-existe", { nombre: "Nueva" });
    const res = await PUT(req, { params: Promise.resolve({ id: "no-existe" }) });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/no encontrada/i);
  });

  it("retorna 422 con datos inválidos", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionAdmin as never);

    const { obtenerClasePorId } = await import("@/server/queries/clases");
    vi.mocked(obtenerClasePorId).mockResolvedValueOnce(claseMock);

    const { PUT } = await import("@/app/api/clases/[id]/route");
    const req = makeRequest("PUT", "/api/clases/clase-1", { nombre: "" });
    const res = await PUT(req, { params: Promise.resolve({ id: "clase-1" }) });

    expect(res.status).toBe(422);
  });

  it("retorna 200 con la clase actualizada cuando los datos son válidos", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionAdmin as never);

    const { obtenerClasePorId, editarClase } = await import("@/server/queries/clases");
    vi.mocked(obtenerClasePorId).mockResolvedValueOnce(claseMock);
    vi.mocked(editarClase).mockResolvedValueOnce({
      ...claseMock,
      nombre: "Astronomía Avanzada",
    });

    const { PUT } = await import("@/app/api/clases/[id]/route");
    const req = makeRequest("PUT", "/api/clases/clase-1", {
      nombre: "Astronomía Avanzada",
    });
    const res = await PUT(req, { params: Promise.resolve({ id: "clase-1" }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.nombre).toBe("Astronomía Avanzada");
  });
});

// ── DELETE /api/clases/[id] ───────────────────────────────────────────────────

describe("DELETE /api/clases/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retorna 401 cuando no hay sesión activa", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(null as never);

    const { DELETE } = await import("@/app/api/clases/[id]/route");
    const req = makeRequest("DELETE", "/api/clases/clase-1");
    const res = await DELETE(req, { params: Promise.resolve({ id: "clase-1" }) });

    expect(res.status).toBe(401);
  });

  it("retorna 403 cuando el rol no es ADMIN", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionBecario as never);

    const { DELETE } = await import("@/app/api/clases/[id]/route");
    const req = makeRequest("DELETE", "/api/clases/clase-1");
    const res = await DELETE(req, { params: Promise.resolve({ id: "clase-1" }) });

    expect(res.status).toBe(403);
  });

  it("retorna 404 cuando la clase no existe", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionAdmin as never);

    const { obtenerClasePorId } = await import("@/server/queries/clases");
    vi.mocked(obtenerClasePorId).mockResolvedValueOnce(null);

    const { DELETE } = await import("@/app/api/clases/[id]/route");
    const req = makeRequest("DELETE", "/api/clases/no-existe");
    const res = await DELETE(req, { params: Promise.resolve({ id: "no-existe" }) });

    expect(res.status).toBe(404);
  });

  it("retorna 409 cuando la clase tiene asistencias registradas", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionAdmin as never);

    const { obtenerClasePorId, eliminarClase, ClaseConAsistenciasError } =
      await import("@/server/queries/clases");
    vi.mocked(obtenerClasePorId).mockResolvedValueOnce(claseMock);
    vi.mocked(eliminarClase).mockRejectedValueOnce(
      new ClaseConAsistenciasError(
        "No se puede eliminar la clase porque tiene 10 asistencia(s) registrada(s)"
      )
    );

    const { DELETE } = await import("@/app/api/clases/[id]/route");
    const req = makeRequest("DELETE", "/api/clases/clase-1");
    const res = await DELETE(req, { params: Promise.resolve({ id: "clase-1" }) });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/asistencia/i);
  });

  it("retorna 204 cuando la clase se elimina correctamente", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionAdmin as never);

    const { obtenerClasePorId, eliminarClase } = await import("@/server/queries/clases");
    vi.mocked(obtenerClasePorId).mockResolvedValueOnce(claseMock);
    vi.mocked(eliminarClase).mockResolvedValueOnce(claseMock);

    const { DELETE } = await import("@/app/api/clases/[id]/route");
    const req = makeRequest("DELETE", "/api/clases/clase-1");
    const res = await DELETE(req, { params: Promise.resolve({ id: "clase-1" }) });

    expect(res.status).toBe(204);
  });
});

// ── GET /api/clases/[id]/sesiones ─────────────────────────────────────────────

describe("GET /api/clases/[id]/sesiones", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retorna 401 cuando no hay sesión activa", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(null as never);

    const { GET } = await import("@/app/api/clases/[id]/sesiones/route");
    const req = makeRequest("GET", "/api/clases/clase-1/sesiones");
    const res = await GET(req, { params: Promise.resolve({ id: "clase-1" }) });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: "No autorizado" });
  });

  it("retorna 404 cuando la clase no existe", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionBecario as never);

    const { obtenerClasePorId } = await import("@/server/queries/clases");
    vi.mocked(obtenerClasePorId).mockResolvedValueOnce(null);

    const { GET } = await import("@/app/api/clases/[id]/sesiones/route");
    const req = makeRequest("GET", "/api/clases/no-existe/sesiones");
    const res = await GET(req, { params: Promise.resolve({ id: "no-existe" }) });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/no encontrada/i);
  });

  it("retorna 200 con lista de sesiones para READONLY", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionReadonly as never);

    const { obtenerClasePorId, listarSesionesDeClase } = await import(
      "@/server/queries/clases"
    );
    vi.mocked(obtenerClasePorId).mockResolvedValueOnce(claseMock);
    vi.mocked(listarSesionesDeClase).mockResolvedValueOnce([sesionMock]);

    const { GET } = await import("@/app/api/clases/[id]/sesiones/route");
    const req = makeRequest("GET", "/api/clases/clase-1/sesiones");
    const res = await GET(req, { params: Promise.resolve({ id: "clase-1" }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.sesiones)).toBe(true);
    expect(body.sesiones[0].temas).toBe("Sistema solar");
    expect(body.sesiones[0]._count.asistencias).toBe(15);
  });

  it("retorna 200 con arreglo vacío cuando la clase no tiene sesiones", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionAdmin as never);

    const { obtenerClasePorId, listarSesionesDeClase } = await import(
      "@/server/queries/clases"
    );
    vi.mocked(obtenerClasePorId).mockResolvedValueOnce(claseMock);
    vi.mocked(listarSesionesDeClase).mockResolvedValueOnce([]);

    const { GET } = await import("@/app/api/clases/[id]/sesiones/route");
    const req = makeRequest("GET", "/api/clases/clase-1/sesiones");
    const res = await GET(req, { params: Promise.resolve({ id: "clase-1" }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ sesiones: [] });
  });
});

// ── POST /api/sesiones ────────────────────────────────────────────────────────

describe("POST /api/sesiones", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retorna 401 cuando no hay sesión activa", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(null as never);

    const { POST } = await import("@/app/api/sesiones/route");
    const req = makeRequest("POST", "/api/sesiones", {
      claseId: "clxyz1234567890abcdef0001",
      fecha: "2025-03-15T10:00:00.000Z",
    });
    const res = await POST(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: "No autorizado" });
  });

  it("retorna 403 cuando el rol es READONLY", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionReadonly as never);

    const { POST } = await import("@/app/api/sesiones/route");
    const req = makeRequest("POST", "/api/sesiones", {
      claseId: "clxyz1234567890abcdef0001",
      fecha: "2025-03-15T10:00:00.000Z",
    });
    const res = await POST(req);

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toEqual({ error: "Prohibido" });
  });

  it("retorna 422 cuando los datos son inválidos", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionAdmin as never);

    const { POST } = await import("@/app/api/sesiones/route");
    // fecha en formato incorrecto
    const req = makeRequest("POST", "/api/sesiones", {
      claseId: "clxyz1234567890abcdef0001",
      fecha: "no-es-fecha",
    });
    const res = await POST(req);

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe("Datos inválidos");
    expect(body.details).toBeDefined();
  });

  it("retorna 404 cuando la clase no existe", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionAdmin as never);

    const { obtenerClasePorId } = await import("@/server/queries/clases");
    vi.mocked(obtenerClasePorId).mockResolvedValueOnce(null);

    const { POST } = await import("@/app/api/sesiones/route");
    const req = makeRequest("POST", "/api/sesiones", {
      claseId: "clxyz1234567890abcdef0001",
      fecha: "2025-03-15T10:00:00.000Z",
    });
    const res = await POST(req);

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/no encontrada/i);
  });

  it("retorna 201 con la sesión creada cuando los datos son válidos", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionAdmin as never);

    const { obtenerClasePorId, crearSesion } = await import("@/server/queries/clases");
    vi.mocked(obtenerClasePorId).mockResolvedValueOnce(claseMock);
    vi.mocked(crearSesion).mockResolvedValueOnce(sesionMock);

    const { POST } = await import("@/app/api/sesiones/route");
    const req = makeRequest("POST", "/api/sesiones", {
      claseId: "clxyz1234567890abcdef0001",
      fecha: "2025-03-15T10:00:00.000Z",
      temas: "Sistema solar",
    });
    const res = await POST(req);

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.temas).toBe("Sistema solar");
  });
});

// ── PUT /api/sesiones/[id] ────────────────────────────────────────────────────

describe("PUT /api/sesiones/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retorna 401 cuando no hay sesión activa", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(null as never);

    const { PUT } = await import("@/app/api/sesiones/[id]/route");
    const req = makeRequest("PUT", "/api/sesiones/sesion-1", { temas: "Galaxias" });
    const res = await PUT(req, { params: Promise.resolve({ id: "sesion-1" }) });

    expect(res.status).toBe(401);
  });

  it("retorna 403 cuando el rol es READONLY", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionReadonly as never);

    const { PUT } = await import("@/app/api/sesiones/[id]/route");
    const req = makeRequest("PUT", "/api/sesiones/sesion-1", { temas: "Galaxias" });
    const res = await PUT(req, { params: Promise.resolve({ id: "sesion-1" }) });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toEqual({ error: "Prohibido" });
  });

  it("retorna 200 cuando BECARIO actualiza temas/notas", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionBecario as never);

    const { obtenerSesionPorId, actualizarSesion } = await import(
      "@/server/queries/clases"
    );
    vi.mocked(obtenerSesionPorId).mockResolvedValueOnce(sesionMock);
    vi.mocked(actualizarSesion).mockResolvedValueOnce({
      ...sesionMock,
      temas: "Galaxias",
    });

    const { PUT } = await import("@/app/api/sesiones/[id]/route");
    const req = makeRequest("PUT", "/api/sesiones/sesion-1", { temas: "Galaxias" });
    const res = await PUT(req, { params: Promise.resolve({ id: "sesion-1" }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.temas).toBe("Galaxias");
  });

  it("retorna 404 cuando la sesión no existe", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionAdmin as never);

    const { obtenerSesionPorId } = await import("@/server/queries/clases");
    vi.mocked(obtenerSesionPorId).mockResolvedValueOnce(null);

    const { PUT } = await import("@/app/api/sesiones/[id]/route");
    const req = makeRequest("PUT", "/api/sesiones/no-existe", { temas: "X" });
    const res = await PUT(req, { params: Promise.resolve({ id: "no-existe" }) });

    expect(res.status).toBe(404);
  });

  it("retorna 422 con datos inválidos (temas demasiado largos)", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionBecario as never);

    const { obtenerSesionPorId } = await import("@/server/queries/clases");
    vi.mocked(obtenerSesionPorId).mockResolvedValueOnce(sesionMock);

    const { PUT } = await import("@/app/api/sesiones/[id]/route");
    const req = makeRequest("PUT", "/api/sesiones/sesion-1", {
      temas: "T".repeat(501),
    });
    const res = await PUT(req, { params: Promise.resolve({ id: "sesion-1" }) });

    expect(res.status).toBe(422);
  });
});

// ── DELETE /api/sesiones/[id] ─────────────────────────────────────────────────

describe("DELETE /api/sesiones/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retorna 401 cuando no hay sesión activa", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(null as never);

    const { DELETE } = await import("@/app/api/sesiones/[id]/route");
    const req = makeRequest("DELETE", "/api/sesiones/sesion-1");
    const res = await DELETE(req, { params: Promise.resolve({ id: "sesion-1" }) });

    expect(res.status).toBe(401);
  });

  it("retorna 403 cuando el rol no es ADMIN", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionBecario as never);

    const { DELETE } = await import("@/app/api/sesiones/[id]/route");
    const req = makeRequest("DELETE", "/api/sesiones/sesion-1");
    const res = await DELETE(req, { params: Promise.resolve({ id: "sesion-1" }) });

    expect(res.status).toBe(403);
  });

  it("retorna 404 cuando la sesión no existe", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionAdmin as never);

    const { obtenerSesionPorId } = await import("@/server/queries/clases");
    vi.mocked(obtenerSesionPorId).mockResolvedValueOnce(null);

    const { DELETE } = await import("@/app/api/sesiones/[id]/route");
    const req = makeRequest("DELETE", "/api/sesiones/no-existe");
    const res = await DELETE(req, { params: Promise.resolve({ id: "no-existe" }) });

    expect(res.status).toBe(404);
  });

  it("retorna 409 cuando la sesión tiene asistencias registradas", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionAdmin as never);

    const { obtenerSesionPorId, eliminarSesion, SesionConAsistenciasError } =
      await import("@/server/queries/clases");
    vi.mocked(obtenerSesionPorId).mockResolvedValueOnce(sesionMock);
    vi.mocked(eliminarSesion).mockRejectedValueOnce(
      new SesionConAsistenciasError(
        "No se puede eliminar la sesión porque tiene 15 asistencia(s) registrada(s)"
      )
    );

    const { DELETE } = await import("@/app/api/sesiones/[id]/route");
    const req = makeRequest("DELETE", "/api/sesiones/sesion-1");
    const res = await DELETE(req, { params: Promise.resolve({ id: "sesion-1" }) });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/asistencia/i);
  });

  it("retorna 204 cuando la sesión se elimina correctamente", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionAdmin as never);

    const { obtenerSesionPorId, eliminarSesion } = await import("@/server/queries/clases");
    vi.mocked(obtenerSesionPorId).mockResolvedValueOnce(sesionMock);
    vi.mocked(eliminarSesion).mockResolvedValueOnce(sesionMock);

    const { DELETE } = await import("@/app/api/sesiones/[id]/route");
    const req = makeRequest("DELETE", "/api/sesiones/sesion-1");
    const res = await DELETE(req, { params: Promise.resolve({ id: "sesion-1" }) });

    expect(res.status).toBe(204);
  });
});
