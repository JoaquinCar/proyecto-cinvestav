import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextResponse } from "next/server";

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Mock de auth (NextAuth v5)
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

// Mock de queries de ediciones
vi.mock("@/server/queries/ediciones", () => ({
  listarEdiciones: vi.fn(),
  crearEdicion: vi.fn(),
  obtenerEdicionPorId: vi.fn(),
  editarEdicion: vi.fn(),
  eliminarEdicion: vi.fn(),
  activarEdicion: vi.fn(),
  existeEdicion: vi.fn(),
  EdicionConInscripcionesError: class EdicionConInscripcionesError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "EdicionConInscripcionesError";
    }
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const sessionAdmin = {
  user: { id: "user-1", email: "admin@cinvestav.mx", role: "ADMIN", name: "Admin", image: null },
};

const sessionBecario = {
  user: { id: "user-2", email: "becario@cinvestav.mx", role: "BECARIO", name: "Becario", image: null },
};

const edicionMock = {
  id: "edicion-1",
  anio: 2025,
  nombre: "Pasaporte Científico 2025",
  fechaInicio: new Date("2025-01-15T09:00:00.000Z"),
  fechaFin: new Date("2025-06-30T18:00:00.000Z"),
  minAsistencias: 5,
  porcentajeMinimo: null,
  asistenciaGlobal: true,
  activa: true,
  createdAt: new Date("2025-01-01T00:00:00.000Z"),
  _count: { inscripciones: 0, clases: 3 },
};

function makeRequest(body?: unknown, method = "GET"): Request {
  return new Request("http://localhost/api/ediciones", {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

// ── Tests: GET /api/ediciones ─────────────────────────────────────────────────

describe("GET /api/ediciones", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna 401 cuando no hay sesión activa", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(null as never);

    const { GET } = await import("@/app/api/ediciones/route");
    const response = await GET();

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toEqual({ error: "No autorizado" });
  });

  it("retorna 200 con lista de ediciones para sesión válida", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionAdmin as never);

    const { listarEdiciones } = await import("@/server/queries/ediciones");
    vi.mocked(listarEdiciones).mockResolvedValueOnce([edicionMock]);

    const { GET } = await import("@/app/api/ediciones/route");
    const response = await GET();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);
    expect(body[0].anio).toBe(2025);
  });

  it("retorna 200 con lista de ediciones para sesión BECARIO", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionBecario as never);

    const { listarEdiciones } = await import("@/server/queries/ediciones");
    vi.mocked(listarEdiciones).mockResolvedValueOnce([edicionMock]);

    const { GET } = await import("@/app/api/ediciones/route");
    const response = await GET();

    expect(response.status).toBe(200);
  });

  it("retorna 200 con arreglo vacío cuando no hay ediciones", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionAdmin as never);

    const { listarEdiciones } = await import("@/server/queries/ediciones");
    vi.mocked(listarEdiciones).mockResolvedValueOnce([]);

    const { GET } = await import("@/app/api/ediciones/route");
    const response = await GET();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual([]);
  });
});

// ── Tests: POST /api/ediciones ────────────────────────────────────────────────

