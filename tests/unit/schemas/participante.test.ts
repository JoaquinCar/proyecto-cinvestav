import { describe, it, expect } from "vitest";
import {
  participanteSchema,
  editarParticipanteSchema,
  busquedaParticipanteSchema,
  inscripcionSchema,
} from "@/lib/schemas/participante.schema";

// ── participanteSchema ────────────────────────────────────────────────────────

describe("participanteSchema", () => {
  const participanteValido = {
    nombre:    "Juan",
    apellidos: "García López",
    edad:      10,
    escuela:   "Primaria Benito Juárez",
    grado:     "4°",
  };

  it("acepta un participante con todos los campos válidos", () => {
    const result = participanteSchema.safeParse(participanteValido);
    expect(result.success).toBe(true);
  });

  it("acepta grado como texto libre (no enum)", () => {
    const result = participanteSchema.safeParse({
      ...participanteValido,
      grado: "Sexto grado",
    });
    expect(result.success).toBe(true);
  });

  it("rechaza nombre vacío", () => {
    const result = participanteSchema.safeParse({
      ...participanteValido,
      nombre: "",
    });
    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.nombre).toBeDefined();
  });

  it("rechaza apellidos vacíos", () => {
    const result = participanteSchema.safeParse({
      ...participanteValido,
      apellidos: "",
    });
    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.apellidos).toBeDefined();
  });

  it("rechaza edad menor a 5", () => {
    const result = participanteSchema.safeParse({
      ...participanteValido,
      edad: 4,
    });
    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.edad).toBeDefined();
  });

  it("rechaza edad mayor a 18", () => {
    const result = participanteSchema.safeParse({
      ...participanteValido,
      edad: 19,
    });
    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.edad).toBeDefined();
  });

  it("acepta edad en el límite inferior (5)", () => {
    const result = participanteSchema.safeParse({ ...participanteValido, edad: 5 });
    expect(result.success).toBe(true);
  });

  it("acepta edad en el límite superior (18)", () => {
    const result = participanteSchema.safeParse({ ...participanteValido, edad: 18 });
    expect(result.success).toBe(true);
  });

  it("rechaza edad decimal (no es entero)", () => {
    const result = participanteSchema.safeParse({
      ...participanteValido,
      edad: 10.5,
    });
    expect(result.success).toBe(false);
  });

  it("rechaza escuela vacía", () => {
    const result = participanteSchema.safeParse({
      ...participanteValido,
      escuela: "",
    });
    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.escuela).toBeDefined();
  });

  it("rechaza objeto completamente vacío", () => {
    const result = participanteSchema.safeParse({});
    expect(result.success).toBe(false);
    const errors = result.error?.flatten().fieldErrors;
    expect(Object.keys(errors ?? {}).length).toBeGreaterThanOrEqual(5);
  });

  it("recorta espacios en blanco del nombre (trim)", () => {
    const result = participanteSchema.safeParse({
      ...participanteValido,
      nombre: "  Ana  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.nombre).toBe("Ana");
    }
  });

  it("rechaza nombre que supera 100 caracteres", () => {
    const result = participanteSchema.safeParse({
      ...participanteValido,
      nombre: "A".repeat(101),
    });
    expect(result.success).toBe(false);
  });

  // El orden de los checks importa: con .min(1) antes de .trim(), una cadena de
  // solo espacios pasaba la validación y se guardaba vacía en la base.

  it("rechaza nombre formado solo por espacios", () => {
    const result = participanteSchema.safeParse({
      ...participanteValido,
      nombre: "   ",
    });
    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.nombre).toBeDefined();
  });

  it("rechaza apellidos formados solo por espacios", () => {
    const result = participanteSchema.safeParse({
      ...participanteValido,
      apellidos: "  \t ",
    });
    expect(result.success).toBe(false);
  });

  it("rechaza escuela formada solo por espacios", () => {
    const result = participanteSchema.safeParse({
      ...participanteValido,
      escuela: "    ",
    });
    expect(result.success).toBe(false);
  });

  it("rechaza grado formado solo por espacios", () => {
    const result = participanteSchema.safeParse({
      ...participanteValido,
      grado: " ",
    });
    expect(result.success).toBe(false);
  });
});

// ── editarParticipanteSchema ──────────────────────────────────────────────────

