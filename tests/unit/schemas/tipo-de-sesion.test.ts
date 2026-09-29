import { describe, it, expect } from "vitest";
import { crearClaseSchema, editarClaseSchema } from "@/lib/schemas/clase.schema";

// ─────────────────────────────────────────────────────────────────────────────
// El tipo de actividad al crear y editar una sesión.
//
// Tres tipos conviven en el programa: la charla normal («sesión de pasaporte»),
// la sesión de lectura —que es un extra opcional— y el evento especial (día del
// niño, clausura). El servidor tiene que aceptarlos todos, seguir tratando lo
// que llega sin tipo como sesión de pasaporte, y dejar de exigir investigador
// justo donde no lo hay: una clausura no la imparte nadie.
// ─────────────────────────────────────────────────────────────────────────────

const base = {
  edicionId:    "clxyz1234567890abcdef0001",
  nombre:       "Astronomía",
  investigador: "Dr. Juan Pérez",
  fecha:        "2025-03-15",
};

describe("crearClaseSchema · tipo de sesión", () => {
  it("acepta crear una sesión de pasaporte", () => {
    const r = crearClaseSchema.safeParse({ ...base, tipo: "PASAPORTE" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.tipo).toBe("PASAPORTE");
  });

  it("acepta crear una sesión de lectura", () => {
    const r = crearClaseSchema.safeParse({
      ...base,
      nombre: "Lectura: El principito",
      tipo: "LECTURA",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.tipo).toBe("LECTURA");
  });

  it("acepta crear un evento especial", () => {
    const r = crearClaseSchema.safeParse({
      ...base,
      nombre: "Clausura 2026",
      tipo: "EVENTO",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.tipo).toBe("EVENTO");
  });

  it("sin tipo, lo que se crea es una sesión de pasaporte", () => {
    // Es el mismo criterio que el DEFAULT de la columna: lo que ya existía —y
    // lo que mande un cliente viejo— queda como pasaporte, sin backfill.
    const r = crearClaseSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.tipo).toBe("PASAPORTE");
  });

  it("rechaza un tipo inventado", () => {
    const r = crearClaseSchema.safeParse({ ...base, tipo: "CLAUSURA" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.map((i) => i.path[0])).toContain("tipo");
    }
  });
});

describe("crearClaseSchema · investigador según el tipo", () => {
  it("un evento especial no necesita investigador", () => {
    const { investigador, ...sinInvestigador } = base;
    const r = crearClaseSchema.safeParse({
      ...sinInvestigador,
      nombre: "Día del niño",
      tipo: "EVENTO",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.investigador).toBeNull();
  });

  it("un evento con el campo vacío lo guarda como 'sin investigador'", () => {
    const r = crearClaseSchema.safeParse({
      ...base,
      investigador: "   ",
      nombre: "Clausura",
      tipo: "EVENTO",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.investigador).toBeNull();
  });

  it("un evento SÍ puede llevar investigador si quien lo captura lo pone", () => {
    const r = crearClaseSchema.safeParse({
      ...base,
      nombre: "Clausura",
      tipo: "EVENTO",
      investigador: "Dra. Coordinadora",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.investigador).toBe("Dra. Coordinadora");
  });

  it("una sesión de pasaporte sigue exigiéndolo", () => {
    const { investigador, ...sinInvestigador } = base;
    const r = crearClaseSchema.safeParse({ ...sinInvestigador, tipo: "PASAPORTE" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.map((i) => i.path[0])).toContain("investigador");
    }
  });

  it("una sesión de lectura también lo exige", () => {
    const { investigador, ...sinInvestigador } = base;
    const r = crearClaseSchema.safeParse({ ...sinInvestigador, tipo: "LECTURA" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.map((i) => i.path[0])).toContain("investigador");
    }
  });
});

describe("editarClaseSchema · tipo de sesión", () => {
  it("acepta cambiar solo el tipo", () => {
    const r = editarClaseSchema.safeParse({ tipo: "EVENTO" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.tipo).toBe("EVENTO");
  });

  it("no inventa un tipo cuando no se manda", () => {
    const r = editarClaseSchema.safeParse({ nombre: "Otro nombre" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.tipo).toBeUndefined();
  });

  it("rechaza un tipo inventado", () => {
    const r = editarClaseSchema.safeParse({ tipo: "FIESTA" });
    expect(r.success).toBe(false);
  });

  it("permite dejar un evento sin investigador", () => {
    const r = editarClaseSchema.safeParse({ tipo: "EVENTO", investigador: null });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.investigador).toBeNull();
  });
});
