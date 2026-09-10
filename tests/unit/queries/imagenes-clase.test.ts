import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const prismaMock = {
  imagenClase: {
    findFirst: vi.fn(),
    create: vi.fn(),
    findUnique: vi.fn(),
    delete: vi.fn(),
    findMany: vi.fn(),
  },
};

vi.mock("@/server/db", () => ({ prisma: prismaMock }));

const uploadMock = vi.fn();
const removeMock = vi.fn();
const createSignedUrlsMock = vi.fn();

// `getPublicUrl` se deja fuera del mock a propósito: el bucket es privado y
// cualquier uso accidental debe reventar el test, no producir una URL abierta.
vi.mock("@/lib/supabase", () => ({
  getSupabaseAdmin: () => ({
    storage: {
      from: () => ({
        upload: uploadMock,
        remove: removeMock,
        createSignedUrls: createSignedUrlsMock,
      }),
    },
  }),
}));

// PNG de 1x1 px.
const PNG_1X1 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const envOriginal = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.imagenClase.findFirst.mockResolvedValue(null);
  prismaMock.imagenClase.create.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({ id: "img-1", ...data }),
  );
});

afterEach(() => {
  process.env = { ...envOriginal };
});

// ── Sin Supabase Storage configurado ──────────────────────────────────────────

describe("crearImagenClase sin Supabase Storage", () => {
  it("guarda la imagen como data URI en la base de datos", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const { crearImagenClase } = await import("@/server/queries/imagenes-clase");

    await crearImagenClase("clase-1", { mimeType: "image/png", data: PNG_1X1 });

    expect(uploadMock).not.toHaveBeenCalled();
    const argumentos = prismaMock.imagenClase.create.mock.calls[0][0];
    expect(argumentos.data.url).toMatch(/^data:image\/png;base64,/);
    expect(argumentos.data.storagePath).toBeNull();
    expect(argumentos.data.orden).toBe(0);
  });

  it("rechaza imágenes grandes cuando no hay Storage", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const { crearImagenClase, ImagenNoAlmacenableError } = await import(
      "@/server/queries/imagenes-clase"
    );

    // 1.5 MB de binario → por encima del límite del respaldo en base de datos.
    const grande = Buffer.alloc(1_500_000, 1).toString("base64");

    await expect(
      crearImagenClase("clase-1", { mimeType: "image/png", data: grande }),
    ).rejects.toBeInstanceOf(ImagenNoAlmacenableError);
    expect(prismaMock.imagenClase.create).not.toHaveBeenCalled();
  });

  it("rechaza imágenes por encima del máximo absoluto de 3 MB", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://ejemplo.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "clave";

    const { crearImagenClase, ImagenNoAlmacenableError } = await import(
      "@/server/queries/imagenes-clase"
    );

    const enorme = Buffer.alloc(4 * 1024 * 1024, 1).toString("base64");

    await expect(
      crearImagenClase("clase-1", { mimeType: "image/png", data: enorme }),
    ).rejects.toBeInstanceOf(ImagenNoAlmacenableError);
    expect(uploadMock).not.toHaveBeenCalled();
  });
});

// ── Con Supabase Storage configurado ──────────────────────────────────────────

describe("crearImagenClase con Supabase Storage", () => {
  it("sube el archivo y guarda la ruta, nunca una URL pública", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://ejemplo.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "clave";

    uploadMock.mockResolvedValueOnce({ error: null });

    const { crearImagenClase } = await import("@/server/queries/imagenes-clase");

    await crearImagenClase("clase-1", { mimeType: "image/png", data: PNG_1X1 });

    expect(uploadMock).toHaveBeenCalledTimes(1);
    const argumentos = prismaMock.imagenClase.create.mock.calls[0][0];
    expect(argumentos.data.storagePath).toMatch(/^clases\/clase-1\//);
    expect(argumentos.data.url).toMatch(/^supabase:\/\//);
    expect(argumentos.data.url).not.toContain("/object/public");
  });

  it("propaga un error legible si Storage falla", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://ejemplo.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "clave";

    uploadMock.mockResolvedValueOnce({ error: { message: "bucket inexistente" } });

    const { crearImagenClase, ImagenNoAlmacenableError } = await import(
      "@/server/queries/imagenes-clase"
    );

    await expect(
      crearImagenClase("clase-1", { mimeType: "image/png", data: PNG_1X1 }),
    ).rejects.toBeInstanceOf(ImagenNoAlmacenableError);
    expect(prismaMock.imagenClase.create).not.toHaveBeenCalled();
  });
});

