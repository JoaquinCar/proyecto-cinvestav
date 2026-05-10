import { describe, it, expect } from "vitest";
import {
  crearClaseSchema,
  editarClaseSchema,
  crearSesionSchema,
  actualizarSesionSchema,
} from "@/lib/schemas/clase.schema";

// ── Datos de prueba base ──────────────────────────────────────────────────────

const claseValida = {
  edicionId:    "clxyz1234567890abcdef0001",
  nombre:       "Astronomía",
  investigador: "Dr. Juan Pérez",
  descripcion:  "Introducción al universo",
};

const sesionValida = {
  claseId: "clxyz1234567890abcdef0002",
  fecha:   "2025-03-15T10:00:00.000Z",
  temas:   "Sistema solar",
  notas:   "Llevamos telescopio",
};

// ── Tests: crearClaseSchema ───────────────────────────────────────────────────

describe("crearClaseSchema", () => {
  it("acepta una clase válida con todos los campos", () => {
    const result = crearClaseSchema.safeParse(claseValida);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.nombre).toBe("Astronomía");
      expect(result.data.investigador).toBe("Dr. Juan Pérez");
    }
  });

  it("acepta una clase válida sin descripción (campo opcional)", () => {
    const { descripcion, ...sinDescripcion } = claseValida;
    const result = crearClaseSchema.safeParse(sinDescripcion);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.descripcion).toBeUndefined();
    }
  });

  it("rechaza cuando falta el campo 'nombre'", () => {
    const { nombre, ...sinNombre } = claseValida;
    const result = crearClaseSchema.safeParse(sinNombre);
    expect(result.success).toBe(false);
    if (!result.success) {
      const campos = result.error.issues.map((i) => i.path[0]);
      expect(campos).toContain("nombre");
    }
  });

  it("rechaza cuando falta el campo 'investigador'", () => {
    const { investigador, ...sinInvestigador } = claseValida;
    const result = crearClaseSchema.safeParse(sinInvestigador);
    expect(result.success).toBe(false);
    if (!result.success) {
      const campos = result.error.issues.map((i) => i.path[0]);
      expect(campos).toContain("investigador");
    }
  });

  it("rechaza cuando falta el campo 'edicionId'", () => {
    const { edicionId, ...sinEdicionId } = claseValida;
    const result = crearClaseSchema.safeParse(sinEdicionId);
    expect(result.success).toBe(false);
    if (!result.success) {
      const campos = result.error.issues.map((i) => i.path[0]);
      expect(campos).toContain("edicionId");
    }
  });

  it("rechaza edicionId que no es un cuid válido", () => {
    const result = crearClaseSchema.safeParse({
      ...claseValida,
      edicionId: "no-es-un-cuid",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const campos = result.error.issues.map((i) => i.path[0]);
      expect(campos).toContain("edicionId");
    }
  });

  it("rechaza nombre vacío", () => {
    const result = crearClaseSchema.safeParse({ ...claseValida, nombre: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const campos = result.error.issues.map((i) => i.path[0]);
      expect(campos).toContain("nombre");
    }
  });

  it("rechaza nombre que supera 200 caracteres", () => {
    const result = crearClaseSchema.safeParse({
      ...claseValida,
      nombre: "A".repeat(201),
    });
    expect(result.success).toBe(false);
  });

  it("rechaza investigador vacío", () => {
    const result = crearClaseSchema.safeParse({
      ...claseValida,
      investigador: "",
    });
    expect(result.success).toBe(false);
  });

  it("rechaza descripción que supera 1000 caracteres", () => {
    const result = crearClaseSchema.safeParse({
      ...claseValida,
      descripcion: "X".repeat(1001),
    });
    expect(result.success).toBe(false);
  });

  it("recorta espacios en blanco del nombre (trim)", () => {
    const result = crearClaseSchema.safeParse({
      ...claseValida,
      nombre: "  Robótica  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.nombre).toBe("Robótica");
    }
  });

  it("rechaza input completamente vacío", () => {
    const result = crearClaseSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThanOrEqual(3);
    }
  });
});

// ── Tests: editarClaseSchema ──────────────────────────────────────────────────

