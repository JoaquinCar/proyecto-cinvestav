import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks de infraestructura ──────────────────────────────────────────────────

vi.mock("next-auth", () => ({
  default: vi.fn(() => ({
    handlers: { GET: vi.fn(), POST: vi.fn() },
    auth: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
  })),
}));

vi.mock("@auth/prisma-adapter", () => ({
  PrismaAdapter: vi.fn(() => ({})),
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/server/queries/clases", () => ({
  obtenerClasePorId: vi.fn(),
}));

vi.mock("@/server/queries/imagenes-clase", () => ({
  listarImagenesDeClaseConUrl: vi.fn(),
  crearImagenClase: vi.fn(),
  resolverImagenParaVista: vi.fn(),
  obtenerImagenClase: vi.fn(),
  eliminarImagenClase: vi.fn(),
  ImagenNoAlmacenableError: class ImagenNoAlmacenableError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "ImagenNoAlmacenableError";
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

const sessionReadonly = {
  user: { id: "user-3", email: "readonly@cinvestav.mx", role: "READONLY", name: "Readonly", image: null },
};

const claseMock = {
  id: "clase-1",
  edicionId: "edicion-1",
  nombre: "Astronomía",
  investigador: "Dr. Juan Pérez",
  descripcion: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  _count: { sesiones: 2 },
};

/** Fila tal cual vive en la base: referencia interna, sin URL descargable. */
const imagenMock = {
  id: "imagen-1",
  claseId: "clase-1",
  url: "supabase://clases/clases/clase-1/1.webp",
  storagePath: "clases/clase-1/1.webp",
  titulo: null,
  mimeType: "image/webp",
  tamano: 12345,
  orden: 0,
  createdAt: new Date("2026-01-02T00:00:00.000Z"),
};

/** La misma imagen ya resuelta para el navegador: apunta al proxy autenticado. */
const RUTA_ARCHIVO = "/api/clases/clase-1/imagenes/imagen-1/archivo";

const imagenParaVista = {
  id: "imagen-1",
  claseId: "clase-1",
  url: RUTA_ARCHIVO,
  titulo: null,
  mimeType: "image/webp",
  tamano: 12345,
  orden: 0,
  createdAt: new Date("2026-01-02T00:00:00.000Z"),
};

/** PNG de 1x1 px en base64 — payload válido mínimo. */
const PNG_1X1 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function makeRequest(method: string, path: string, body?: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

const contextClase = { params: Promise.resolve({ id: "clase-1" }) };
const contextImagen = {
  params: Promise.resolve({ id: "clase-1", imagenId: "imagen-1" }),
};

// ── GET /api/clases/[id]/imagenes ─────────────────────────────────────────────

describe("GET /api/clases/[id]/imagenes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retorna 401 cuando no hay sesión activa", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(null as never);

    const { GET } = await import("@/app/api/clases/[id]/imagenes/route");
    const res = await GET(makeRequest("GET", "/api/clases/clase-1/imagenes"), contextClase);

    expect(res.status).toBe(401);
  });

  it("retorna 404 cuando la clase no existe", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionAdmin as never);

    const { obtenerClasePorId } = await import("@/server/queries/clases");
    vi.mocked(obtenerClasePorId).mockResolvedValueOnce(null);

    const { GET } = await import("@/app/api/clases/[id]/imagenes/route");
    const res = await GET(makeRequest("GET", "/api/clases/clase-1/imagenes"), contextClase);

    expect(res.status).toBe(404);
  });

  it("retorna 200 con las imágenes incluso para READONLY", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionReadonly as never);

    const { obtenerClasePorId } = await import("@/server/queries/clases");
    vi.mocked(obtenerClasePorId).mockResolvedValueOnce(claseMock as never);

    const { listarImagenesDeClaseConUrl } = await import(
      "@/server/queries/imagenes-clase"
    );
    vi.mocked(listarImagenesDeClaseConUrl).mockResolvedValueOnce([
      imagenParaVista,
    ] as never);

    const { GET } = await import("@/app/api/clases/[id]/imagenes/route");
    const res = await GET(makeRequest("GET", "/api/clases/clase-1/imagenes"), contextClase);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe("imagen-1");
    // Sale la ruta del proxy; ni el storagePath ni la referencia supabase://.
    expect(body[0].url).toBe(RUTA_ARCHIVO);
    expect(JSON.stringify(body)).not.toContain("supabase://");
    expect(body[0]).not.toHaveProperty("storagePath");
  });

  it("responde 200 aunque alguna imagen no se pueda resolver", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionAdmin as never);

    const { obtenerClasePorId } = await import("@/server/queries/clases");
    vi.mocked(obtenerClasePorId).mockResolvedValueOnce(claseMock as never);

    const { listarImagenesDeClaseConUrl } = await import(
      "@/server/queries/imagenes-clase"
    );
    vi.mocked(listarImagenesDeClaseConUrl).mockResolvedValueOnce([
      { ...imagenParaVista, url: null },
    ] as never);

    const { GET } = await import("@/app/api/clases/[id]/imagenes/route");
    const res = await GET(makeRequest("GET", "/api/clases/clase-1/imagenes"), contextClase);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body[0].url).toBeNull();
  });
});

