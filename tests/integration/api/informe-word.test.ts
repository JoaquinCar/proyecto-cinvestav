import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/word/informe-sesion/[claseId] — quién puede bajarse el informe.
//
// El documento lleva anexada la lista NOMINAL de los niños que asistieron y,
// una vez descargado, ya no hay forma de revocarlo. Por eso el control de
// acceso de esta ruta merece su propia prueba: READONLY puede mirar reportes en
// pantalla y NO puede sacar este archivo.
//
// El generador NO se mockea: se deja correr contra la plantilla real del
// repositorio, así que esta prueba también comprueba que la plantilla sigue en
// su sitio y que la respuesta es un .docx de verdad.
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

const obtenerDatosInformeSesion = vi.fn();
vi.mock("@/server/queries/informe-sesion", () => ({
  obtenerDatosInformeSesion: (...args: unknown[]) =>
    obtenerDatosInformeSesion(...args),
}));

import { GET } from "@/app/api/word/informe-sesion/[claseId]/route";
import { auth } from "@/lib/auth";

const authMock = vi.mocked(auth);

function sesion(role: "ADMIN" | "BECARIO" | "READONLY") {
  return {
    user: { id: `user-${role}`, email: `${role}@cinvestav.mx`, role, name: role, image: null },
  };
}

const INFORME = {
  nombreArchivo: "Informe_sesion_3_2026_los-misteriosos-gusanos-marinos",
  datos: {
    numeroSesion: "3",
    fecha: "21 de febrero de 2026",
    titulo: "Los misteriosos gusanos marinos",
    autor: "Mayra Vázquez Luna",
    objetivo: null,
    descripcion: "Los gusanos marinos son invertebrados.",
    comentarios: null,
    fotos: [],
    anexo: null,
  },
};

function pedir(claseId = "clase-1") {
  return GET(new Request(`http://localhost/api/word/informe-sesion/${claseId}`), {
    params: Promise.resolve({ claseId }),
  });
}

describe("GET /api/word/informe-sesion/[claseId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    obtenerDatosInformeSesion.mockResolvedValue(INFORME);
  });

  it("sin sesión responde 401 y no toca la base", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    authMock.mockResolvedValue(null as any);

    const res = await pedir();

    expect(res.status).toBe(401);
    expect(obtenerDatosInformeSesion).not.toHaveBeenCalled();
  });

  it("READONLY recibe 403 y el informe no llega a generarse", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    authMock.mockResolvedValue(sesion("READONLY") as any);

    const res = await pedir();

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Prohibido" });
    expect(obtenerDatosInformeSesion).not.toHaveBeenCalled();
  });

  it.each(["ADMIN", "BECARIO"] as const)("%s se baja un .docx", async (rol) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    authMock.mockResolvedValue(sesion(rol) as any);

    const res = await pedir();

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(res.headers.get("Content-Disposition")).toBe(
      'attachment; filename="Informe_sesion_3_2026_los-misteriosos-gusanos-marinos.docx"',
    );

    // Nada de cachés compartidas: en el documento aparecen menores.
    expect(res.headers.get("Cache-Control")).toContain("private");
    expect(res.headers.get("Vary")).toBe("Cookie");

    const cuerpo = Buffer.from(await res.arrayBuffer());
    expect(cuerpo.subarray(0, 2).toString("ascii")).toBe("PK");
    expect(cuerpo.length).toBeGreaterThan(10_000); // el banner va dentro
  });

  it("una sesión que ya no existe responde 404 con un mensaje que se entiende", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    authMock.mockResolvedValue(sesion("ADMIN") as any);
    obtenerDatosInformeSesion.mockResolvedValue(null);

    const res = await pedir("no-existe");

    expect(res.status).toBe(404);
    expect((await res.json()).error).toContain("ya no existe");
  });
});
