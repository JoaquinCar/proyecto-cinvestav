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

vi.mock("@auth/prisma-adapter", () => ({ PrismaAdapter: vi.fn(() => ({})) }));

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

vi.mock("@/server/queries/clases", () => ({ obtenerClasePorId: vi.fn() }));

vi.mock("@/server/queries/imagenes-clase", () => ({
  reordenarImagenesDeClase: vi.fn(),
  OrdenImagenesInvalidoError: class OrdenImagenesInvalidoError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "OrdenImagenesInvalidoError";
    }
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const sessionAdmin = {
  user: { id: "u1", email: "admin@cinvestav.mx", role: "ADMIN", name: "Admin", image: null },
};
const sessionBecario = {
  user: { id: "u2", email: "becario@cinvestav.mx", role: "BECARIO", name: "Becario", image: null },
};
const sessionReadonly = {
  user: { id: "u3", email: "readonly@cinvestav.mx", role: "READONLY", name: "Readonly", image: null },
};

const claseMock = {
  id: "clase-1",
  edicionId: "edicion-1",
  nombre: "Astronomía",
  investigador: "Dr. Juan Pérez",
  descripcion: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  _count: { sesiones: 1 },
};

const imagenesReordenadas = [
  { id: "img-2", claseId: "clase-1", url: "/api/clases/clase-1/imagenes/img-2/archivo",
    titulo: null, mimeType: "image/webp", tamano: 10, orden: 0,
    createdAt: new Date("2026-01-02T00:00:00.000Z") },
  { id: "img-1", claseId: "clase-1", url: "/api/clases/clase-1/imagenes/img-1/archivo",
    titulo: null, mimeType: "image/webp", tamano: 10, orden: 1,
    createdAt: new Date("2026-01-01T00:00:00.000Z") },
];

function peticion(body?: unknown): Request {
  return new Request("http://localhost/api/clases/clase-1/imagenes/orden", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

const contexto = { params: Promise.resolve({ id: "clase-1" }) };

beforeEach(() => vi.clearAllMocks());

// ── PATCH /api/clases/[id]/imagenes/orden ─────────────────────────────────────

describe("PATCH /api/clases/[id]/imagenes/orden", () => {
  it("sin sesión responde 401 y no toca la base", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(null as never);

    const { PATCH } = await import("@/app/api/clases/[id]/imagenes/orden/route");
    const res = await PATCH(peticion({ orden: ["img-2", "img-1"] }), contexto);

    expect(res.status).toBe(401);
    const { reordenarImagenesDeClase } = await import(
      "@/server/queries/imagenes-clase"
    );
    expect(reordenarImagenesDeClase).not.toHaveBeenCalled();
  });

  it("READONLY responde 403: solo mira, no reordena", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(sessionReadonly as never);

    const { PATCH } = await import("@/app/api/clases/[id]/imagenes/orden/route");
    const res = await PATCH(peticion({ orden: ["img-2", "img-1"] }), contexto);

    expect(res.status).toBe(403);
    const { reordenarImagenesDeClase } = await import(
      "@/server/queries/imagenes-clase"
    );
    expect(reordenarImagenesDeClase).not.toHaveBeenCalled();
  });

  it("ADMIN reordena y recibe el nuevo orden", async () => {
    const { auth } = await import("@/lib/auth");
    const { obtenerClasePorId } = await import("@/server/queries/clases");
    const { reordenarImagenesDeClase } = await import(
      "@/server/queries/imagenes-clase"
    );

    vi.mocked(auth).mockResolvedValueOnce(sessionAdmin as never);
    vi.mocked(obtenerClasePorId).mockResolvedValueOnce(claseMock as never);
    vi.mocked(reordenarImagenesDeClase).mockResolvedValueOnce(
      imagenesReordenadas as never,
    );

    const { PATCH } = await import("@/app/api/clases/[id]/imagenes/orden/route");
    const res = await PATCH(peticion({ orden: ["img-2", "img-1"] }), contexto);

    expect(res.status).toBe(200);
    expect(reordenarImagenesDeClase).toHaveBeenCalledWith("clase-1", [
      "img-2",
      "img-1",
    ]);
    const json = await res.json();
    expect(json.map((i: { id: string }) => i.id)).toEqual(["img-2", "img-1"]);
  });

  it("BECARIO también puede reordenar: es quien sube las fotos en campo", async () => {
    const { auth } = await import("@/lib/auth");
    const { obtenerClasePorId } = await import("@/server/queries/clases");
    const { reordenarImagenesDeClase } = await import(
      "@/server/queries/imagenes-clase"
    );

    vi.mocked(auth).mockResolvedValueOnce(sessionBecario as never);
    vi.mocked(obtenerClasePorId).mockResolvedValueOnce(claseMock as never);
    vi.mocked(reordenarImagenesDeClase).mockResolvedValueOnce(
      imagenesReordenadas as never,
    );

    const { PATCH } = await import("@/app/api/clases/[id]/imagenes/orden/route");
    const res = await PATCH(peticion({ orden: ["img-2", "img-1"] }), contexto);

    expect(res.status).toBe(200);
  });

  it("la respuesta nunca lleva la referencia interna de Storage", async () => {
    const { auth } = await import("@/lib/auth");
    const { obtenerClasePorId } = await import("@/server/queries/clases");
    const { reordenarImagenesDeClase } = await import(
      "@/server/queries/imagenes-clase"
    );

    vi.mocked(auth).mockResolvedValueOnce(sessionAdmin as never);
    vi.mocked(obtenerClasePorId).mockResolvedValueOnce(claseMock as never);
    vi.mocked(reordenarImagenesDeClase).mockResolvedValueOnce(
      imagenesReordenadas as never,
    );

    const { PATCH } = await import("@/app/api/clases/[id]/imagenes/orden/route");
    const res = await PATCH(peticion({ orden: ["img-2", "img-1"] }), contexto);

    expect(await res.text()).not.toContain("supabase://");
  });

  it("rechaza con 422 un cuerpo sin la lista de orden", async () => {
    const { auth } = await import("@/lib/auth");
    const { obtenerClasePorId } = await import("@/server/queries/clases");

    vi.mocked(auth).mockResolvedValueOnce(sessionAdmin as never);
    vi.mocked(obtenerClasePorId).mockResolvedValueOnce(claseMock as never);

    const { PATCH } = await import("@/app/api/clases/[id]/imagenes/orden/route");
    const res = await PATCH(peticion({}), contexto);

    expect(res.status).toBe(422);
  });

  it("rechaza con 400 un cuerpo que no es JSON", async () => {
    const { auth } = await import("@/lib/auth");
    const { obtenerClasePorId } = await import("@/server/queries/clases");

    vi.mocked(auth).mockResolvedValueOnce(sessionAdmin as never);
    vi.mocked(obtenerClasePorId).mockResolvedValueOnce(claseMock as never);

    const roto = new Request("http://localhost/api/clases/clase-1/imagenes/orden", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: "{no-json",
    });

    const { PATCH } = await import("@/app/api/clases/[id]/imagenes/orden/route");
    const res = await PATCH(roto, contexto);

    expect(res.status).toBe(400);
  });

  it("devuelve 409 y un texto entendible si la lista ya no coincide con la sesión", async () => {
    const { auth } = await import("@/lib/auth");
    const { obtenerClasePorId } = await import("@/server/queries/clases");
    const { reordenarImagenesDeClase, OrdenImagenesInvalidoError } = await import(
      "@/server/queries/imagenes-clase"
    );

    vi.mocked(auth).mockResolvedValueOnce(sessionAdmin as never);
    vi.mocked(obtenerClasePorId).mockResolvedValueOnce(claseMock as never);
    vi.mocked(reordenarImagenesDeClase).mockRejectedValueOnce(
      new OrdenImagenesInvalidoError("La lista de imágenes cambió"),
    );

    const { PATCH } = await import("@/app/api/clases/[id]/imagenes/orden/route");
    const res = await PATCH(peticion({ orden: ["img-2", "img-1"] }), contexto);

    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toMatch(/vuelve a cargar/i);
  });

  it("devuelve 404 si la sesión ya no existe", async () => {
    const { auth } = await import("@/lib/auth");
    const { obtenerClasePorId } = await import("@/server/queries/clases");

    vi.mocked(auth).mockResolvedValueOnce(sessionAdmin as never);
    vi.mocked(obtenerClasePorId).mockResolvedValueOnce(null as never);

    const { PATCH } = await import("@/app/api/clases/[id]/imagenes/orden/route");
    const res = await PATCH(peticion({ orden: ["img-2"] }), contexto);

    expect(res.status).toBe(404);
  });
});
