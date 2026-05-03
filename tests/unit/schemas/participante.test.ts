import { describe, it, expect } from "vitest";
import {
  participanteSchema,
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

  it("rechaza edicionId que no es CUID", () => {
    const result = busquedaParticipanteSchema.safeParse({
      edicionId: "no-es-cuid-valido!!!",
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

  it("rechaza participanteId que no es CUID", () => {
    const result = inscripcionSchema.safeParse({
      ...inscripcionValida,
      participanteId: "no-cuid",
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
