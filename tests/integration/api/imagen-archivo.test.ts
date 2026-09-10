import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mocks de infraestructura ──────────────────────────────────────────────────
//
// A diferencia de `imagenes-clase.test.ts`, aquí NO se mockea la capa de queries:
// el proxy es el punto donde se decide si sale o no la foto de un menor, así que
// se ejercita el camino real (ruta → queries → cliente de Storage) y solo se
// sustituyen la sesión, la base de datos y Supabase. No hay credenciales de
// Storage locales, de modo que la descarga solo puede cubrirse con un mock.

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

const prismaMock = {
  imagenClase: {
    findUnique: vi.fn(),
  },
};

vi.mock("@/server/db", () => ({ prisma: prismaMock }));

const downloadMock = vi.fn();

// Solo se expone `download`: si el proxy volviera a firmar URLs o a pedir la URL
// pública del bucket, el test reventaría en vez de dejar pasar un acceso abierto.
vi.mock("@/lib/supabase", () => ({
  getSupabaseAdmin: () => ({
    storage: { from: () => ({ download: downloadMock }) },
  }),
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

/** Fila en Storage: la columna `url` es una referencia interna no fetcheable. */
const imagenEnStorage = {
  id: "imagen-1",
  claseId: "clase-1",
  url: "supabase://clases/clases/clase-1/1.webp",
  storagePath: "clases/clase-1/1.webp",
  titulo: null,
  mimeType: "image/webp",
  tamano: 3,
  orden: 0,
  createdAt: new Date("2026-01-02T00:00:00.000Z"),
};

/** Fila del respaldo en base de datos: no tiene archivo que servir. */
const imagenDataUri = {
  ...imagenEnStorage,
  id: "imagen-2",
  url: "data:image/png;base64,AAAA",
  storagePath: null,
  mimeType: "image/png",
};

const BYTES = new Uint8Array([1, 2, 3]);

function blobDeImagen(tipo = "image/webp"): Blob {
  return new Blob([BYTES], { type: tipo });
}

function makeRequest(): Request {
  return new Request(
    "http://localhost/api/clases/clase-1/imagenes/imagen-1/archivo",
  );
}

const contextImagen = {
  params: Promise.resolve({ id: "clase-1", imagenId: "imagen-1" }),
};

const envOriginal = { ...process.env };

function conStorage() {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://ejemplo.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "clave";
}

async function pedirArchivo(
  session: unknown,
  context = contextImagen,
): Promise<Response> {
  const { auth } = await import("@/lib/auth");
  vi.mocked(auth).mockResolvedValueOnce(session as never);

  const { GET } = await import(
    "@/app/api/clases/[id]/imagenes/[imagenId]/archivo/route"
  );
  return GET(makeRequest(), context);
}

beforeEach(() => {
  vi.clearAllMocks();
  conStorage();
});

afterEach(() => {
  process.env = { ...envOriginal };
});

// ── Acceso ────────────────────────────────────────────────────────────────────

describe("GET /api/clases/[id]/imagenes/[imagenId]/archivo — acceso", () => {
  it("sin sesión no devuelve la imagen: 401 y nada de bytes", async () => {
    prismaMock.imagenClase.findUnique.mockResolvedValue(imagenEnStorage);
    downloadMock.mockResolvedValue({ data: blobDeImagen(), error: null });

    const res = await pedirArchivo(null);

    expect(res.status).toBe(401);
    expect(res.headers.get("Content-Type")).toContain("application/json");
    // Ni se consultó la base ni se tocó el bucket: el corte es antes de todo.
    expect(prismaMock.imagenClase.findUnique).not.toHaveBeenCalled();
    expect(downloadMock).not.toHaveBeenCalled();
  });

  it.each([
    ["ADMIN", sessionAdmin],
    ["BECARIO", sessionBecario],
    ["READONLY", sessionReadonly],
  ])("sirve la imagen a %s", async (_rol, session) => {
    prismaMock.imagenClase.findUnique.mockResolvedValue(imagenEnStorage);
    downloadMock.mockResolvedValue({ data: blobDeImagen(), error: null });

    const res = await pedirArchivo(session);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/webp");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(BYTES);
  });

  it("un rol desconocido no recibe la imagen", async () => {
    prismaMock.imagenClase.findUnique.mockResolvedValue(imagenEnStorage);
    downloadMock.mockResolvedValue({ data: blobDeImagen(), error: null });

    const res = await pedirArchivo({ user: { ...sessionAdmin.user, role: "OTRO" } });

    expect(res.status).toBe(403);
    expect(downloadMock).not.toHaveBeenCalled();
  });

  it("comprueba la sesión en cada petición, no una sola vez", async () => {
    prismaMock.imagenClase.findUnique.mockResolvedValue(imagenEnStorage);
    downloadMock.mockResolvedValue({ data: blobDeImagen(), error: null });

    const primera = await pedirArchivo(sessionAdmin);
    // Misma URL, ahora sin sesión: es el punto entero del cambio frente a las
    // URLs firmadas, que seguían funcionando 30 minutos tras revocar el acceso.
    const segunda = await pedirArchivo(null);

    expect(primera.status).toBe(200);
    expect(segunda.status).toBe(401);
  });
});

// ── Coherencia clase ↔ imagen ─────────────────────────────────────────────────

describe("GET .../archivo — la imagen debe pertenecer a la clase", () => {
  it("404 si la imagen es de otra clase, aunque el id exista", async () => {
    prismaMock.imagenClase.findUnique.mockResolvedValue({
      ...imagenEnStorage,
      claseId: "otra-clase",
    });

    const res = await pedirArchivo(sessionAdmin);

    expect(res.status).toBe(404);
    expect(downloadMock).not.toHaveBeenCalled();
  });

  it("404 si la imagen no existe", async () => {
    prismaMock.imagenClase.findUnique.mockResolvedValue(null);

    const res = await pedirArchivo(sessionAdmin);

    expect(res.status).toBe(404);
    expect(downloadMock).not.toHaveBeenCalled();
  });
});

// ── Respaldo data URI ─────────────────────────────────────────────────────────

describe("GET .../archivo — respaldo data URI", () => {
  it("404 para las filas sin storagePath: no pasan por el proxy", async () => {
    prismaMock.imagenClase.findUnique.mockResolvedValue({
      ...imagenDataUri,
      id: "imagen-1",
    });

    const res = await pedirArchivo(sessionAdmin);

    expect(res.status).toBe(404);
    expect(downloadMock).not.toHaveBeenCalled();

    // Y nunca se filtra el contenido de la columna `url` en el error.
    const body = await res.text();
    expect(body).not.toContain("data:image");
    expect(body).not.toContain("supabase://");
  });
});

// ── Fallos de Storage ─────────────────────────────────────────────────────────

describe("GET .../archivo — fallos de Storage", () => {
  it("502 si el objeto ya no está en el bucket", async () => {
    prismaMock.imagenClase.findUnique.mockResolvedValue(imagenEnStorage);
    downloadMock.mockResolvedValue({
      data: null,
      error: { message: "Object not found" },
    });

    const res = await pedirArchivo(sessionAdmin);

    expect(res.status).toBe(502);
    const body = await res.json();
    // El mensaje no revela la ruta interna del bucket.
    expect(body.error).toBe("No se pudo leer la imagen");
  });

  it("502 si el cliente de Storage lanza", async () => {
    prismaMock.imagenClase.findUnique.mockResolvedValue(imagenEnStorage);
    downloadMock.mockRejectedValue(new Error("red caída"));

    const res = await pedirArchivo(sessionAdmin);

    expect(res.status).toBe(502);
  });

  it("502 si no hay credenciales de Storage configuradas", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    prismaMock.imagenClase.findUnique.mockResolvedValue(imagenEnStorage);

    const res = await pedirArchivo(sessionAdmin);

    expect(res.status).toBe(502);
    expect(downloadMock).not.toHaveBeenCalled();
  });
});

// ── Cabeceras ─────────────────────────────────────────────────────────────────

describe("GET .../archivo — cabeceras", () => {
  it("cachea en privado y nunca en una caché compartida", async () => {
    prismaMock.imagenClase.findUnique.mockResolvedValue(imagenEnStorage);
    downloadMock.mockResolvedValue({ data: blobDeImagen(), error: null });

    const res = await pedirArchivo(sessionAdmin);

    const cache = res.headers.get("Cache-Control") ?? "";
    expect(cache).toContain("private");
    expect(cache).not.toContain("public");
    expect(cache).toContain("max-age=3600");
    expect(cache).toContain("immutable");
    expect(res.headers.get("Vary")).toBe("Cookie");
  });

  it("declara el tipo y prohíbe adivinarlo", async () => {
    prismaMock.imagenClase.findUnique.mockResolvedValue(imagenEnStorage);
    downloadMock.mockResolvedValue({ data: blobDeImagen(), error: null });

    const res = await pedirArchivo(sessionAdmin);

    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("Content-Length")).toBe("3");
    expect(res.headers.get("Content-Disposition")).toBe(
      'inline; filename="imagen-imagen-1.webp"',
    );
  });

  it("no refleja un mimeType manipulado en la base", async () => {
    prismaMock.imagenClase.findUnique.mockResolvedValue({
      ...imagenEnStorage,
      mimeType: "text/html",
    });
    downloadMock.mockResolvedValue({
      data: blobDeImagen("text/html"),
      error: null,
    });

    const res = await pedirArchivo(sessionAdmin);

    // Servir text/html desde nuestro propio origen sería XSS con sesión válida.
    expect(res.headers.get("Content-Type")).toBe("application/octet-stream");
  });
});
