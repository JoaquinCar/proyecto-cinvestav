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
const downloadMock = vi.fn();

// `getPublicUrl` y `createSignedUrl(s)` se dejan fuera del mock a propósito: el
// bucket es privado y el archivo solo se sirve por el proxy autenticado, así que
// cualquier intento de volver a repartir URLs debe reventar el test, no producir
// una URL que dé acceso por sí sola.
vi.mock("@/lib/supabase", () => ({
  getSupabaseAdmin: () => ({
    storage: {
      from: () => ({
        upload: uploadMock,
        remove: removeMock,
        download: downloadMock,
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

// ── Resolución de URLs para la vista (bucket privado) ─────────────────────────

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

describe("resolverImagenesParaVista", () => {
  it("apunta las imágenes de Storage al proxy autenticado", async () => {
    conStorage();

    const { resolverImagenesParaVista } = await import(
      "@/server/queries/imagenes-clase"
    );
    const [resultado] = resolverImagenesParaVista([filaEnStorage]);

    expect(resultado.url).toBe("/api/clases/clase-1/imagenes/img-storage/archivo");
    // Construir la URL no toca Storage: no reparte acceso, solo apunta al proxy.
    expect(downloadMock).not.toHaveBeenCalled();
  });

  it("produce una URL estable y sin permiso dentro", async () => {
    conStorage();

    const { resolverImagenesParaVista } = await import(
      "@/server/queries/imagenes-clase"
    );
    const primera = resolverImagenesParaVista([filaEnStorage])[0].url;
    const segunda = resolverImagenesParaVista([filaEnStorage])[0].url;

    // Estable entre renders: por eso el navegador puede cachear la imagen.
    expect(primera).toBe(segunda);
    expect(primera).not.toContain("token");
  });

  it("no expone storagePath ni la referencia interna supabase://", async () => {
    conStorage();

    const { resolverImagenesParaVista } = await import(
      "@/server/queries/imagenes-clase"
    );
    const [resultado] = resolverImagenesParaVista([filaEnStorage]);

    expect(resultado).not.toHaveProperty("storagePath");
    expect(JSON.stringify(resultado)).not.toContain("supabase://");
  });

  it("devuelve el data URI tal cual y no toca Storage", async () => {
    conStorage();

    const { resolverImagenesParaVista } = await import(
      "@/server/queries/imagenes-clase"
    );
    const [resultado] = resolverImagenesParaVista([filaDataUri]);

    expect(resultado.url).toBe("data:image/png;base64,AAAA");
    expect(downloadMock).not.toHaveBeenCalled();
  });

  it("devuelve url null si la fila no es servible, nunca la referencia interna", async () => {
    conStorage();

    // Fila inconsistente: quedó la referencia interna pero sin storagePath.
    const rota = { ...filaEnStorage, storagePath: null };

    const { resolverImagenesParaVista } = await import(
      "@/server/queries/imagenes-clase"
    );
    const [resultado] = resolverImagenesParaVista([rota]);

    expect(resultado.url).toBeNull();
  });

  it("una imagen rota no tumba a las demás", async () => {
    conStorage();

    const rota = { ...filaEnStorage, storagePath: null };

    const { resolverImagenesParaVista } = await import(
      "@/server/queries/imagenes-clase"
    );
    const resultado = resolverImagenesParaVista([rota, filaDataUri]);

    expect(resultado).toHaveLength(2);
    expect(resultado[0].url).toBeNull();
    expect(resultado[1].url).toBe("data:image/png;base64,AAAA");
  });

  it("apunta al proxy aunque no haya credenciales de Storage", async () => {
    // La URL no depende de Storage: si el archivo no se puede leer, el fallo se
    // manifiesta al pedirlo, no al construir la página.
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const { resolverImagenesParaVista } = await import(
      "@/server/queries/imagenes-clase"
    );
    const [resultado] = resolverImagenesParaVista([filaEnStorage]);

    expect(resultado.url).toBe("/api/clases/clase-1/imagenes/img-storage/archivo");
  });
});

// ── Descarga desde Storage (lo que hace el proxy) ─────────────────────────────

describe("descargarImagenDeStorage", () => {
  it("descarga el objeto del bucket privado con service_role", async () => {
    conStorage();
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: "image/webp" });
    downloadMock.mockResolvedValueOnce({ data: blob, error: null });

    const { descargarImagenDeStorage } = await import(
      "@/server/queries/imagenes-clase"
    );
    const resultado = await descargarImagenDeStorage("clases/clase-1/1.webp");

    expect(downloadMock).toHaveBeenCalledWith("clases/clase-1/1.webp");
    expect(resultado?.size).toBe(3);
  });

  it("devuelve null si el objeto ya no está en el bucket", async () => {
    conStorage();
    downloadMock.mockResolvedValueOnce({
      data: null,
      error: { message: "Object not found" },
    });

    const { descargarImagenDeStorage } = await import(
      "@/server/queries/imagenes-clase"
    );

    expect(await descargarImagenDeStorage("clases/clase-1/1.webp")).toBeNull();
  });

  it("devuelve null si el cliente de Storage lanza una excepción", async () => {
    conStorage();
    downloadMock.mockRejectedValueOnce(new Error("red caída"));

    const { descargarImagenDeStorage } = await import(
      "@/server/queries/imagenes-clase"
    );

    expect(await descargarImagenDeStorage("clases/clase-1/1.webp")).toBeNull();
  });

  it("sin credenciales de Storage ni siquiera lo intenta", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const { descargarImagenDeStorage } = await import(
      "@/server/queries/imagenes-clase"
    );

    expect(await descargarImagenDeStorage("clases/clase-1/1.webp")).toBeNull();
    expect(downloadMock).not.toHaveBeenCalled();
  });
});

// ── Content-Type devuelto por el proxy ────────────────────────────────────────

describe("tipoImagenSeguro", () => {
  it("deja pasar los tipos de imagen aceptados", async () => {
    const { tipoImagenSeguro } = await import("@/server/queries/imagenes-clase");

    for (const tipo of ["image/png", "image/jpeg", "image/webp", "image/gif"]) {
      expect(tipoImagenSeguro(tipo)).toBe(tipo);
    }
  });

  it("no refleja tipos ejecutables aunque estén en la base", async () => {
    const { tipoImagenSeguro } = await import("@/server/queries/imagenes-clase");

    // Servirlo como text/html o SVG desde nuestro propio origen sería XSS.
    expect(tipoImagenSeguro("text/html")).toBe("application/octet-stream");
    expect(tipoImagenSeguro("image/svg+xml")).toBe("application/octet-stream");
  });
});

describe("listarImagenesDeClaseConUrl", () => {
  it("lee de la base y devuelve las URLs ya resueltas", async () => {
    conStorage();
    prismaMock.imagenClase.findMany.mockResolvedValueOnce([filaEnStorage, filaDataUri]);

    const { listarImagenesDeClaseConUrl } = await import(
      "@/server/queries/imagenes-clase"
    );
    const resultado = await listarImagenesDeClaseConUrl("clase-1");

    expect(resultado.map((i) => i.url)).toEqual([
      "/api/clases/clase-1/imagenes/img-storage/archivo",
      "data:image/png;base64,AAAA",
    ]);
  });
});
