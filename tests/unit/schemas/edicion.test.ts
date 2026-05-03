import { describe, it, expect } from "vitest";
import {
  crearEdicionSchema,
  editarEdicionSchema,
} from "@/lib/schemas/edicion.schema";

// ── Datos de prueba base ──────────────────────────────────────────────────────

const edicionValida = {
  anio: 2025,
  nombre: "Pasaporte Científico 2025",
  fechaInicio: "2025-01-15T09:00:00.000Z",
  fechaFin: "2025-06-30T18:00:00.000Z",
  minAsistencias: 5,
  porcentajeMinimo: null,
  asistenciaGlobal: true,
};

// ── Tests: crearEdicionSchema ─────────────────────────────────────────────────

describe("crearEdicionSchema", () => {
  it("acepta una edición válida con todos los campos", () => {
    const result = crearEdicionSchema.safeParse(edicionValida);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.anio).toBe(2025);
      expect(result.data.nombre).toBe("Pasaporte Científico 2025");
      expect(result.data.minAsistencias).toBe(5);
      expect(result.data.porcentajeMinimo).toBeNull();
      expect(result.data.asistenciaGlobal).toBe(true);
    }
  });

  it("aplica valores por defecto cuando se omiten campos opcionales", () => {
    const { minAsistencias, porcentajeMinimo, asistenciaGlobal, ...parcial } =
      edicionValida;
    const result = crearEdicionSchema.safeParse(parcial);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.minAsistencias).toBe(5);
      expect(result.data.porcentajeMinimo).toBeNull();
      expect(result.data.asistenciaGlobal).toBe(true);
    }
  });

  it("rechaza cuando falta el campo 'nombre'", () => {
    const { nombre, ...sinNombre } = edicionValida;
    const result = crearEdicionSchema.safeParse(sinNombre);
    expect(result.success).toBe(false);
    if (!result.success) {
      const camposConError = result.error.issues.map((i) => i.path[0]);
      expect(camposConError).toContain("nombre");
    }
  });

  it("rechaza año fuera de rango (< 2020)", () => {
    const result = crearEdicionSchema.safeParse({
      ...edicionValida,
      anio: 2019,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const camposConError = result.error.issues.map((i) => i.path[0]);
      expect(camposConError).toContain("anio");
    }
  });

  it("rechaza año fuera de rango (> 2100)", () => {
    const result = crearEdicionSchema.safeParse({
      ...edicionValida,
      anio: 2101,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const camposConError = result.error.issues.map((i) => i.path[0]);
      expect(camposConError).toContain("anio");
    }
  });

  it("rechaza fechaInicio en formato no ISO 8601", () => {
    const result = crearEdicionSchema.safeParse({
      ...edicionValida,
      fechaInicio: "15/01/2025",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const camposConError = result.error.issues.map((i) => i.path[0]);
      expect(camposConError).toContain("fechaInicio");
    }
  });

  it("rechaza fechaFin anterior a fechaInicio", () => {
    const result = crearEdicionSchema.safeParse({
      ...edicionValida,
      fechaInicio: "2025-06-30T09:00:00.000Z",
      fechaFin: "2025-01-15T09:00:00.000Z",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const camposConError = result.error.issues.map((i) => i.path[0]);
      expect(camposConError).toContain("fechaFin");
    }
  });

  it("rechaza minAsistencias con valor 0 o negativo", () => {
    const result = crearEdicionSchema.safeParse({
      ...edicionValida,
      minAsistencias: 0,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const camposConError = result.error.issues.map((i) => i.path[0]);
      expect(camposConError).toContain("minAsistencias");
    }
  });

  it("rechaza porcentajeMinimo mayor a 100", () => {
    const result = crearEdicionSchema.safeParse({
      ...edicionValida,
      porcentajeMinimo: 101,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const camposConError = result.error.issues.map((i) => i.path[0]);
      expect(camposConError).toContain("porcentajeMinimo");
    }
  });

  it("rechaza porcentajeMinimo negativo", () => {
    const result = crearEdicionSchema.safeParse({
      ...edicionValida,
      porcentajeMinimo: -5,
    });
    expect(result.success).toBe(false);
  });

  it("acepta porcentajeMinimo con valor entre 0 y 100", () => {
    const result = crearEdicionSchema.safeParse({
      ...edicionValida,
      porcentajeMinimo: 80,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.porcentajeMinimo).toBe(80);
    }
  });

  it("rechaza nombre vacío", () => {
    const result = crearEdicionSchema.safeParse({
      ...edicionValida,
      nombre: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const camposConError = result.error.issues.map((i) => i.path[0]);
      expect(camposConError).toContain("nombre");
    }
  });

  it("rechaza nombre que supera 200 caracteres", () => {
    const result = crearEdicionSchema.safeParse({
      ...edicionValida,
      nombre: "A".repeat(201),
    });
    expect(result.success).toBe(false);
  });

  it("rechaza input completamente vacío", () => {
    const result = crearEdicionSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThanOrEqual(4);
    }
  });
});

// ── Tests: editarEdicionSchema ────────────────────────────────────────────────

describe("editarEdicionSchema", () => {
  it("acepta un objeto vacío (ningún campo es obligatorio en edición parcial)", () => {
    const result = editarEdicionSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("acepta actualizar solo el nombre", () => {
    const result = editarEdicionSchema.safeParse({
      nombre: "Pasaporte Científico 2025 — Actualizado",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.nombre).toBe("Pasaporte Científico 2025 — Actualizado");
    }
  });

  it("acepta actualizar solo minAsistencias", () => {
    const result = editarEdicionSchema.safeParse({ minAsistencias: 8 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.minAsistencias).toBe(8);
    }
  });

  it("rechaza nombre vacío en edición parcial", () => {
    const result = editarEdicionSchema.safeParse({ nombre: "" });
    expect(result.success).toBe(false);
  });

  it("rechaza fechaFin anterior a fechaInicio cuando ambas se proveen", () => {
    const result = editarEdicionSchema.safeParse({
      fechaInicio: "2025-06-30T09:00:00.000Z",
      fechaFin: "2025-01-15T09:00:00.000Z",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const camposConError = result.error.issues.map((i) => i.path[0]);
      expect(camposConError).toContain("fechaFin");
    }
  });

  it("permite actualizar solo fechaInicio sin fechaFin (no se valida coherencia)", () => {
    const result = editarEdicionSchema.safeParse({
      fechaInicio: "2025-03-01T09:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  it("rechaza año fuera de rango en edición parcial", () => {
    const result = editarEdicionSchema.safeParse({ anio: 1999 });
    expect(result.success).toBe(false);
  });
});
