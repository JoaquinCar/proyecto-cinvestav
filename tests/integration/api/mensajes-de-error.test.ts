import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Mensajes de error del API.
//
// No basta con que el código de estado sea el correcto: quien opera esto es el
// coordinador del programa y unos becarios, así que el texto tiene que decir
// qué pasó y qué hacer. Estas pruebas fijan ambas cosas, y además comprueban
// que lo que NO se le cuenta al cliente sí queda registrado en el servidor.
// ─────────────────────────────────────────────────────────────────────────────

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

vi.mock("@/server/queries/clases", () => ({
  obtenerClasePorId: vi.fn(),
  crearClase: vi.fn(),
  editarClase: vi.fn(),
  eliminarClase: vi.fn(),
  listarSesionesDeClase: vi.fn(),
  obtenerSesionPorId: vi.fn(),
  crearSesion: vi.fn(),
  actualizarSesion: vi.fn(),
  eliminarSesion: vi.fn(),
  obtenerRangoEdicionDeClase: vi.fn(),
  obtenerRangoEdicionDeSesion: vi.fn(),
  ClaseConAsistenciasError: class ClaseConAsistenciasError extends Error {},
  ClaseConSesionesError: class ClaseConSesionesError extends Error {
    readonly sesiones: number;
    constructor(message: string, sesiones: number) {
      super(message);
      this.name = "ClaseConSesionesError";
      this.sesiones = sesiones;
    }
  },
  SesionConAsistenciasError: class SesionConAsistenciasError extends Error {},
}));

vi.mock("@/server/queries/ediciones", () => ({ existeEdicion: vi.fn() }));

vi.mock("@/server/queries/estadisticas", () => ({
  obtenerMetricasEdicion: vi.fn(),
  obtenerDatosExcel: vi.fn(),
}));

vi.mock("@/server/queries/asistencias", () => ({
  batchUpsertAsistencias: vi.fn(),
  obtenerAsistenciasDeSesion: vi.fn(),
  obtenerResumenAsistencia: vi.fn(),
  AsistenciaFueraDeEdicionError: class AsistenciaFueraDeEdicionError extends Error {},
}));

vi.mock("@/server/queries/participantes", () => ({
  buscarParticipantes: vi.fn(),
  crearParticipante: vi.fn(),
  inscribirParticipante: vi.fn(),
}));

vi.mock("@/server/queries/edicion-cerrada", () => ({
  assertEdicionAbierta: vi.fn(),
  assertEdicionDeClaseAbierta: vi.fn(),
  assertEdicionDeSesionAbierta: vi.fn(),
  EdicionCerradaError: class EdicionCerradaError extends Error {},
}));

const admin = {
  user: { id: "u1", email: "admin@cinvestav.mx", role: "ADMIN", name: "A", image: null },
};

/** Cuerpo que no es JSON: lo que manda un navegador cuando algo se corta. */
function peticionRota(path: string, method: string): Request {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: "{ esto no es json",
  });
}

