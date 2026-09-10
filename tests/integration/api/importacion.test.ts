import { describe, it, expect, vi, beforeEach } from "vitest";
import * as XLSX from "xlsx";

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

vi.mock("@/lib/prisma", () => ({
  prisma: {
    edicion: { findUnique: vi.fn(), findMany: vi.fn() },
    participante: { findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    inscripcion: { findMany: vi.fn(), upsert: vi.fn() },
    clase: { findMany: vi.fn(), create: vi.fn() },
    sesion: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    resumenSesion: { upsert: vi.fn() },
    asistencia: { upsert: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { POST as previsualizar } from "@/app/api/importar/previsualizar/route";
import { POST as importar } from "@/app/api/importar/route";
import { GET as plantilla } from "@/app/api/importar/plantilla/route";

const authMock = vi.mocked(auth);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

// ── Helpers ───────────────────────────────────────────────────────────────────

const EDICION = { id: "ed2026", anio: 2026, nombre: "Pasaporte 2026" };

function sesionAdmin() {
  authMock.mockResolvedValue({ user: { role: "ADMIN" } } as never);
}

function xlsx(matriz: unknown[][]): Buffer {
  const ws = XLSX.utils.aoa_to_sheet(matriz);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Hoja1");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

function peticion(
  buffer: Buffer,
  tipo: string,
  edicionId = EDICION.id,
  nombre = "datos.xlsx",
): Request {
  const fd = new FormData();
  fd.set("tipo", tipo);
  fd.set("edicionId", edicionId);
  fd.set("archivo", new File([new Uint8Array(buffer)], nombre));
  return new Request("http://localhost/api/importar", { method: "POST", body: fd });
}

const CABECERA = ["Nombre", "Apellidos", "Edad", "Género", "Grado", "Escuela"];

beforeEach(() => {
  vi.clearAllMocks();
  db.edicion.findUnique.mockResolvedValue(EDICION);
  db.participante.findMany.mockResolvedValue([]);
  db.clase.findMany.mockResolvedValue([]);
  db.sesion.findMany.mockResolvedValue([]);
  db.inscripcion.findMany.mockResolvedValue([]);
  // $transaction ejecuta el callback con el mismo cliente simulado.
  db.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(db));
});

// ── Permisos ──────────────────────────────────────────────────────────────────

describe("permisos de importación", () => {
  const archivo = () => peticion(xlsx([CABECERA, ["Ana", "Poot", 9, "Niña", "3°", "X"]]), "participantes");

  it("sin sesión responde 401", async () => {
    authMock.mockResolvedValue(null as never);
    expect((await previsualizar(archivo())).status).toBe(401);
    expect((await importar(archivo())).status).toBe(401);
  });

  it("BECARIO no puede previsualizar ni importar", async () => {
    authMock.mockResolvedValue({ user: { role: "BECARIO" } } as never);
    const r1 = await previsualizar(archivo());
    expect(r1.status).toBe(403);
    expect((await r1.json()).error).toContain("administrador");
    expect((await importar(archivo())).status).toBe(403);
  });

  it("READONLY tampoco puede", async () => {
    authMock.mockResolvedValue({ user: { role: "READONLY" } } as never);
    expect((await previsualizar(archivo())).status).toBe(403);
    expect((await importar(archivo())).status).toBe(403);
  });

  it("BECARIO tampoco descarga la plantilla", async () => {
    authMock.mockResolvedValue({ user: { role: "BECARIO" } } as never);
    const req = new Request("http://localhost/api/importar/plantilla?tipo=participantes");
    expect((await plantilla(req)).status).toBe(403);
  });

  it("ADMIN sí descarga la plantilla, como .xlsx", async () => {
    sesionAdmin();
    const req = new Request("http://localhost/api/importar/plantilla?tipo=participantes&anio=2026");
    const res = await plantilla(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("spreadsheetml");
    expect(res.headers.get("Content-Disposition")).toContain("plantilla-participantes.xlsx");
    expect((await res.arrayBuffer()).byteLength).toBeGreaterThan(0);
  });

  it("rechaza un tipo de importación inventado", async () => {
    sesionAdmin();
    const req = new Request("http://localhost/api/importar/plantilla?tipo=loquesea");
    expect((await plantilla(req)).status).toBe(400);
  });
});

// ── Validación de la petición ─────────────────────────────────────────────────

describe("validación de la petición", () => {
  beforeEach(sesionAdmin);

  it("rechaza un archivo que no es hoja de cálculo", async () => {
    const req = peticion(xlsx([CABECERA]), "participantes", EDICION.id, "foto.png");
    const res = await previsualizar(req);
    expect(res.status).toBe(415);
    expect((await res.json()).error).toContain("no es una hoja de cálculo");
  });

  it("rechaza un tipo desconocido con 422", async () => {
    const req = peticion(xlsx([CABECERA]), "loquesea");
    expect((await previsualizar(req)).status).toBe(422);
  });

  it("rechaza una edición inexistente", async () => {
    db.edicion.findUnique.mockResolvedValue(null);
    const req = peticion(xlsx([CABECERA, ["Ana", "Poot", 9, "Niña", "3°", "X"]]), "participantes");
    const res = await previsualizar(req);
    expect(res.status).toBe(422);
    expect((await res.json()).error).toContain("no existe");
  });
});

// ── Vista previa: qué se creará y qué se reutilizará ──────────────────────────

describe("vista previa de participantes", () => {
  beforeEach(sesionAdmin);

  const archivo = () =>
    peticion(
      xlsx([
        CABECERA,
        ["Ana", "Poot", 9, "Niña", "3°", "Emma Godoy"],
        ["Diego", "Pech", 12, "Niño", "1° sec", "Sec 26"],
      ]),
      "participantes",
    );

  it("con la base vacía todo se crea", async () => {
    const res = await previsualizar(archivo());
    expect(res.status).toBe(200);
    const { plan } = await res.json();
    expect(plan.puedeImportar).toBe(true);
    expect(plan.acciones.map((a: { accion: string }) => a.accion)).toEqual(["crear", "crear"]);
    expect(plan.resumen).toContainEqual({ etiqueta: "Participantes nuevos", valor: 2 });
    expect(plan.resumen).toContainEqual({
      etiqueta: "Inscripciones nuevas en 2026",
      valor: 2,
    });
  });

  it("un niño que ya participó otro año se REUTILIZA, no se duplica", async () => {
    db.participante.findMany.mockResolvedValue([
      {
        id: "p1",
        nombre: "Ana",
        apellidos: "Poot",
        edad: 8,
        escuela: "Emma Godoy",
        grado: "2°",
        genero: "FEMENINO",
        nivel: "PRIMARIA",
        correo: null,
        telefono: null,
        ciudad: "Mérida",
        inscripciones: [{ edicionId: "ed2025", edicion: { anio: 2025 } }],
      },
    ]);

    const { plan } = await (await previsualizar(archivo())).json();
    const ana = plan.acciones.find((a: { sujeto: string }) => a.sujeto === "Ana Poot");
    expect(ana.accion).toBe("reutilizar");
    expect(ana.detalle).toContain("edición 2025");
    expect(ana.detalle).toContain("inscripción de 2026");
    // Y además detecta que cumplió años y cambió de grado.
    expect(ana.detalle).toContain("edad: «8» → «9»");
    expect(ana.detalle).toContain("grado: «2°» → «3°»");
    expect(plan.resumen).toContainEqual({
      etiqueta: "Ya existían de otra edición (se reutilizan)",
      valor: 1,
    });
    expect(plan.resumen).toContainEqual({ etiqueta: "Participantes nuevos", valor: 1 });
  });

  it("reimportar el mismo archivo no genera cambios (idempotente)", async () => {
    db.participante.findMany.mockResolvedValue([
      {
        id: "p1", nombre: "Ana", apellidos: "Poot", edad: 9, escuela: "Emma Godoy",
        grado: "3°", genero: "FEMENINO", nivel: "PRIMARIA", correo: null,
        telefono: null, ciudad: "Mérida",
        inscripciones: [{ edicionId: EDICION.id, edicion: { anio: 2026 } }],
      },
      {
        id: "p2", nombre: "Diego", apellidos: "Pech", edad: 12, escuela: "Sec 26",
        grado: "1° sec", genero: "MASCULINO", nivel: "SECUNDARIA", correo: null,
        telefono: null, ciudad: "Mérida",
        inscripciones: [{ edicionId: EDICION.id, edicion: { anio: 2026 } }],
      },
    ]);

    const { plan } = await (await previsualizar(archivo())).json();
    expect(plan.acciones.every((a: { accion: string }) => a.accion === "sinCambios")).toBe(true);
    expect(plan.puedeImportar).toBe(true);
    expect(plan.resumen).toContainEqual({ etiqueta: "Participantes nuevos", valor: 0 });
    expect(plan.resumen).toContainEqual({
      etiqueta: "Inscripciones nuevas en 2026",
      valor: 0,
    });
  });

  it("reconoce el mismo niño aunque cambien acentos y mayúsculas", async () => {
    db.participante.findMany.mockResolvedValue([
      {
        id: "p1", nombre: "Máxima", apellidos: "Interián Poot", edad: 5,
        escuela: "Chak Pepen", grado: "Preescolar", genero: "FEMENINO",
        nivel: "PREESCOLAR", correo: null, telefono: null, ciudad: "Umán",
        inscripciones: [{ edicionId: "ed2025", edicion: { anio: 2025 } }],
      },
    ]);
    const req = peticion(
      xlsx([CABECERA, ["MAXIMA", "interian poot", 6, "Niña", "1°", "Emma Godoy"]]),
      "participantes",
    );
    const { plan } = await (await previsualizar(req)).json();
    expect(plan.acciones[0].accion).toBe("reutilizar");
  });

  it("una fila repetida dentro del archivo se omite y se avisa con su número", async () => {
    const req = peticion(
      xlsx([
        CABECERA,
        ["Ana", "Poot", 9, "Niña", "3°", "Emma Godoy"],
        ["ANA", " poot ", 9, "Niña", "3°", "Emma Godoy"],
      ]),
      "participantes",
    );
    const { plan } = await (await previsualizar(req)).json();
    expect(plan.acciones[1].accion).toBe("omitir");
    expect(plan.avisos[0].fila).toBe(3);
    expect(plan.avisos[0].mensaje).toContain("ya aparece en la fila 2");
  });

  it("los errores de fila bloquean la importación y traen su número", async () => {
    const req = peticion(
      xlsx([CABECERA, ["Ana", "Poot", "diez", "Niña", "3°", "Emma Godoy"]]),
      "participantes",
    );
    const { plan } = await (await previsualizar(req)).json();
    expect(plan.puedeImportar).toBe(false);
    expect(plan.errores[0]).toEqual({
      fila: 2,
      mensaje: "la columna «Edad» dice «diez», se esperaba un número",
    });
  });
});

// ── Vista previa de asistencia nominal ────────────────────────────────────────

describe("vista previa de asistencia nominal", () => {
  beforeEach(sesionAdmin);

  it("exige que el participante esté inscrito y lo dice con su nombre", async () => {
    db.sesion.findMany.mockResolvedValue([
      { id: "s1", fecha: new Date(Date.UTC(2026, 0, 24, 12)), temas: "Robótica", clase: { nombre: "Robótica" } },
    ]);
    db.inscripcion.findMany.mockResolvedValue([]);

    const req = peticion(
      xlsx([["Nombre", "Apellidos", "24/01/2026"], ["Ana", "Poot", "X"]]),
      "asistencia",
    );
    const { plan } = await (await previsualizar(req)).json();
    expect(plan.puedeImportar).toBe(false);
    expect(plan.errores[0].fila).toBe(2);
    expect(plan.errores[0].mensaje).toContain("«Ana Poot» no está inscrito");
  });

  it("avisa cuando la columna no corresponde a ninguna sesión", async () => {
    db.sesion.findMany.mockResolvedValue([]);
    const req = peticion(
      xlsx([["Nombre", "Apellidos", "24/01/2026"], ["Ana", "Poot", "X"]]),
      "asistencia",
    );
    const { plan } = await (await previsualizar(req)).json();
    expect(plan.errores[0].mensaje).toContain("«24/01/2026» no corresponde a ninguna sesión");
    expect(plan.errores[0].mensaje).toContain("Importa primero las sesiones");
  });

  it("distingue asistencias nuevas de las que ya estaban", async () => {
    db.sesion.findMany.mockResolvedValue([
      { id: "s1", fecha: new Date(Date.UTC(2026, 0, 24, 12)), temas: "Robótica", clase: { nombre: "Robótica" } },
      { id: "s2", fecha: new Date(Date.UTC(2026, 1, 7, 12)), temas: "Mapas", clase: { nombre: "Mapas" } },
    ]);
    db.inscripcion.findMany.mockResolvedValue([
      {
        id: "i1",
        participante: { nombre: "Ana", apellidos: "Poot" },
        asistencias: [{ sesionId: "s1", presente: true }],
      },
    ]);

    const req = peticion(
      xlsx([["Nombre", "Apellidos", "24/01/2026", "07/02/2026"], ["Ana", "Poot", "X", "X"]]),
      "asistencia",
    );
    const { plan } = await (await previsualizar(req)).json();
    expect(plan.errores).toEqual([]);
    expect(plan.resumen).toContainEqual({ etiqueta: "Asistencias nuevas", valor: 1 });
    expect(plan.resumen).toContainEqual({ etiqueta: "Sin cambios", valor: 1 });
  });
});

// ── Importación real ──────────────────────────────────────────────────────────

describe("POST /api/importar", () => {
  beforeEach(sesionAdmin);

  it("no escribe nada si el archivo tiene errores", async () => {
    const req = peticion(
      xlsx([CABECERA, ["Ana", "Poot", "diez", "Niña", "3°", "Emma Godoy"]]),
      "participantes",
    );
    const res = await importar(req);
    expect(res.status).toBe(422);
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(db.participante.create).not.toHaveBeenCalled();
  });

  it("crea participante e inscripción dentro de una transacción", async () => {
    db.participante.create.mockResolvedValue({ id: "nuevo" });
    const req = peticion(
      xlsx([CABECERA, ["Ana", "Poot", 9, "Niña", "3°", "Emma Godoy"]]),
      "participantes",
    );
    const res = await importar(req);
    expect(res.status).toBe(200);
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.participante.create).toHaveBeenCalledTimes(1);
    expect(db.inscripcion.upsert).toHaveBeenCalledTimes(1);
    const { resultado } = await res.json();
    expect(resultado.resumen).toContainEqual({ etiqueta: "Participantes creados", valor: 1 });
  });

  it("al niño que repite solo le crea la inscripción", async () => {
    db.participante.findMany.mockResolvedValue([
      {
        id: "p1", nombre: "Ana", apellidos: "Poot", edad: 9, escuela: "Emma Godoy",
        grado: "3°", genero: "FEMENINO", nivel: "PRIMARIA", correo: null,
        telefono: null, ciudad: "Mérida",
        inscripciones: [{ edicionId: "ed2025", edicion: { anio: 2025 } }],
      },
    ]);
    const req = peticion(
      xlsx([CABECERA, ["Ana", "Poot", 9, "Niña", "3°", "Emma Godoy"]]),
      "participantes",
    );
    const res = await importar(req);
    expect(res.status).toBe(200);
    expect(db.participante.create).not.toHaveBeenCalled();
    expect(db.inscripcion.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          participanteId_edicionId: { participanteId: "p1", edicionId: EDICION.id },
        },
      }),
    );
    const { resultado } = await res.json();
    expect(resultado.resumen).toContainEqual({
      etiqueta: "Participantes reutilizados de otra edición",
      valor: 1,
    });
  });
});