describe("POST /api/ediciones", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna 401 cuando no hay sesión activa", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(null as never);

    const { POST } = await import("@/app/api/ediciones/route");
    const request = makeRequest({ anio: 2025, nombre: "Test" }, "POST");
    const response = await POST(request);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toEqual({ error: "No autorizado" });
  });

  it("retorna 403 cuando el rol no es ADMIN", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionBecario as never);

    const { POST } = await import("@/app/api/ediciones/route");
    const request = makeRequest({ anio: 2025 }, "POST");
    const response = await POST(request);

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body).toEqual({ error: "Prohibido" });
  });

  it("retorna 422 cuando el body tiene datos inválidos", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionAdmin as never);

    const { POST } = await import("@/app/api/ediciones/route");
    // Falta nombre, fechas inválidas
    const request = makeRequest(
      { anio: 999, nombre: "" },
      "POST"
    );
    const response = await POST(request);

    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error).toBe("Datos inválidos");
    expect(body.details).toBeDefined();
  });

  it("retorna 201 con la edición creada cuando los datos son válidos", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionAdmin as never);

    const { crearEdicion } = await import("@/server/queries/ediciones");
    vi.mocked(crearEdicion).mockResolvedValueOnce(edicionMock);

    const { POST } = await import("@/app/api/ediciones/route");
    const request = makeRequest(
      {
        anio: 2025,
        nombre: "Pasaporte Científico 2025",
        fechaInicio: "2025-01-15T09:00:00.000Z",
        fechaFin: "2025-06-30T18:00:00.000Z",
      },
      "POST"
    );
    const response = await POST(request);

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.anio).toBe(2025);
    expect(body.nombre).toBe("Pasaporte Científico 2025");
  });

  it("retorna 409 cuando ya existe una edición con ese año", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionAdmin as never);

    const { crearEdicion } = await import("@/server/queries/ediciones");
    vi.mocked(crearEdicion).mockRejectedValueOnce(
      new Error("Unique constraint failed on the fields: (`anio`)")
    );

    const { POST } = await import("@/app/api/ediciones/route");
    const request = makeRequest(
      {
        anio: 2025,
        nombre: "Pasaporte Científico 2025",
        fechaInicio: "2025-01-15T09:00:00.000Z",
        fechaFin: "2025-06-30T18:00:00.000Z",
      },
      "POST"
    );
    const response = await POST(request);

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error).toMatch(/ya existe/i);
  });
});

// ── Tests: GET /api/ediciones/[id] ───────────────────────────────────────────

describe("GET /api/ediciones/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna 401 cuando no hay sesión activa", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(null as never);

    const { GET } = await import("@/app/api/ediciones/[id]/route");
    const request = new Request("http://localhost/api/ediciones/edicion-1");
    const response = await GET(request, {
      params: Promise.resolve({ id: "edicion-1" }),
    });

    expect(response.status).toBe(401);
  });

  it("retorna 404 cuando la edición no existe", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionAdmin as never);

    const { obtenerEdicionPorId } = await import("@/server/queries/ediciones");
    vi.mocked(obtenerEdicionPorId).mockResolvedValueOnce(null);

    const { GET } = await import("@/app/api/ediciones/[id]/route");
    const request = new Request("http://localhost/api/ediciones/no-existe");
    const response = await GET(request, {
      params: Promise.resolve({ id: "no-existe" }),
    });

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toMatch(/no encontrada/i);
  });

  it("retorna 200 con la edición cuando existe", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionAdmin as never);

    const { obtenerEdicionPorId } = await import("@/server/queries/ediciones");
    vi.mocked(obtenerEdicionPorId).mockResolvedValueOnce(edicionMock);

    const { GET } = await import("@/app/api/ediciones/[id]/route");
    const request = new Request("http://localhost/api/ediciones/edicion-1");
    const response = await GET(request, {
      params: Promise.resolve({ id: "edicion-1" }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.id).toBe("edicion-1");
    expect(body._count.inscripciones).toBe(0);
    expect(body._count.clases).toBe(3);
  });
});

// ── Tests: PUT /api/ediciones/[id] ───────────────────────────────────────────

