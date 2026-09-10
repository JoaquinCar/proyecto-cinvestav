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
const getPublicUrlMock = vi.fn();
const removeMock = vi.fn();

vi.mock("@/lib/supabase", () => ({
  getSupabaseAdmin: () => ({
    storage: {
      from: () => ({
        upload: uploadMock,
        getPublicUrl: getPublicUrlMock,
        remove: removeMock,
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
  it("sube el archivo al bucket y guarda la URL pública", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://ejemplo.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "clave";

    uploadMock.mockResolvedValueOnce({ error: null });
    getPublicUrlMock.mockReturnValueOnce({
      data: { publicUrl: "https://ejemplo.supabase.co/publico/clase-1.png" },
    });

    const { crearImagenClase } = await import("@/server/queries/imagenes-clase");

    await crearImagenClase("clase-1", { mimeType: "image/png", data: PNG_1X1 });

    expect(uploadMock).toHaveBeenCalledTimes(1);
    const argumentos = prismaMock.imagenClase.create.mock.calls[0][0];
    expect(argumentos.data.url).toBe("https://ejemplo.supabase.co/publico/clase-1.png");
    expect(argumentos.data.storagePath).toMatch(/^clases\/clase-1\//);
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
