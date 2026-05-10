import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────
// IMPORTANT: vi.mock calls are hoisted to the top of the file by Vitest.
// They must be declared before any imports of the mocked modules.

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/server/queries/clases", () => ({
  obtenerSesionPorId: vi.fn(),
}));

vi.mock("@/server/queries/asistencias", () => ({
  obtenerAsistenciasDeSesion: vi.fn(),
  obtenerResumenAsistencia:   vi.fn(),
  batchUpsertAsistencias:     vi.fn(),
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

const sesionMock = {
  id:              "sesion-1",
  claseId:         "clase-1",
  fecha:           new Date("2025-03-15T10:00:00.000Z"),
  temas:           "Sistema solar",
  notas:           null,
  registradaPorId: null,
  createdAt:       new Date("2025-03-01T00:00:00.000Z"),
  _count:          { asistencias: 2 },
};

const asistenciasMock = [
  {
    inscripcion: {
      id:          "inscripcion-1",
      participante: { nombre: "Ana", apellidos: "López", escuela: "Primaria Centro" },
    },
    presente: true,
  },
  {
    inscripcion: {
      id:          "inscripcion-2",
      participante: { nombre: "Luis", apellidos: "Torres", escuela: "Primaria Norte" },
    },
    presente: null,
  },
];

const resumenMock = { total: 2, presentes: 1, ausentes: 1 };

// ID válido en formato cuid
const CUID1 = "clxyz1234567890abcdef0001";
const CUID2 = "clxyz1234567890abcdef0002";

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

// ── GET /api/sesiones/[id]/asistencia ─────────────────────────────────────────

describe("GET /api/sesiones/[id]/asistencia", () => {
  beforeEach(() => vi.clearAllMocks());

  it("responde 401 cuando no hay sesión activa", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(null as never);

    const { GET } = await import("@/app/api/sesiones/[id]/asistencia/route");
    const req = makeRequest("GET", "/api/sesiones/sesion-1/asistencia");
    const res = await GET(req, { params: Promise.resolve({ id: "sesion-1" }) });

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toMatch(/no autorizado/i);
  });

  it("responde 404 cuando la sesión no existe", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionAdmin as never);

    const { obtenerSesionPorId } = await import("@/server/queries/clases");
    vi.mocked(obtenerSesionPorId).mockResolvedValueOnce(null);

    const { GET } = await import("@/app/api/sesiones/[id]/asistencia/route");
    const req = makeRequest("GET", "/api/sesiones/no-existe/asistencia");
    const res = await GET(req, { params: Promise.resolve({ id: "no-existe" }) });

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toMatch(/sesión no encontrada/i);
  });

  it("responde 200 con lista de asistencias y resumen (rol ADMIN)", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionAdmin as never);

    const { obtenerSesionPorId } = await import("@/server/queries/clases");
    vi.mocked(obtenerSesionPorId).mockResolvedValueOnce(sesionMock as never);

    const { obtenerAsistenciasDeSesion, obtenerResumenAsistencia } =
      await import("@/server/queries/asistencias");
    vi.mocked(obtenerAsistenciasDeSesion).mockResolvedValueOnce(asistenciasMock);
    vi.mocked(obtenerResumenAsistencia).mockResolvedValueOnce(resumenMock);

    const { GET } = await import("@/app/api/sesiones/[id]/asistencia/route");
    const req = makeRequest("GET", "/api/sesiones/sesion-1/asistencia");
    const res = await GET(req, { params: Promise.resolve({ id: "sesion-1" }) });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.asistencias)).toBe(true);
    expect(json.asistencias).toHaveLength(2);
    expect(json.asistencias[0].presente).toBe(true);
    expect(json.asistencias[1].presente).toBeNull();
    expect(json.resumen.total).toBe(2);
    expect(json.resumen.presentes).toBe(1);
    expect(json.resumen.ausentes).toBe(1);
  });

  it("responde 200 con lista vacía cuando no hay inscripciones", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionReadonly as never);

    const { obtenerSesionPorId } = await import("@/server/queries/clases");
    vi.mocked(obtenerSesionPorId).mockResolvedValueOnce(sesionMock as never);

    const { obtenerAsistenciasDeSesion, obtenerResumenAsistencia } =
      await import("@/server/queries/asistencias");
    vi.mocked(obtenerAsistenciasDeSesion).mockResolvedValueOnce([]);
    vi.mocked(obtenerResumenAsistencia).mockResolvedValueOnce({ total: 0, presentes: 0, ausentes: 0 });

    const { GET } = await import("@/app/api/sesiones/[id]/asistencia/route");
    const req = makeRequest("GET", "/api/sesiones/sesion-1/asistencia");
    const res = await GET(req, { params: Promise.resolve({ id: "sesion-1" }) });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.asistencias).toHaveLength(0);
    expect(json.resumen.total).toBe(0);
  });

  it("responde 200 para cualquier rol autenticado (READONLY puede consultar)", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionReadonly as never);

    const { obtenerSesionPorId } = await import("@/server/queries/clases");
    vi.mocked(obtenerSesionPorId).mockResolvedValueOnce(sesionMock as never);

    const { obtenerAsistenciasDeSesion, obtenerResumenAsistencia } =
      await import("@/server/queries/asistencias");
    vi.mocked(obtenerAsistenciasDeSesion).mockResolvedValueOnce(asistenciasMock);
    vi.mocked(obtenerResumenAsistencia).mockResolvedValueOnce(resumenMock);

    const { GET } = await import("@/app/api/sesiones/[id]/asistencia/route");
    const req = makeRequest("GET", "/api/sesiones/sesion-1/asistencia");
    const res = await GET(req, { params: Promise.resolve({ id: "sesion-1" }) });

    expect(res.status).toBe(200);
  });
});