describe("editarClaseSchema", () => {
  it("acepta un objeto vacío (ningún campo es obligatorio en edición parcial)", () => {
    const result = editarClaseSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("acepta actualizar solo el nombre", () => {
    const result = editarClaseSchema.safeParse({ nombre: "Biología Marina" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.nombre).toBe("Biología Marina");
    }
  });

  it("acepta actualizar solo el investigador", () => {
    const result = editarClaseSchema.safeParse({
      investigador: "Dra. Ana García",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.investigador).toBe("Dra. Ana García");
    }
  });

  it("acepta poner descripción en null (para limpiarla)", () => {
    const result = editarClaseSchema.safeParse({ descripcion: null });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.descripcion).toBeNull();
    }
  });

  it("rechaza nombre vacío en edición parcial", () => {
    const result = editarClaseSchema.safeParse({ nombre: "" });
    expect(result.success).toBe(false);
  });

  it("rechaza investigador vacío en edición parcial", () => {
    const result = editarClaseSchema.safeParse({ investigador: "" });
    expect(result.success).toBe(false);
  });
});

// ── Tests: crearSesionSchema ──────────────────────────────────────────────────

describe("crearSesionSchema", () => {
  it("acepta una sesión válida con todos los campos", () => {
    const result = crearSesionSchema.safeParse(sesionValida);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.claseId).toBe(sesionValida.claseId);
      expect(result.data.fecha).toBe("2025-03-15T10:00:00.000Z");
      expect(result.data.temas).toBe("Sistema solar");
    }
  });

  it("acepta una sesión válida sin temas ni notas (campos opcionales)", () => {
    const { temas, notas, ...sinOpcionales } = sesionValida;
    const result = crearSesionSchema.safeParse(sinOpcionales);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.temas).toBeUndefined();
      expect(result.data.notas).toBeUndefined();
    }
  });

  it("rechaza cuando falta el campo 'claseId'", () => {
    const { claseId, ...sinClaseId } = sesionValida;
    const result = crearSesionSchema.safeParse(sinClaseId);
    expect(result.success).toBe(false);
    if (!result.success) {
      const campos = result.error.issues.map((i) => i.path[0]);
      expect(campos).toContain("claseId");
    }
  });

  it("rechaza cuando falta el campo 'fecha'", () => {
    const { fecha, ...sinFecha } = sesionValida;
    const result = crearSesionSchema.safeParse(sinFecha);
    expect(result.success).toBe(false);
    if (!result.success) {
      const campos = result.error.issues.map((i) => i.path[0]);
      expect(campos).toContain("fecha");
    }
  });

  it("rechaza fecha en formato no ISO 8601", () => {
    const result = crearSesionSchema.safeParse({
      ...sesionValida,
      fecha: "15/03/2025",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const campos = result.error.issues.map((i) => i.path[0]);
      expect(campos).toContain("fecha");
    }
  });

  it("rechaza claseId que no es un cuid válido", () => {
    const result = crearSesionSchema.safeParse({
      ...sesionValida,
      claseId: "id-invalido",
    });
    expect(result.success).toBe(false);
  });

  it("rechaza temas que superan 500 caracteres", () => {
    const result = crearSesionSchema.safeParse({
      ...sesionValida,
      temas: "T".repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it("rechaza notas que superan 1000 caracteres", () => {
    const result = crearSesionSchema.safeParse({
      ...sesionValida,
      notas: "N".repeat(1001),
    });
    expect(result.success).toBe(false);
  });
});

// ── Tests: actualizarSesionSchema ─────────────────────────────────────────────

describe("actualizarSesionSchema", () => {
  it("acepta un objeto vacío (sin campos requeridos)", () => {
    const result = actualizarSesionSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("acepta actualizar solo los temas", () => {
    const result = actualizarSesionSchema.safeParse({ temas: "Galaxias" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.temas).toBe("Galaxias");
    }
  });

  it("acepta actualizar solo las notas", () => {
    const result = actualizarSesionSchema.safeParse({
      notas: "El grupo fue muy participativo",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.notas).toBe("El grupo fue muy participativo");
    }
  });

  it("acepta poner temas en null (para limpiarlos)", () => {
    const result = actualizarSesionSchema.safeParse({ temas: null });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.temas).toBeNull();
    }
  });

  it("rechaza temas que superan 500 caracteres", () => {
    const result = actualizarSesionSchema.safeParse({ temas: "X".repeat(501) });
    expect(result.success).toBe(false);
  });

  it("rechaza notas que superan 1000 caracteres", () => {
    const result = actualizarSesionSchema.safeParse({
      notas: "Y".repeat(1001),
    });
    expect(result.success).toBe(false);
  });

  it("recorta espacios en blanco de los temas (trim)", () => {
    const result = actualizarSesionSchema.safeParse({ temas: "  Física cuántica  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.temas).toBe("Física cuántica");
    }
  });
});