// ── POST /api/clases/[id]/imagenes ────────────────────────────────────────────

describe("POST /api/clases/[id]/imagenes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retorna 401 cuando no hay sesión activa", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(null as never);

    const { POST } = await import("@/app/api/clases/[id]/imagenes/route");
    const res = await POST(
      makeRequest("POST", "/api/clases/clase-1/imagenes", {
        mimeType: "image/png",
        data: PNG_1X1,
      }),
      contextClase,
    );

    expect(res.status).toBe(401);
  });

  it("retorna 403 para READONLY", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionReadonly as never);

    const { POST } = await import("@/app/api/clases/[id]/imagenes/route");
    const res = await POST(
      makeRequest("POST", "/api/clases/clase-1/imagenes", {
        mimeType: "image/png",
        data: PNG_1X1,
      }),
      contextClase,
    );

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toEqual({ error: "Prohibido" });
  });

  it("retorna 422 cuando el formato no está permitido", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionAdmin as never);

    const { obtenerClasePorId } = await import("@/server/queries/clases");
    vi.mocked(obtenerClasePorId).mockResolvedValueOnce(claseMock as never);

    const { POST } = await import("@/app/api/clases/[id]/imagenes/route");
    const res = await POST(
      makeRequest("POST", "/api/clases/clase-1/imagenes", {
        mimeType: "application/pdf",
        data: PNG_1X1,
      }),
      contextClase,
    );

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/revisa estos datos/i);
  });

  it("retorna 404 cuando la clase no existe", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionAdmin as never);

    const { obtenerClasePorId } = await import("@/server/queries/clases");
    vi.mocked(obtenerClasePorId).mockResolvedValueOnce(null);

    const { POST } = await import("@/app/api/clases/[id]/imagenes/route");
    const res = await POST(
      makeRequest("POST", "/api/clases/clase-1/imagenes", {
        mimeType: "image/png",
        data: PNG_1X1,
      }),
      contextClase,
    );

    expect(res.status).toBe(404);
  });

  it("crea la imagen y retorna 201 para BECARIO", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionBecario as never);

    const { obtenerClasePorId } = await import("@/server/queries/clases");
    vi.mocked(obtenerClasePorId).mockResolvedValueOnce(claseMock as never);

    const { crearImagenClase, resolverImagenParaVista } = await import(
      "@/server/queries/imagenes-clase"
    );
    vi.mocked(crearImagenClase).mockResolvedValueOnce(imagenMock as never);
    vi.mocked(resolverImagenParaVista).mockReturnValueOnce(imagenParaVista as never);

    const { POST } = await import("@/app/api/clases/[id]/imagenes/route");
    const res = await POST(
      makeRequest("POST", "/api/clases/clase-1/imagenes", {
        mimeType: "image/png",
        data: PNG_1X1,
      }),
      contextClase,
    );

    expect(res.status).toBe(201);
    expect(crearImagenClase).toHaveBeenCalledWith(
      "clase-1",
      expect.objectContaining({ mimeType: "image/png" }),
    );

    // La respuesta lleva la ruta del proxy, nunca la referencia interna.
    const body = await res.json();
    expect(body.url).toBe(RUTA_ARCHIVO);
    expect(body).not.toHaveProperty("storagePath");
  });

  it("responde 201 con url null si la fila no se puede resolver tras subir", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionAdmin as never);

    const { obtenerClasePorId } = await import("@/server/queries/clases");
    vi.mocked(obtenerClasePorId).mockResolvedValueOnce(claseMock as never);

    const { crearImagenClase, resolverImagenParaVista } = await import(
      "@/server/queries/imagenes-clase"
    );
    vi.mocked(crearImagenClase).mockResolvedValueOnce(imagenMock as never);
    vi.mocked(resolverImagenParaVista).mockReturnValueOnce({
      ...imagenParaVista,
      url: null,
    } as never);

    const { POST } = await import("@/app/api/clases/[id]/imagenes/route");
    const res = await POST(
      makeRequest("POST", "/api/clases/clase-1/imagenes", {
        mimeType: "image/png",
        data: PNG_1X1,
      }),
      contextClase,
    );

    // La imagen ya está guardada: no se pierde el trabajo por no poder pintarla.
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.url).toBeNull();
  });

  it("retorna 422 cuando la imagen no se puede almacenar", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionAdmin as never);

    const { obtenerClasePorId } = await import("@/server/queries/clases");
    vi.mocked(obtenerClasePorId).mockResolvedValueOnce(claseMock as never);

    const { crearImagenClase, ImagenNoAlmacenableError } = await import(
      "@/server/queries/imagenes-clase"
    );
    vi.mocked(crearImagenClase).mockRejectedValueOnce(
      new ImagenNoAlmacenableError("El almacenamiento de imágenes no está configurado"),
    );

    const { POST } = await import("@/app/api/clases/[id]/imagenes/route");
    const res = await POST(
      makeRequest("POST", "/api/clases/clase-1/imagenes", {
        mimeType: "image/png",
        data: PNG_1X1,
      }),
      contextClase,
    );

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/almacenamiento/i);
  });
});

