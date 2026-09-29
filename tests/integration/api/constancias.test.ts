import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/server/queries/constancias", () => ({
  verificarElegibilidad: vi.fn(),
  generarYGuardarConstancia: vi.fn(),
  // La ruta distingue estos fallos del 500 genérico: el `catch {}` vacío que
  // había antes convertía "falta el espacio de archivos" en "Error interno".
  AlmacenamientoNoConfiguradoError: class AlmacenamientoNoConfiguradoError extends Error {},
  AlmacenamientoNoDisponibleError: class AlmacenamientoNoDisponibleError extends Error {},
  InscripcionNoEncontradaError: class InscripcionNoEncontradaError extends Error {},
  ConstanciaExcluidaError: class ConstanciaExcluidaError extends Error {},
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

const sinExclusion = {
  excluida: false,
  motivo: null,
  fecha: null,
  por: null,
};

const elegibleMock = {
  elegible: true,
  exclusion: sinExclusion,
  cumpleMinimo: true,
  asistencias: 7,
  minimo: 5,
  constanciaUrl: null,
  constanciaGenerada: false,
  modo: "global" as const,
};

// Desde el cambio de política, lo ÚNICO que deja a alguien sin constancia es
// una exclusión puesta a mano por un ADMIN. Quedarse corto de asistencias ya
// no lo hace.
const excluidoMock = {
  ...elegibleMock,
  elegible: false,
  cumpleMinimo: false,
  asistencias: 2,
  exclusion: {
    excluida: true,
    motivo: "Se dio de baja del programa en la segunda sesión",
    fecha: new Date("2026-07-01T18:00:00.000Z"),
    por: { id: "u-admin", name: "Coordinación", email: "admin@cinvestav.mx" },
  },
};

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

  it("201 aunque el participante vaya corto de asistencias: el mínimo ya no decide", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionAdmin as never);
    const { verificarElegibilidad, generarYGuardarConstancia } = await import(
      "@/server/queries/constancias"
    );
    vi.mocked(verificarElegibilidad).mockResolvedValueOnce({
      ...elegibleMock,
      asistencias: 2,
      cumpleMinimo: false,
    });
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

  it("422 si un ADMIN excluyó a ese participante, y dice el motivo", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionAdmin as never);
    const { verificarElegibilidad, generarYGuardarConstancia } = await import(
      "@/server/queries/constancias"
    );
    vi.mocked(verificarElegibilidad).mockResolvedValueOnce(excluidoMock);
    const { POST } = await import(
      "@/app/api/pdf/constancia/[inscripcionId]/route"
    );
    const res = await POST(req("POST"), {
      params: Promise.resolve({ inscripcionId: "insc-1" }),
    });
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error).toMatch(/excluid/i);
    expect(json.error).toMatch(/se dio de baja del programa/i);
    expect(generarYGuardarConstancia).not.toHaveBeenCalled();
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

// ── El almacenamiento de archivos no responde ─────────────────────────────────
// Antes, todo esto salía como 500 "Error interno del servidor" desde un catch
// vacío: ni el cliente sabía qué pasaba ni quedaba nada en el log del servidor.

describe("POST /api/pdf/constancia/[inscripcionId] — almacenamiento caído", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => vi.restoreAllMocks());

  it("503 y explica que falta configurar el almacenamiento", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionAdmin as never);
    const {
      verificarElegibilidad,
      generarYGuardarConstancia,
      AlmacenamientoNoConfiguradoError,
    } = await import("@/server/queries/constancias");
    vi.mocked(verificarElegibilidad).mockResolvedValueOnce(elegibleMock);
    vi.mocked(generarYGuardarConstancia).mockRejectedValueOnce(
      new AlmacenamientoNoConfiguradoError(
        "No se pudo guardar la constancia porque el almacenamiento de archivos no está configurado en el servidor. " +
          "La constancia no quedó guardada. Avisa a quien administra el sistema para que complete esa configuración.",
      ),
    );

    const { POST } = await import(
      "@/app/api/pdf/constancia/[inscripcionId]/route"
    );
    const res = await POST(req("POST"), {
      params: Promise.resolve({ inscripcionId: "insc-1" }),
    });

    // 503, no 500: el problema es del servicio de archivos y tiene arreglo.
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error).toMatch(/no está configurado/i);
    expect(json.error).toMatch(/no quedó guardada/i);
    expect(json.error).not.toBe("Error interno del servidor");
    // Y el motivo real queda en el log del servidor.
    expect(console.error).toHaveBeenCalled();
  });

  it("503 y nombra el espacio de archivos que falta", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionAdmin as never);
    const {
      verificarElegibilidad,
      generarYGuardarConstancia,
      AlmacenamientoNoDisponibleError,
    } = await import("@/server/queries/constancias");
    vi.mocked(verificarElegibilidad).mockResolvedValueOnce(elegibleMock);
    vi.mocked(generarYGuardarConstancia).mockRejectedValueOnce(
      new AlmacenamientoNoDisponibleError(
        'No se pudo guardar la constancia porque el almacenamiento de archivos la rechazó. ' +
          'El PDF se armó bien, pero no quedó guardado ni se marcó como entregada. ' +
          'Avisa a quien administra el sistema y dile esto: el espacio de archivos "constancias" respondió "Bucket not found".',
      ),
    );

    const { POST } = await import(
      "@/app/api/pdf/constancia/[inscripcionId]/route"
    );
    const res = await POST(req("POST"), {
      params: Promise.resolve({ inscripcionId: "insc-1" }),
    });

    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error).toContain("constancias");
    expect(json.error).toContain("Bucket not found");
  });

  it("500 con un fallo imprevisto: sin trazas en pantalla, con registro en el servidor", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionAdmin as never);
    const { verificarElegibilidad, generarYGuardarConstancia } = await import(
      "@/server/queries/constancias"
    );
    vi.mocked(verificarElegibilidad).mockResolvedValueOnce(elegibleMock);
    vi.mocked(generarYGuardarConstancia).mockRejectedValueOnce(
      new Error("ECONNRESET en /Users/qa/src/server/queries/constancias.ts"),
    );

    const { POST } = await import(
      "@/app/api/pdf/constancia/[inscripcionId]/route"
    );
    const res = await POST(req("POST"), {
      params: Promise.resolve({ inscripcionId: "insc-1" }),
    });

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toMatch(/no se pudo generar la constancia/i);
    expect(json.error).toMatch(/no quedó guardada/i);
    expect(json.error).not.toContain("/Users/");
    expect(json.error).not.toContain("ECONNRESET");
    expect(console.error).toHaveBeenCalled();
  });
});
