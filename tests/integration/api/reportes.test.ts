import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/server/queries/reportes", () => ({
  obtenerDatosReporteClase: vi.fn(),
}));
vi.mock("@/lib/pdf/reporte-clase", () => ({
  generarPDFReporteClase: vi.fn(),
}));

const sessionAdmin    = { user: { id: "u1", email: "a@c.mx", role: "ADMIN",    name: "A", image: null } };
const sessionReadonly = { user: { id: "u3", email: "r@c.mx", role: "READONLY", name: "R", image: null } };

const datosMock = {
  clase: { nombre: "Astronomía", investigador: "Dr. Pérez" },
  edicion: { nombre: "Pasaporte", anio: 2026 },
  sesiones: [{ fecha: "3 mar 2026", temas: "Sistema solar", asistentes: 5, total: 8 }],
  participantes: [{ nombre: "Ana", apellidos: "García", escuela: "Primaria", asistenciasEnClase: 1 }],
  totalParticipantes: 8,
  promedioAsistencia: 63,
};

const fakeBuffer = Buffer.from("%PDF-1.4 fake");

function req(claseId = "clase-1"): Request {
  return new Request(`http://localhost/api/pdf/reporte-clase/${claseId}`, { method: "GET" });
}

describe("GET /api/pdf/reporte-clase/[claseId]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("401 sin sesión", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(null as never);
    const { GET } = await import("@/app/api/pdf/reporte-clase/[claseId]/route");
    const res = await GET(req(), { params: Promise.resolve({ claseId: "clase-1" }) });
    expect(res.status).toBe(401);
  });

  it("404 clase no existe", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionAdmin as never);
    const { obtenerDatosReporteClase } = await import("@/server/queries/reportes");
    vi.mocked(obtenerDatosReporteClase).mockResolvedValueOnce(null);
    const { GET } = await import("@/app/api/pdf/reporte-clase/[claseId]/route");
    const res = await GET(req("no-existe"), { params: Promise.resolve({ claseId: "no-existe" }) });
    expect(res.status).toBe(404);
  });

  it("200 retorna PDF para ADMIN", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionAdmin as never);
    const { obtenerDatosReporteClase } = await import("@/server/queries/reportes");
    vi.mocked(obtenerDatosReporteClase).mockResolvedValueOnce(datosMock);
    const { generarPDFReporteClase } = await import("@/lib/pdf/reporte-clase");
    vi.mocked(generarPDFReporteClase).mockResolvedValueOnce(fakeBuffer);
    const { GET } = await import("@/app/api/pdf/reporte-clase/[claseId]/route");
    const res = await GET(req(), { params: Promise.resolve({ claseId: "clase-1" }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toMatch(/attachment/);
  });

  it("200 retorna PDF para READONLY (todos pueden descargar)", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionReadonly as never);
    const { obtenerDatosReporteClase } = await import("@/server/queries/reportes");
    vi.mocked(obtenerDatosReporteClase).mockResolvedValueOnce(datosMock);
    const { generarPDFReporteClase } = await import("@/lib/pdf/reporte-clase");
    vi.mocked(generarPDFReporteClase).mockResolvedValueOnce(fakeBuffer);
    const { GET } = await import("@/app/api/pdf/reporte-clase/[claseId]/route");
    const res = await GET(req(), { params: Promise.resolve({ claseId: "clase-1" }) });
    expect(res.status).toBe(200);
  });
});