// ── POST /api/asistencias ─────────────────────────────────────────────────────

describe("POST /api/asistencias", () => {
  beforeEach(() => vi.clearAllMocks());

  const itemsValidos = [
    { inscripcionId: CUID1, sesionId: CUID2, presente: true },
  ];

  it("responde 401 cuando no hay sesión activa", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(null as never);

    const { POST } = await import("@/app/api/asistencias/route");
    const req = makeRequest("POST", "/api/asistencias", { items: itemsValidos });
    const res = await POST(req as never);

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toMatch(/no autorizado/i);
  });

  it("responde 403 cuando el rol es READONLY", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionReadonly as never);

    const { POST } = await import("@/app/api/asistencias/route");
    const req = makeRequest("POST", "/api/asistencias", { items: itemsValidos });
    const res = await POST(req as never);

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toMatch(/permiso insuficiente/i);
  });

  it("responde 422 cuando items está vacío", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionBecario as never);

    const { POST } = await import("@/app/api/asistencias/route");
    const req = makeRequest("POST", "/api/asistencias", { items: [] });
    const res = await POST(req as never);

    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error).toMatch(/inválidos/i);
    expect(json.detalles).toBeDefined();
  });

  it("responde 422 cuando un item tiene inscripcionId inválido", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionAdmin as never);

    const { POST } = await import("@/app/api/asistencias/route");
    const req = makeRequest("POST", "/api/asistencias", {
      items: [{ inscripcionId: "no-es-cuid", sesionId: CUID2, presente: true }],
    });
    const res = await POST(req as never);

    expect(res.status).toBe(422);
  });

  it("responde 422 cuando falta el campo items en el body", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionAdmin as never);

    const { POST } = await import("@/app/api/asistencias/route");
    const req = makeRequest("POST", "/api/asistencias", {});
    const res = await POST(req as never);

    expect(res.status).toBe(422);
  });

  it("responde 201 con { updated } en batch exitoso (BECARIO)", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionBecario as never);

    const { batchUpsertAsistencias } = await import("@/server/queries/asistencias");
    vi.mocked(batchUpsertAsistencias).mockResolvedValueOnce([
      {
        id: "a1", inscripcionId: CUID1, sesionId: CUID2,
        presente: true, createdAt: new Date(),
      },
    ] as never);

    const { POST } = await import("@/app/api/asistencias/route");
    const req = makeRequest("POST", "/api/asistencias", { items: itemsValidos });
    const res = await POST(req as never);

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.updated).toBe(1);
  });

  it("responde 201 con { updated } en batch exitoso (ADMIN, múltiples items)", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionAdmin as never);

    const items = [
      { inscripcionId: CUID1, sesionId: CUID2, presente: true },
      { inscripcionId: "clxyz1234567890abcdef0003", sesionId: CUID2, presente: false },
    ];

    const { batchUpsertAsistencias } = await import("@/server/queries/asistencias");
    vi.mocked(batchUpsertAsistencias).mockResolvedValueOnce([
      { id: "a1", inscripcionId: CUID1, sesionId: CUID2, presente: true, createdAt: new Date() },
      { id: "a2", inscripcionId: "clxyz1234567890abcdef0003", sesionId: CUID2, presente: false, createdAt: new Date() },
    ] as never);

    const { POST } = await import("@/app/api/asistencias/route");
    const req = makeRequest("POST", "/api/asistencias", { items });
    const res = await POST(req as never);

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.updated).toBe(2);
  });
});
