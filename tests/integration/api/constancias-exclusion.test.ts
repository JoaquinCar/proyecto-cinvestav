import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/constancias/exclusiones — quitar (o devolver) el derecho a constancia.
//
// Es la única puerta que puede dejar a un niño sin constancia, así que es de
// ADMIN y de nadie más: un becario pasa lista, no decide a quién no se le
// entrega el documento. Y no se puede excluir sin escribir por qué.
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/server/queries/constancias", () => ({
  actualizarExclusionConstancia: vi.fn(),
}));

const sessionAdmin = {
  user: { id: "u-admin", email: "admin@cinvestav.mx", role: "ADMIN", name: "Admin", image: null },
};
const sessionBecario = {
  user: { id: "u-becario", email: "becario@cinvestav.mx", role: "BECARIO", name: "Becario", image: null },
};
const sessionReadonly = {
  user: { id: "u-ro", email: "ro@cinvestav.mx", role: "READONLY", name: "Consulta", image: null },
};

function req(body: unknown): Request {
  return new Request("http://localhost/api/constancias/exclusiones", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function put(body: unknown) {
  const { PUT } = await import("@/app/api/constancias/exclusiones/route");
  return PUT(req(body));
}

describe("PUT /api/constancias/exclusiones — permisos", () => {
  beforeEach(() => vi.clearAllMocks());

  it("401 sin sesión", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(null as never);

    const res = await put({ inscripcionIds: ["insc-1"], excluida: true, motivo: "Duplicado" });
    expect(res.status).toBe(401);
  });

  it("403 para BECARIO: pasar lista no es decidir a quién no se le da la constancia", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionBecario as never);

    const res = await put({ inscripcionIds: ["insc-1"], excluida: true, motivo: "Duplicado" });
    expect(res.status).toBe(403);

    const { actualizarExclusionConstancia } = await import(
      "@/server/queries/constancias"
    );
    expect(actualizarExclusionConstancia).not.toHaveBeenCalled();
  });

  it("403 para READONLY", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionReadonly as never);

    const res = await put({ inscripcionIds: ["insc-1"], excluida: true, motivo: "Duplicado" });
    expect(res.status).toBe(403);
  });
});

describe("PUT /api/constancias/exclusiones — validación", () => {
  beforeEach(() => vi.clearAllMocks());

  it("422 al excluir sin motivo", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionAdmin as never);

    const res = await put({ inscripcionIds: ["insc-1"], excluida: true });
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error).toMatch(/motivo/i);

    const { actualizarExclusionConstancia } = await import(
      "@/server/queries/constancias"
    );
    expect(actualizarExclusionConstancia).not.toHaveBeenCalled();
  });

  it("422 sin ninguna inscripción seleccionada", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionAdmin as never);

    const res = await put({ inscripcionIds: [], excluida: false });
    expect(res.status).toBe(422);
  });

  it("400 con un cuerpo ilegible", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionAdmin as never);

    const res = await put("{no es json");
    expect(res.status).toBe(400);
  });
});

describe("PUT /api/constancias/exclusiones — el ADMIN excluye y reincorpora", () => {
  beforeEach(() => vi.clearAllMocks());

  it("200 excluye y deja registrado quién lo hizo", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionAdmin as never);
    const { actualizarExclusionConstancia } = await import(
      "@/server/queries/constancias"
    );
    vi.mocked(actualizarExclusionConstancia).mockResolvedValueOnce({
      actualizadas: 2,
    });

    const res = await put({
      inscripcionIds: ["insc-1", "insc-2"],
      excluida: true,
      motivo: "Se dieron de baja del programa",
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.actualizadas).toBe(2);

    expect(actualizarExclusionConstancia).toHaveBeenCalledWith({
      inscripcionIds: ["insc-1", "insc-2"],
      excluida: true,
      motivo: "Se dieron de baja del programa",
      // El autor sale de la sesión, nunca del cuerpo de la petición.
      usuarioId: "u-admin",
    });
  });

  it("200 reincorpora sin exigir motivo", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionAdmin as never);
    const { actualizarExclusionConstancia } = await import(
      "@/server/queries/constancias"
    );
    vi.mocked(actualizarExclusionConstancia).mockResolvedValueOnce({
      actualizadas: 1,
    });

    const res = await put({ inscripcionIds: ["insc-1"], excluida: false });
    expect(res.status).toBe(200);
    expect(actualizarExclusionConstancia).toHaveBeenCalledWith(
      expect.objectContaining({ excluida: false, usuarioId: "u-admin" }),
    );
  });

  it("404 cuando ninguna de las inscripciones existe ya", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionAdmin as never);
    const { actualizarExclusionConstancia } = await import(
      "@/server/queries/constancias"
    );
    vi.mocked(actualizarExclusionConstancia).mockResolvedValueOnce({
      actualizadas: 0,
    });

    const res = await put({
      inscripcionIds: ["fantasma"],
      excluida: true,
      motivo: "Duplicado del padrón",
    });
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toMatch(/vuelve a cargar/i);
  });
});

describe("PUT /api/constancias/exclusiones — fallo del servidor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it("500 sin filtrar trazas y con registro en el servidor", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionAdmin as never);
    const { actualizarExclusionConstancia } = await import(
      "@/server/queries/constancias"
    );
    vi.mocked(actualizarExclusionConstancia).mockRejectedValueOnce(
      new Error("ECONNRESET en /Users/qa/src/server/queries/constancias.ts"),
    );

    const res = await put({
      inscripcionIds: ["insc-1"],
      excluida: true,
      motivo: "Duplicado del padrón",
    });

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).not.toContain("/Users/");
    expect(json.error).not.toContain("ECONNRESET");
    expect(console.error).toHaveBeenCalled();
  });
});