// ── DELETE /api/clases/[id]/imagenes/[imagenId] ───────────────────────────────

describe("DELETE /api/clases/[id]/imagenes/[imagenId]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retorna 401 cuando no hay sesión activa", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(null as never);

    const { DELETE } = await import("@/app/api/clases/[id]/imagenes/[imagenId]/route");
    const res = await DELETE(
      makeRequest("DELETE", "/api/clases/clase-1/imagenes/imagen-1"),
      contextImagen,
    );

    expect(res.status).toBe(401);
  });

  it("retorna 403 para READONLY", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionReadonly as never);

    const { DELETE } = await import("@/app/api/clases/[id]/imagenes/[imagenId]/route");
    const res = await DELETE(
      makeRequest("DELETE", "/api/clases/clase-1/imagenes/imagen-1"),
      contextImagen,
    );

    expect(res.status).toBe(403);
  });

  it("retorna 404 cuando la imagen pertenece a otra clase", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionAdmin as never);

    const { obtenerImagenClase } = await import("@/server/queries/imagenes-clase");
    vi.mocked(obtenerImagenClase).mockResolvedValueOnce({
      ...imagenMock,
      claseId: "otra-clase",
    } as never);

    const { DELETE } = await import("@/app/api/clases/[id]/imagenes/[imagenId]/route");
    const res = await DELETE(
      makeRequest("DELETE", "/api/clases/clase-1/imagenes/imagen-1"),
      contextImagen,
    );

    expect(res.status).toBe(404);
  });

  it("elimina la imagen y retorna 204", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionAdmin as never);

    const { obtenerImagenClase, eliminarImagenClase } = await import(
      "@/server/queries/imagenes-clase"
    );
    vi.mocked(obtenerImagenClase).mockResolvedValueOnce(imagenMock as never);
    vi.mocked(eliminarImagenClase).mockResolvedValueOnce({ id: "imagen-1" } as never);

    const { DELETE } = await import("@/app/api/clases/[id]/imagenes/[imagenId]/route");
    const res = await DELETE(
      makeRequest("DELETE", "/api/clases/clase-1/imagenes/imagen-1"),
      contextImagen,
    );

    expect(res.status).toBe(204);
    expect(eliminarImagenClase).toHaveBeenCalledWith("imagen-1");
  });
});