describe("editarParticipanteSchema", () => {
  it("acepta un solo campo (edición parcial)", () => {
    const result = editarParticipanteSchema.safeParse({ nombre: "Ana" });
    expect(result.success).toBe(true);
  });

  it("recorta los espacios del campo enviado", () => {
    const result = editarParticipanteSchema.safeParse({ apellidos: "  Pérez  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.apellidos).toBe("Pérez");
    }
  });

  it("rechaza un cuerpo sin ningún campo", () => {
    const result = editarParticipanteSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rechaza un campo presente pero solo con espacios", () => {
    const result = editarParticipanteSchema.safeParse({ nombre: "   " });
    expect(result.success).toBe(false);
  });

  it("mantiene las reglas de edad del schema base", () => {
    expect(editarParticipanteSchema.safeParse({ edad: 4 }).success).toBe(false);
    expect(editarParticipanteSchema.safeParse({ edad: 19 }).success).toBe(false);
    expect(editarParticipanteSchema.safeParse({ edad: 11 }).success).toBe(true);
  });

  it("ignora campos desconocidos en lugar de guardarlos", () => {
    const result = editarParticipanteSchema.safeParse({
      nombre: "Ana",
      role:   "ADMIN",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect("role" in result.data).toBe(false);
    }
  });
});

// ── busquedaParticipanteSchema ────────────────────────────────────────────────

describe("busquedaParticipanteSchema", () => {
  it("acepta query vacío (listar todos)", () => {
    const result = busquedaParticipanteSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("acepta query de texto válido", () => {
    const result = busquedaParticipanteSchema.safeParse({ q: "García" });
    expect(result.success).toBe(true);
  });

  it("acepta edicionId CUID válido", () => {
    // CUID regex: /^[cC][^\s-]{8,}$/ — empieza con c/C, sin espacios ni guiones, ≥9 chars total
    const result = busquedaParticipanteSchema.safeParse({
      edicionId: "clxyz1234567890abcdef1234",
    });
    expect(result.success).toBe(true);
  });

  it("rechaza query que supera 100 caracteres", () => {
    const result = busquedaParticipanteSchema.safeParse({
      q: "A".repeat(101),
    });
    expect(result.success).toBe(false);
  });

  it("acepta cualquier edicionId no vacío (IDs opacos)", () => {
    const result = busquedaParticipanteSchema.safeParse({
      edicionId: "clase-astronomia",
    });
    expect(result.success).toBe(true);
  });

  it("rechaza edicionId vacío", () => {
    const result = busquedaParticipanteSchema.safeParse({
      edicionId: "",
    });
    expect(result.success).toBe(false);
  });
});

// ── inscripcionSchema ─────────────────────────────────────────────────────────

describe("inscripcionSchema", () => {
  const inscripcionValida = {
    participanteId: "clxyz1234567890abcdef0001",
    edicionId:      "clxyz1234567890abcdef0002",
  };

  it("acepta IDs CUID válidos", () => {
    const result = inscripcionSchema.safeParse(inscripcionValida);
    expect(result.success).toBe(true);
  });

  it("rechaza participanteId ausente", () => {
    const result = inscripcionSchema.safeParse({
      edicionId: inscripcionValida.edicionId,
    });
    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.participanteId).toBeDefined();
  });

  it("rechaza edicionId ausente", () => {
    const result = inscripcionSchema.safeParse({
      participanteId: inscripcionValida.participanteId,
    });
    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.edicionId).toBeDefined();
  });

  it("rechaza participanteId vacío", () => {
    const result = inscripcionSchema.safeParse({
      ...inscripcionValida,
      participanteId: "",
    });
    expect(result.success).toBe(false);
  });

  it("rechaza objeto completamente vacío", () => {
    const result = inscripcionSchema.safeParse({});
    expect(result.success).toBe(false);
    const errors = result.error?.flatten().fieldErrors;
    expect(Object.keys(errors ?? {}).length).toBeGreaterThanOrEqual(2);
  });
});

// ── ciudad ────────────────────────────────────────────────────────────────────
//
// El campo es OPCIONAL a propósito. Dos motivos, los dos del terreno:
//   · En los respaldos hay participantes sin ciudad. Exigirla al editar
//     convertiría cualquier corrección de un nombre en una cacería del dato.
//   · La carga la hace una persona a mano, sesión por sesión. Un campo
//     obligatorio que no puede rellenar la deja atascada.
// Lo que sí se exige es que, cuando venga, venga LIMPIA: la estadística «de
// dónde vienen los niños» es justo para lo que se pidió el campo.

describe("participanteSchema · ciudad", () => {
  const base = {
    nombre: "Juan",
    apellidos: "García López",
    edad: 10,
    escuela: "Primaria Benito Juárez",
    grado: "4°",
  };

  it("acepta un participante sin ciudad", () => {
    // Ausente ≠ vacía: la petición simplemente no habla de la ciudad. Al dar de
    // alta acaba en NULL de todas formas (lo hace `crearParticipante`), pero al
    // editar es lo que significa «no la toques».
    const result = participanteSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.ciudad).toBeUndefined();
  });

  it("acepta la ciudad vacía como «no se capturó»", () => {
    const result = participanteSchema.safeParse({ ...base, ciudad: "   " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.ciudad).toBeNull();
  });

  it("acepta null explícito", () => {
    const result = participanteSchema.safeParse({ ...base, ciudad: null });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.ciudad).toBeNull();
  });

  it("canoniza la ciudad antes de guardarla", () => {
    const result = participanteSchema.safeParse({ ...base, ciudad: "  merida, yuc. " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.ciudad).toBe("Mérida");
  });

  it("conserva una ciudad fuera del catálogo", () => {
    const result = participanteSchema.safeParse({ ...base, ciudad: "cancún" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.ciudad).toBe("Cancún");
  });

  it("rechaza una ciudad que supera 100 caracteres", () => {
    const result = participanteSchema.safeParse({ ...base, ciudad: "M".repeat(101) });
    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.ciudad).toBeDefined();
  });
});

describe("editarParticipanteSchema · ciudad", () => {
  it("permite corregir solo la ciudad", () => {
    const result = editarParticipanteSchema.safeParse({ ciudad: "kanasin" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.ciudad).toBe("Kanasín");
  });

  it("permite borrar la ciudad mal capturada", () => {
    const result = editarParticipanteSchema.safeParse({ ciudad: "" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.ciudad).toBeNull();
  });

  it("sigue exigiendo al menos un campo", () => {
    expect(editarParticipanteSchema.safeParse({}).success).toBe(false);
  });
});