describe("PUT /api/ediciones/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna 401 cuando no hay sesión activa", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(null as never);

    const { PUT } = await import("@/app/api/ediciones/[id]/route");
    const request = new Request("http://localhost/api/ediciones/edicion-1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: "Nuevo nombre" }),
    });
    const response = await PUT(request, {
      params: Promise.resolve({ id: "edicion-1" }),
    });

    expect(response.status).toBe(401);
  });

  it("retorna 403 cuando el rol no es ADMIN", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionBecario as never);

    const { PUT } = await import("@/app/api/ediciones/[id]/route");
    const request = new Request("http://localhost/api/ediciones/edicion-1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: "Nuevo nombre" }),
    });
    const response = await PUT(request, {
      params: Promise.resolve({ id: "edicion-1" }),
    });

    expect(response.status).toBe(403);
  });

  it("retorna 404 cuando la edición no existe", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionAdmin as never);

    const { obtenerEdicionPorId } = await import("@/server/queries/ediciones");
    vi.mocked(obtenerEdicionPorId).mockResolvedValueOnce(null);

    const { PUT } = await import("@/app/api/ediciones/[id]/route");
    const request = new Request("http://localhost/api/ediciones/no-existe", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: "Nuevo nombre" }),
    });
    const response = await PUT(request, {
      params: Promise.resolve({ id: "no-existe" }),
    });

    expect(response.status).toBe(404);
  });

  it("retorna 200 con la edición actualizada cuando los datos son válidos", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionAdmin as never);

    const { obtenerEdicionPorId, editarEdicion } = await import(
      "@/server/queries/ediciones"
    );
    vi.mocked(obtenerEdicionPorId).mockResolvedValueOnce(edicionMock);
    vi.mocked(editarEdicion).mockResolvedValueOnce({
      ...edicionMock,
      nombre: "Nombre actualizado",
    });

    const { PUT } = await import("@/app/api/ediciones/[id]/route");
    const request = new Request("http://localhost/api/ediciones/edicion-1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: "Nombre actualizado" }),
    });
    const response = await PUT(request, {
      params: Promise.resolve({ id: "edicion-1" }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.nombre).toBe("Nombre actualizado");
  });

  it("retorna 422 con datos inválidos en la edición parcial", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionAdmin as never);

    const { obtenerEdicionPorId } = await import("@/server/queries/ediciones");
    vi.mocked(obtenerEdicionPorId).mockResolvedValueOnce(edicionMock);

    const { PUT } = await import("@/app/api/ediciones/[id]/route");
    const request = new Request("http://localhost/api/ediciones/edicion-1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: "" }), // nombre vacío no permitido
    });
    const response = await PUT(request, {
      params: Promise.resolve({ id: "edicion-1" }),
    });

    expect(response.status).toBe(422);
  });
});

// ── Tests: DELETE /api/ediciones/[id] ────────────────────────────────────────

describe("DELETE /api/ediciones/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna 401 cuando no hay sesión activa", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(null as never);

    const { DELETE } = await import("@/app/api/ediciones/[id]/route");
    const request = new Request("http://localhost/api/ediciones/edicion-1", {
      method: "DELETE",
    });
    const response = await DELETE(request, {
      params: Promise.resolve({ id: "edicion-1" }),
    });

    expect(response.status).toBe(401);
  });

  it("retorna 403 cuando el rol no es ADMIN", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionBecario as never);

    const { DELETE } = await import("@/app/api/ediciones/[id]/route");
    const request = new Request("http://localhost/api/ediciones/edicion-1", {
      method: "DELETE",
    });
    const response = await DELETE(request, {
      params: Promise.resolve({ id: "edicion-1" }),
    });

    expect(response.status).toBe(403);
  });

  it("retorna 404 cuando la edición no existe", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionAdmin as never);

    const { obtenerEdicionPorId } = await import("@/server/queries/ediciones");
    vi.mocked(obtenerEdicionPorId).mockResolvedValueOnce(null);

    const { DELETE } = await import("@/app/api/ediciones/[id]/route");
    const request = new Request("http://localhost/api/ediciones/no-existe", {
      method: "DELETE",
    });
    const response = await DELETE(request, {
      params: Promise.resolve({ id: "no-existe" }),
    });

    expect(response.status).toBe(404);
  });

  it("retorna 409 cuando la edición tiene inscripciones", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionAdmin as never);

    const { obtenerEdicionPorId, eliminarEdicion, EdicionConInscripcionesError } =
      await import("@/server/queries/ediciones");
    vi.mocked(obtenerEdicionPorId).mockResolvedValueOnce(edicionMock);
    vi.mocked(eliminarEdicion).mockRejectedValueOnce(
      new EdicionConInscripcionesError(
        "No se puede eliminar la edición porque tiene 10 inscripción(es) registrada(s)"
      )
    );

    const { DELETE } = await import("@/app/api/ediciones/[id]/route");
    const request = new Request("http://localhost/api/ediciones/edicion-1", {
      method: "DELETE",
    });
    const response = await DELETE(request, {
      params: Promise.resolve({ id: "edicion-1" }),
    });

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error).toMatch(/inscripción/i);
  });

  it("retorna 204 cuando la edición se elimina correctamente", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionAdmin as never);

    const { obtenerEdicionPorId, eliminarEdicion } = await import(
      "@/server/queries/ediciones"
    );
    vi.mocked(obtenerEdicionPorId).mockResolvedValueOnce(edicionMock);
    vi.mocked(eliminarEdicion).mockResolvedValueOnce(edicionMock);

    const { DELETE } = await import("@/app/api/ediciones/[id]/route");
    const request = new Request("http://localhost/api/ediciones/edicion-1", {
      method: "DELETE",
    });
    const response = await DELETE(request, {
      params: Promise.resolve({ id: "edicion-1" }),
    });

    expect(response.status).toBe(204);
  });
});

