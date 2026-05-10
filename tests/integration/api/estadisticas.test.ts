import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/server/queries/estadisticas", () => ({
  obtenerMetricasEdicion: vi.fn(),
  obtenerDatosExcel: vi.fn(),
}));

const sessionAdmin = {
  user: { id: "u1", email: "a@c.mx", role: "ADMIN", name: "A", image: null },
};
const sessionReadonly = {
  user: { id: "u3", email: "r@c.mx", role: "READONLY", name: "R", image: null },
};

const metricasMock = {
  totalParticipantes: 30,
  totalSesiones: 12,
  promedioAsistencia: 75,
  totalConstancias: 20,
  porEscuela: [{ escuela: "Primaria Centro", cantidad: 10 }],
  porGrado: [{ grado: "3°", cantidad: 15 }],
  clasesResumen: [{ nombre: "Astronomía", sesiones: 4, asistenciaPromedio: 80 }],
};

function req(method: string, path: string): Request {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
  });
}

// ── GET /api/estadisticas/edicion/[id] ────────────────────────────────────────

describe("GET /api/estadisticas/edicion/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("401 sin sesión", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(null as never);
    const { GET } = await import("@/app/api/estadisticas/edicion/[id]/route");
    const res = await GET(req("GET", "/api/estadisticas/edicion/ed-1"), {
      params: Promise.resolve({ id: "ed-1" }),
    });
    expect(res.status).toBe(401);
  });

  it("200 retorna métricas para READONLY", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionReadonly as never);
    const { obtenerMetricasEdicion } = await import(
      "@/server/queries/estadisticas"
    );
    vi.mocked(obtenerMetricasEdicion).mockResolvedValueOnce(metricasMock);
    const { GET } = await import("@/app/api/estadisticas/edicion/[id]/route");
    const res = await GET(req("GET", "/api/estadisticas/edicion/ed-1"), {
      params: Promise.resolve({ id: "ed-1" }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.metricas.totalParticipantes).toBe(30);
    expect(json.metricas.promedioAsistencia).toBe(75);
    expect(json.metricas.porEscuela).toHaveLength(1);
  });

  it("200 retorna métricas para ADMIN", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionAdmin as never);
    const { obtenerMetricasEdicion } = await import(
      "@/server/queries/estadisticas"
    );
    vi.mocked(obtenerMetricasEdicion).mockResolvedValueOnce(metricasMock);
    const { GET } = await import("@/app/api/estadisticas/edicion/[id]/route");
    const res = await GET(req("GET", "/api/estadisticas/edicion/ed-1"), {
      params: Promise.resolve({ id: "ed-1" }),
    });
    expect(res.status).toBe(200);
  });
});

// ── GET /api/exportar/excel/[edicionId] ───────────────────────────────────────

describe("GET /api/exportar/excel/[edicionId]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("401 sin sesión", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(null as never);
    const { GET } = await import(
      "@/app/api/exportar/excel/[edicionId]/route"
    );
    const res = await GET(req("GET", "/api/exportar/excel/ed-1"), {
      params: Promise.resolve({ edicionId: "ed-1" }),
    });
    expect(res.status).toBe(401);
  });

  it("403 para READONLY", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionReadonly as never);
    const { GET } = await import(
      "@/app/api/exportar/excel/[edicionId]/route"
    );
    const res = await GET(req("GET", "/api/exportar/excel/ed-1"), {
      params: Promise.resolve({ edicionId: "ed-1" }),
    });
    expect(res.status).toBe(403);
  });

  it("200 retorna xlsx con content-type correcto para ADMIN", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionAdmin as never);
    const { obtenerDatosExcel } = await import(
      "@/server/queries/estadisticas"
    );
    vi.mocked(obtenerDatosExcel).mockResolvedValueOnce([
      {
        Nombre: "Ana",
        Apellidos: "García",
        Escuela: "Primaria",
        Grado: "3°",
        Edad: 9,
        Asistencias: 5,
        Constancia: "Sí",
      },
    ]);
    const { GET } = await import(
      "@/app/api/exportar/excel/[edicionId]/route"
    );
    const res = await GET(req("GET", "/api/exportar/excel/ed-1"), {
      params: Promise.resolve({ edicionId: "ed-1" }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/spreadsheetml/);
    expect(res.headers.get("content-disposition")).toMatch(/attachment/);
  });
});
