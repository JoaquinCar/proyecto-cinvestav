import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// «Editar edición» pasaba las fechas con `Date.toString()`.
//
// Eso produce «Sat Jan 24 2026 00:00:00 GMT+0000 (Coordinated Universal Time)»,
// y `aISOFecha` solo entiende días de calendario «YYYY-MM-DD». Resultado: la
// pantalla lanzaba «Fecha inválida: Sat Jan 24 2026…» y moría antes de
// dibujarse, con CUALQUIER edición. No era un caso raro: no funcionaba nunca.
//
// Lo que se fija aquí es el contrato entre la página y el formulario: las
// fechas viajan como día de calendario, que es lo único que sabe leer el
// `<input type="date">` del otro lado.
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/server/queries/ediciones", () => ({ obtenerEdicionPorId: vi.fn() }));
vi.mock("@/app/(dashboard)/ediciones/[id]/editar/EditarEdicionForm", () => ({
  EditarEdicionForm: function EditarEdicionFormMock() {
    return null;
  },
}));

const { auth } = await import("@/lib/auth");
const { obtenerEdicionPorId } = await import("@/server/queries/ediciones");
const { EditarEdicionForm } = await import(
  "@/app/(dashboard)/ediciones/[id]/editar/EditarEdicionForm"
);
const { default: EditarEdicionPage } = await import(
  "@/app/(dashboard)/ediciones/[id]/editar/page"
);

/** La 2026 real: empezó el 24 de enero, la fecha del informe de fallo. */
const EDICION = {
  id: "ed-2026",
  anio: 2026,
  nombre: "Pasaporte Científico Mérida 2026",
  fechaInicio: new Date(Date.UTC(2026, 0, 24)),
  fechaFin: new Date(Date.UTC(2026, 5, 27)),
  minAsistencias: 6,
};

async function renderizar() {
  vi.mocked(auth).mockResolvedValue({
    user: { id: "u-1", email: "admin@cinvestav.mx", role: "ADMIN", name: "Admin", image: null },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(obtenerEdicionPorId).mockResolvedValue(EDICION as any);
  return EditarEdicionPage({ params: Promise.resolve({ id: "ed-2026" }) });
}

describe("«Editar edición» entrega las fechas como día de calendario", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lo que entrega sobrevive a `aISOFecha`, que es quien reventaba", async () => {
    // Quien lanzaba el RangeError no era esta página sino el formulario, que
    // pasa lo recibido por `aISOFecha`. Así que no basta con que la página no
    // falle: hay que meter su salida por la MISMA función del otro lado. Con
    // `.toString()` esto lanza «Fecha inválida: Sat Jan 24 2026…».
    const { aISOFecha } = await import("@/lib/fechas");
    const arbol = await renderizar();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const props = (arbol as any).props.edicion;

    expect(() => aISOFecha(props.fechaInicio)).not.toThrow();
    expect(() => aISOFecha(props.fechaFin)).not.toThrow();
  });

  it("manda «YYYY-MM-DD», no el `toString()` de un Date", async () => {
    const arbol = await renderizar();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const props = (arbol as any).props.edicion;

    expect(props.fechaInicio).toBe("2026-01-24");
    expect(props.fechaFin).toBe("2026-06-27");
    expect(props.fechaInicio).not.toMatch(/GMT|Sat|Jan/);
  });

  it("usa el componente de formulario, no otra cosa", async () => {
    const arbol = await renderizar();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((arbol as any).type).toBe(EditarEdicionForm);
  });
});