// ── Tests: PUT /api/ediciones/[id]/activar ───────────────────────────────────

describe("PUT /api/ediciones/[id]/activar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna 401 cuando no hay sesión activa", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(null as never);

    const { PUT } = await import("@/app/api/ediciones/[id]/activar/route");
    const request = new Request(
      "http://localhost/api/ediciones/edicion-1/activar",
      { method: "PUT" }
    );
    const response = await PUT(request, {
      params: Promise.resolve({ id: "edicion-1" }),
    });

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toEqual({ error: "No autorizado" });
  });

  it("retorna 403 cuando el rol no es ADMIN", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionBecario as never);

    const { PUT } = await import("@/app/api/ediciones/[id]/activar/route");
    const request = new Request(
      "http://localhost/api/ediciones/edicion-1/activar",
      { method: "PUT" }
    );
    const response = await PUT(request, {
      params: Promise.resolve({ id: "edicion-1" }),
    });

    expect(response.status).toBe(403);
  });

  it("retorna 404 cuando la edición no existe", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionAdmin as never);

    const { obtenerEdicionPorId } = await import("@/server/queries/ediciones");
    vi.mocked(obtenerEdicionPorId).mockResolvedValueOnce(null);

    const { PUT } = await import("@/app/api/ediciones/[id]/activar/route");
    const request = new Request(
      "http://localhost/api/ediciones/no-existe/activar",
      { method: "PUT" }
    );
    const response = await PUT(request, {
      params: Promise.resolve({ id: "no-existe" }),
    });

    expect(response.status).toBe(404);
  });

  it("retorna 200 con la edición activada y desactiva las demás (via activarEdicion)", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionAdmin as never);

    const { obtenerEdicionPorId, activarEdicion } = await import(
      "@/server/queries/ediciones"
    );
    vi.mocked(obtenerEdicionPorId).mockResolvedValueOnce(edicionMock);
    vi.mocked(activarEdicion).mockResolvedValueOnce({
      ...edicionMock,
      activa: true,
    });

    const { PUT } = await import("@/app/api/ediciones/[id]/activar/route");
    const request = new Request(
      "http://localhost/api/ediciones/edicion-1/activar",
      { method: "PUT" }
    );
    const response = await PUT(request, {
      params: Promise.resolve({ id: "edicion-1" }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.activa).toBe(true);

    // Verificar que se llamó a activarEdicion con el ID correcto
    expect(activarEdicion).toHaveBeenCalledWith("edicion-1");
  });
});