// ── Orden y borrado ───────────────────────────────────────────────────────────

describe("orden y borrado de imágenes", () => {
  it("asigna el siguiente orden disponible", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    prismaMock.imagenClase.findFirst.mockResolvedValueOnce({ orden: 4 });

    const { crearImagenClase } = await import("@/server/queries/imagenes-clase");
    await crearImagenClase("clase-1", { mimeType: "image/png", data: PNG_1X1 });

    const argumentos = prismaMock.imagenClase.create.mock.calls[0][0];
    expect(argumentos.data.orden).toBe(5);
  });

  it("borra el archivo de Storage además del registro", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://ejemplo.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "clave";

    prismaMock.imagenClase.findUnique.mockResolvedValueOnce({
      id: "img-1",
      storagePath: "clases/clase-1/1.png",
    });
    prismaMock.imagenClase.delete.mockResolvedValueOnce({ id: "img-1" });
    removeMock.mockResolvedValueOnce({ error: null });

    const { eliminarImagenClase } = await import("@/server/queries/imagenes-clase");
    await eliminarImagenClase("img-1");

    expect(removeMock).toHaveBeenCalledWith(["clases/clase-1/1.png"]);
    expect(prismaMock.imagenClase.delete).toHaveBeenCalled();
  });

  it("devuelve null si la imagen no existe", async () => {
    prismaMock.imagenClase.findUnique.mockResolvedValueOnce(null);

    const { eliminarImagenClase } = await import("@/server/queries/imagenes-clase");
    const resultado = await eliminarImagenClase("no-existe");

    expect(resultado).toBeNull();
    expect(prismaMock.imagenClase.delete).not.toHaveBeenCalled();
  });
});

// ── Firmado de URLs (bucket privado) ──────────────────────────────────────────

const filaEnStorage = {
  id: "img-storage",
  claseId: "clase-1",
  url: "supabase://clases/clases/clase-1/1.webp",
  storagePath: "clases/clase-1/1.webp",
  titulo: null,
  mimeType: "image/webp",
  tamano: 1000,
  orden: 0,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
};

const filaDataUri = {
  id: "img-datauri",
  claseId: "clase-1",
  url: "data:image/png;base64,AAAA",
  storagePath: null,
  titulo: null,
  mimeType: "image/png",
  tamano: 500,
  orden: 1,
  createdAt: new Date("2026-01-02T00:00:00.000Z"),
};

function conStorage() {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://ejemplo.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "clave";
}