function peticion(path: string, method: string, body?: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function comoAdmin() {
  const { auth } = await import("@/lib/auth");
  vi.mocked(auth).mockResolvedValue(admin as never);
}

/** Ni rutas de archivo, ni nombres de tabla, ni trazas en lo que ve el cliente. */
function noFiltraInterioridades(mensaje: string) {
  expect(mensaje).not.toMatch(/\/Users\/|src\/|node_modules|prisma\.|at .*\(/i);
  expect(mensaje).not.toMatch(/PrismaClient|P20\d\d|Invalid `/);
}

// ── Cuerpo ilegible: 400 en todas las rutas, con el mismo texto ───────────────

describe("cuerpo JSON ilegible", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await comoAdmin();
  });

  const casos: Array<{
    nombre: string;
    ruta: string;
    metodo: string;
    handler: () => Promise<(req: never, ctx?: never) => Promise<Response>>;
    contexto?: Record<string, string>;
  }> = [
    {
      nombre: "POST /api/clases",
      ruta: "/api/clases",
      metodo: "POST",
      handler: async () => (await import("@/app/api/clases/route")).POST as never,
    },
    {
      nombre: "PUT /api/clases/[id]",
      ruta: "/api/clases/clase-1",
      metodo: "PUT",
      handler: async () => (await import("@/app/api/clases/[id]/route")).PUT as never,
      contexto: { id: "clase-1" },
    },
    {
      nombre: "POST /api/sesiones",
      ruta: "/api/sesiones",
      metodo: "POST",
      handler: async () => (await import("@/app/api/sesiones/route")).POST as never,
    },
    {
      nombre: "PUT /api/sesiones/[id]",
      ruta: "/api/sesiones/sesion-1",
      metodo: "PUT",
      handler: async () => (await import("@/app/api/sesiones/[id]/route")).PUT as never,
      contexto: { id: "sesion-1" },
    },
    {
      nombre: "POST /api/participantes",
      ruta: "/api/participantes",
      metodo: "POST",
      handler: async () => (await import("@/app/api/participantes/route")).POST as never,
    },
    {
      nombre: "POST /api/inscripciones",
      ruta: "/api/inscripciones",
      metodo: "POST",
      handler: async () => (await import("@/app/api/inscripciones/route")).POST as never,
    },
    {
      nombre: "POST /api/asistencias",
      ruta: "/api/asistencias",
      metodo: "POST",
      handler: async () => (await import("@/app/api/asistencias/route")).POST as never,
    },
  ];

  for (const caso of casos) {
    it(`${caso.nombre} responde 400, no 500, y dice que no se guardó nada`, async () => {
      // Las rutas que buscan el recurso antes de leer el cuerpo tienen que
      // encontrarlo para llegar hasta la lectura del JSON.
      const { obtenerClasePorId, obtenerSesionPorId } = await import(
        "@/server/queries/clases"
      );
      vi.mocked(obtenerClasePorId).mockResolvedValue({ id: "clase-1" } as never);
      vi.mocked(obtenerSesionPorId).mockResolvedValue({ id: "sesion-1" } as never);

      const handler = await caso.handler();
      const res = await handler(
        peticionRota(caso.ruta, caso.metodo) as never,
        (caso.contexto
          ? { params: Promise.resolve(caso.contexto) }
          : undefined) as never,
      );

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/no se guardó nada/i);
      expect(body.error).toMatch(/vuelve a cargar la página/i);
      noFiltraInterioridades(body.error);
    });
  }
});

// ── Validación: el mensaje nombra el campo que falla ─────────────────────────

describe("datos inválidos", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await comoAdmin();
  });

  it("POST /api/clases nombra los campos vacíos en vez de decir 'Datos inválidos'", async () => {
    const { POST } = await import("@/app/api/clases/route");
    const res = await POST(
      peticion("/api/clases", "POST", { edicionId: "", nombre: "", investigador: "" }),
    );

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/revisa estos datos/i);
    expect(body.error).toContain("nombre");
    expect(body.error).toContain("investigador");
    // "edicionId" es jerga: en pantalla se llama edición.
    expect(body.error).toContain("edición");
    expect(body.error).not.toContain("edicionId");
  });

  it("POST /api/participantes nombra el campo con el motivo concreto", async () => {
    const { POST } = await import("@/app/api/participantes/route");
    const res = await POST(
      peticion("/api/participantes", "POST", {
        nombre: "Juan",
        apellidos: "Pérez",
        edad: 3,
        escuela: "Primaria Centro",
        grado: "3° primaria",
      }) as never,
    );

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/edad/i);
    expect(body.detalles).toBeDefined();
  });
});

// ── Borrar una clase que todavía tiene sesiones ──────────────────────────────

describe("DELETE /api/clases/[id] con sesiones", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await comoAdmin();
  });

  it("responde 409 con el conteo y qué hacer, no 500", async () => {
    const { obtenerClasePorId, eliminarClase, ClaseConSesionesError } =
      await import("@/server/queries/clases");
    vi.mocked(obtenerClasePorId).mockResolvedValue({ id: "clase-1" } as never);
    vi.mocked(eliminarClase).mockRejectedValue(
      new ClaseConSesionesError(
        "No se puede eliminar la clase porque tiene 3 sesión(es) programada(s). " +
          "Elimina primero esas sesiones desde la página de la clase y vuelve a intentarlo.",
        3,
      ),
    );

    const { DELETE } = await import("@/app/api/clases/[id]/route");
    const res = await DELETE(peticion("/api/clases/clase-1", "DELETE"), {
      params: Promise.resolve({ id: "clase-1" }),
    });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/3 sesión/i);
    expect(body.error).toMatch(/elimina primero esas sesiones/i);
    expect(body.sesiones).toBe(3);
    noFiltraInterioridades(body.error);
  });
});

// ── Asistencia sobre una inscripción que ya no existe ────────────────────────

describe("POST /api/asistencias", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await comoAdmin();
  });

  it("409 explica que no se guardó nada y qué hacer cuando la inscripción no existe", async () => {
    const { batchUpsertAsistencias, AsistenciaFueraDeEdicionError } =
      await import("@/server/queries/asistencias");
    vi.mocked(batchUpsertAsistencias).mockRejectedValue(
      new AsistenciaFueraDeEdicionError(
        "No se guardó la asistencia porque el participante o la sesión ya no existen: " +
          "alguien pudo darlos de baja mientras pasabas lista. Vuelve a cargar la lista para ver el estado actual.",
      ),
    );

    const { POST } = await import("@/app/api/asistencias/route");
    const res = await POST(
      peticion("/api/asistencias", "POST", {
        items: [{ inscripcionId: "no-existe", sesionId: "sesion-1", presente: true }],
      }) as never,
    );

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/no se guardó la asistencia/i);
    expect(body.error).toMatch(/vuelve a cargar la lista/i);
  });
});

// ── Estadísticas y exportación de una edición que no existe ──────────────────

describe("edición inexistente", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await comoAdmin();
  });

  it("GET /api/estadisticas/edicion/[id] responde 404, no 200 con ceros", async () => {
    const { existeEdicion } = await import("@/server/queries/ediciones");
    vi.mocked(existeEdicion).mockResolvedValue(false);

    const { GET } = await import("@/app/api/estadisticas/edicion/[id]/route");
    const res = await GET(peticion("/api/estadisticas/edicion/no-existe", "GET"), {
      params: Promise.resolve({ id: "no-existe" }),
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/ya no existe/i);
    expect(body.error).toMatch(/lista de ediciones/i);
    // Y no llega a calcular métricas vacías que parezcan datos reales.
    const { obtenerMetricasEdicion } = await import("@/server/queries/estadisticas");
    expect(obtenerMetricasEdicion).not.toHaveBeenCalled();
  });

  it("GET /api/exportar/excel/[edicionId] responde 404 en vez de bajar un Excel vacío", async () => {
    const { existeEdicion } = await import("@/server/queries/ediciones");
    vi.mocked(existeEdicion).mockResolvedValue(false);

    const { GET } = await import("@/app/api/exportar/excel/[edicionId]/route");
    const res = await GET(peticion("/api/exportar/excel/no-existe", "GET"), {
      params: Promise.resolve({ edicionId: "no-existe" }),
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/ya no existe/i);
  });
});

// ── El 500 que queda: se registra entero, se cuenta a medias ─────────────────

describe("fallo inesperado", () => {
  let registrado: unknown[][];

  beforeEach(async () => {
    vi.clearAllMocks();
    await comoAdmin();
    registrado = [];
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      registrado.push(args);
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it("registra el error real en el servidor y responde sin filtrar nada", async () => {
    const { existeEdicion } = await import("@/server/queries/ediciones");
    vi.mocked(existeEdicion).mockResolvedValue(true);
    const { obtenerMetricasEdicion } = await import("@/server/queries/estadisticas");
    vi.mocked(obtenerMetricasEdicion).mockRejectedValue(
      new Error(
        "Invalid `prisma.asistencia.count()` invocation in /Users/qa/src/server/queries/estadisticas.ts:12",
      ),
    );

    const { GET } = await import("@/app/api/estadisticas/edicion/[id]/route");
    const res = await GET(peticion("/api/estadisticas/edicion/ed-1", "GET"), {
      params: Promise.resolve({ id: "ed-1" }),
    });

    expect(res.status).toBe(500);
    const body = await res.json();

    // Lo que ve quien usa la app: qué no se pudo hacer y qué sigue.
    expect(body.error).toMatch(/no se pudieron calcular las estadísticas/i);
    expect(body.error).toMatch(/vuelve a intentarlo/i);
    noFiltraInterioridades(body.error);

    // Lo que queda en el servidor: el error entero, con la ruta que lo produjo.
    expect(registrado).toHaveLength(1);
    expect(String(registrado[0][0])).toContain("GET /api/estadisticas/edicion/[id]");
    expect(String(registrado[0][1])).toContain("prisma.asistencia.count()");
  });
});
