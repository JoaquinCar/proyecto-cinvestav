import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/server/queries/historico", () => ({
  obtenerHistoricoEdiciones: vi.fn(),
  obtenerEscuelasRecurrentes: vi.fn(),
  obtenerParticipantesRecurrentes: vi.fn(),
}));

const sessionAdmin    = { user: { id: "u1", email: "a@c.mx", role: "ADMIN",    name: "A", image: null } };
const sessionReadonly = { user: { id: "u3", email: "r@c.mx", role: "READONLY", name: "R", image: null } };

const edicionesMock = [
  { anio: 2024, nombre: "Pasaporte 2024", totalParticipantes: 40, totalSesiones: 10, promedioAsistencia: 70 },
  { anio: 2025, nombre: "Pasaporte 2025", totalParticipantes: 55, totalSesiones: 12, promedioAsistencia: 75 },
];
const escuelasMock = [{ escuela: "Primaria Centro", ediciones: 2, totalParticipantes: 15 }];
const participantesMock = [{ id: "p1", nombre: "Ana", apellidos: "García", escuela: "Primaria", ediciones: 2 }];

function req(): Request {
  return new Request("http://localhost/api/estadisticas/historico", { method: "GET" });
}

describe("GET /api/estadisticas/historico", () => {
  beforeEach(() => vi.clearAllMocks());

  it("401 sin sesión", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(null as never);
    const { GET } = await import("@/app/api/estadisticas/historico/route");
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("200 retorna histórico para READONLY", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionReadonly as never);
    const {
      obtenerHistoricoEdiciones,
      obtenerEscuelasRecurrentes,
      obtenerParticipantesRecurrentes,
    } = await import("@/server/queries/historico");
    vi.mocked(obtenerHistoricoEdiciones).mockResolvedValueOnce(edicionesMock);
    vi.mocked(obtenerEscuelasRecurrentes).mockResolvedValueOnce(escuelasMock);
    vi.mocked(obtenerParticipantesRecurrentes).mockResolvedValueOnce(participantesMock);
    const { GET } = await import("@/app/api/estadisticas/historico/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ediciones).toHaveLength(2);
    expect(json.ediciones[1].totalParticipantes).toBe(55);
    expect(json.escuelas).toHaveLength(1);
    expect(json.participantes).toHaveLength(1);
  });

  it("200 retorna histórico para ADMIN", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionAdmin as never);
    const {
      obtenerHistoricoEdiciones,
      obtenerEscuelasRecurrentes,
      obtenerParticipantesRecurrentes,
    } = await import("@/server/queries/historico");
    vi.mocked(obtenerHistoricoEdiciones).mockResolvedValueOnce(edicionesMock);
    vi.mocked(obtenerEscuelasRecurrentes).mockResolvedValueOnce(escuelasMock);
    vi.mocked(obtenerParticipantesRecurrentes).mockResolvedValueOnce(participantesMock);
    const { GET } = await import("@/app/api/estadisticas/historico/route");
    const res = await GET();
    expect(res.status).toBe(200);
  });
});
