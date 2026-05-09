import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/server/queries/constancias", () => ({
  verificarElegibilidad: vi.fn(),
  generarYGuardarConstancia: vi.fn(),
}));

const sessionAdmin = {
  user: { id: "u1", email: "a@cinvestav.mx", role: "ADMIN", name: "Admin", image: null },
};
const sessionBecario = {
  user: { id: "u2", email: "b@cinvestav.mx", role: "BECARIO", name: "Becario", image: null },
};
const sessionReadonly = {
  user: { id: "u3", email: "r@cinvestav.mx", role: "READONLY", name: "Readonly", image: null },
};

const elegibleMock = {
  elegible: true,
  asistencias: 7,
  minimo: 5,
  constanciaUrl: null,
  constanciaGenerada: false,
  modo: "global" as const,
};
const noElegibleMock = { ...elegibleMock, elegible: false, asistencias: 2 };

function req(method: string, id = "insc-1"): Request {
  return new Request(`http://localhost/api/pdf/constancia/${id}`, {
    method,
    headers: { "Content-Type": "application/json" },
  });
}

// ── GET ───────────────────────────────────────────────────────────────────────

describe("GET /api/pdf/constancia/[inscripcionId]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("401 sin sesión", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(null as never);
    const { GET } = await import(
      "@/app/api/pdf/constancia/[inscripcionId]/route"
    );
    const res = await GET(req("GET"), {
      params: Promise.resolve({ inscripcionId: "insc-1" }),
    });
    expect(res.status).toBe(401);
  });

  it("404 cuando inscripción no existe", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionAdmin as never);
    const { verificarElegibilidad } = await import(
      "@/server/queries/constancias"
    );
    vi.mocked(verificarElegibilidad).mockResolvedValueOnce(null);
    const { GET } = await import(
      "@/app/api/pdf/constancia/[inscripcionId]/route"
    );
    const res = await GET(req("GET", "no-existe"), {
      params: Promise.resolve({ inscripcionId: "no-existe" }),
    });
    expect(res.status).toBe(404);
  });

  it("200 retorna elegibilidad para READONLY", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionReadonly as never);
    const { verificarElegibilidad } = await import(
      "@/server/queries/constancias"
    );
    vi.mocked(verificarElegibilidad).mockResolvedValueOnce(elegibleMock);
    const { GET } = await import(
      "@/app/api/pdf/constancia/[inscripcionId]/route"
    );
    const res = await GET(req("GET"), {
      params: Promise.resolve({ inscripcionId: "insc-1" }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.elegible).toBe(true);
    expect(json.asistencias).toBe(7);
    expect(json.minimo).toBe(5);
  });
});

// ── POST ──────────────────────────────────────────────────────────────────────

describe("POST /api/pdf/constancia/[inscripcionId]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("401 sin sesión", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(null as never);
    const { POST } = await import(
      "@/app/api/pdf/constancia/[inscripcionId]/route"
    );
    const res = await POST(req("POST"), {
      params: Promise.resolve({ inscripcionId: "insc-1" }),
    });
    expect(res.status).toBe(401);
  });

  it("403 para rol READONLY", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionReadonly as never);
    const { POST } = await import(
      "@/app/api/pdf/constancia/[inscripcionId]/route"
    );
    const res = await POST(req("POST"), {
      params: Promise.resolve({ inscripcionId: "insc-1" }),
    });
    expect(res.status).toBe(403);
  });

  it("404 inscripción no existe", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionAdmin as never);
    const { verificarElegibilidad } = await import(
      "@/server/queries/constancias"
    );
    vi.mocked(verificarElegibilidad).mockResolvedValueOnce(null);
    const { POST } = await import(
      "@/app/api/pdf/constancia/[inscripcionId]/route"
    );
    const res = await POST(req("POST", "no-existe"), {
      params: Promise.resolve({ inscripcionId: "no-existe" }),
    });
    expect(res.status).toBe(404);
  });

  it("422 si participante no cumple asistencias", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionAdmin as never);
    const { verificarElegibilidad } = await import(
      "@/server/queries/constancias"
    );
    vi.mocked(verificarElegibilidad).mockResolvedValueOnce(noElegibleMock);
    const { POST } = await import(
      "@/app/api/pdf/constancia/[inscripcionId]/route"
    );
    const res = await POST(req("POST"), {
      params: Promise.resolve({ inscripcionId: "insc-1" }),
    });
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error).toMatch(/mínimo/i);
  });

  it("201 genera constancia para ADMIN elegible", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionAdmin as never);
    const { verificarElegibilidad, generarYGuardarConstancia } = await import(
      "@/server/queries/constancias"
    );
    vi.mocked(verificarElegibilidad).mockResolvedValueOnce(elegibleMock);
    vi.mocked(generarYGuardarConstancia).mockResolvedValueOnce({
      url: "https://sb.co/constancias/ed-1/insc-1.pdf",
    });
    const { POST } = await import(
      "@/app/api/pdf/constancia/[inscripcionId]/route"
    );
    const res = await POST(req("POST"), {
      params: Promise.resolve({ inscripcionId: "insc-1" }),
    });
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.url).toMatch(/\.pdf$/);
  });

  it("201 genera constancia para BECARIO elegible", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionBecario as never);
    const { verificarElegibilidad, generarYGuardarConstancia } = await import(
      "@/server/queries/constancias"
    );
    vi.mocked(verificarElegibilidad).mockResolvedValueOnce(elegibleMock);
    vi.mocked(generarYGuardarConstancia).mockResolvedValueOnce({
      url: "https://sb.co/constancias/ed-1/insc-1.pdf",
    });
    const { POST } = await import(
      "@/app/api/pdf/constancia/[inscripcionId]/route"
    );
    const res = await POST(req("POST"), {
      params: Promise.resolve({ inscripcionId: "insc-1" }),
    });
    expect(res.status).toBe(201);
  });
});