describe("firmarImagenes", () => {
  it("firma las imágenes que viven en Storage", async () => {
    conStorage();
    createSignedUrlsMock.mockResolvedValueOnce({
      data: [
        {
          error: null,
          path: "clases/clase-1/1.webp",
          signedUrl: "https://ejemplo.supabase.co/object/sign/x?token=abc",
        },
      ],
      error: null,
    });

    const { firmarImagenes, EXPIRACION_URL_FIRMADA } = await import(
      "@/server/queries/imagenes-clase"
    );
    const resultado = await firmarImagenes([filaEnStorage]);

    expect(resultado[0].url).toBe("https://ejemplo.supabase.co/object/sign/x?token=abc");
    expect(createSignedUrlsMock).toHaveBeenCalledWith(
      ["clases/clase-1/1.webp"],
      EXPIRACION_URL_FIRMADA,
    );
  });

  it("usa una caducidad corta (30 minutos)", async () => {
    const { EXPIRACION_URL_FIRMADA } = await import("@/server/queries/imagenes-clase");
    expect(EXPIRACION_URL_FIRMADA).toBe(1800);
  });

  it("no expone storagePath ni la referencia interna supabase://", async () => {
    conStorage();
    createSignedUrlsMock.mockResolvedValueOnce({
      data: [
        {
          error: null,
          path: "clases/clase-1/1.webp",
          signedUrl: "https://ejemplo.supabase.co/object/sign/x?token=abc",
        },
      ],
      error: null,
    });

    const { firmarImagenes } = await import("@/server/queries/imagenes-clase");
    const [resultado] = await firmarImagenes([filaEnStorage]);

    expect(resultado).not.toHaveProperty("storagePath");
    expect(JSON.stringify(resultado)).not.toContain("supabase://");
  });

  it("devuelve el data URI tal cual y no toca Storage", async () => {
    conStorage();

    const { firmarImagenes } = await import("@/server/queries/imagenes-clase");
    const [resultado] = await firmarImagenes([filaDataUri]);

    expect(resultado.url).toBe("data:image/png;base64,AAAA");
    expect(createSignedUrlsMock).not.toHaveBeenCalled();
  });

  it("devuelve url null cuando el firmado falla, sin lanzar", async () => {
    conStorage();
    createSignedUrlsMock.mockResolvedValueOnce({
      data: null,
      error: { message: "bucket no encontrado" },
    });

    const { firmarImagenes } = await import("@/server/queries/imagenes-clase");
    const [resultado] = await firmarImagenes([filaEnStorage]);

    expect(resultado.url).toBeNull();
  });

  it("devuelve url null cuando el error viene por imagen", async () => {
    conStorage();
    createSignedUrlsMock.mockResolvedValueOnce({
      data: [
        { error: "Object not found", path: "clases/clase-1/1.webp", signedUrl: null },
      ],
      error: null,
    });

    const { firmarImagenes } = await import("@/server/queries/imagenes-clase");
    const [resultado] = await firmarImagenes([filaEnStorage]);

    expect(resultado.url).toBeNull();
  });

  it("no rompe si el cliente de Storage lanza una excepción", async () => {
    conStorage();
    createSignedUrlsMock.mockRejectedValueOnce(new Error("red caída"));

    const { firmarImagenes } = await import("@/server/queries/imagenes-clase");
    const [resultado] = await firmarImagenes([filaEnStorage]);

    expect(resultado.url).toBeNull();
  });

  it("una imagen rota no tumba a las demás", async () => {
    conStorage();
    createSignedUrlsMock.mockResolvedValueOnce({
      data: [{ error: "Object not found", path: "clases/clase-1/1.webp", signedUrl: null }],
      error: null,
    });

    const { firmarImagenes } = await import("@/server/queries/imagenes-clase");
    const resultado = await firmarImagenes([filaEnStorage, filaDataUri]);

    expect(resultado).toHaveLength(2);
    expect(resultado[0].url).toBeNull();
    expect(resultado[1].url).toBe("data:image/png;base64,AAAA");
  });

  it("sin credenciales de Storage no intenta firmar", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const { firmarImagenes } = await import("@/server/queries/imagenes-clase");
    const [resultado] = await firmarImagenes([filaEnStorage]);

    expect(createSignedUrlsMock).not.toHaveBeenCalled();
    expect(resultado.url).toBeNull();
  });
});

describe("listarImagenesDeClaseConUrl", () => {
  it("lee de la base y devuelve las URLs ya resueltas", async () => {
    conStorage();
    prismaMock.imagenClase.findMany.mockResolvedValueOnce([filaEnStorage, filaDataUri]);
    createSignedUrlsMock.mockResolvedValueOnce({
      data: [
        {
          error: null,
          path: "clases/clase-1/1.webp",
          signedUrl: "https://ejemplo.supabase.co/object/sign/x?token=abc",
        },
      ],
      error: null,
    });

    const { listarImagenesDeClaseConUrl } = await import(
      "@/server/queries/imagenes-clase"
    );
    const resultado = await listarImagenesDeClaseConUrl("clase-1");

    expect(resultado.map((i) => i.url)).toEqual([
      "https://ejemplo.supabase.co/object/sign/x?token=abc",
      "data:image/png;base64,AAAA",
    ]);
  });
});
