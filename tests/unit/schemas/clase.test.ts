import { describe, it, expect } from "vitest";
import {
  crearClaseSchema,
  editarClaseSchema,
  crearSesionSchema,
  actualizarSesionSchema,
  subirImagenClaseSchema,
} from "@/lib/schemas/clase.schema";

// ── Datos de prueba base ──────────────────────────────────────────────────────

const claseValida = {
  edicionId:    "clxyz1234567890abcdef0001",
  nombre:       "Astronomía",
  investigador: "Dr. Juan Pérez",
  // La fecha es obligatoria: la clase se crea junto con la sesión en que se
  // imparte, porque sin sesión no se le puede pasar lista.
  fecha:        "2025-03-15",
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

  it("rechaza edicionId vacío", () => {
    const result = crearClaseSchema.safeParse({
      ...claseValida,
      edicionId: "",
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

  it("rechaza una clase sin fecha: nacería sin sesión y sin poder pasar lista", () => {
    const { fecha, ...sinFecha } = claseValida;
    const result = crearClaseSchema.safeParse(sinFecha);
    expect(result.success).toBe(false);
    if (!result.success) {
      const campos = result.error.issues.map((i) => i.path[0]);
      expect(campos).toContain("fecha");
    }
  });

  it("normaliza la fecha al día de calendario en UTC", () => {
    const result = crearClaseSchema.safeParse({ ...claseValida, fecha: "2025-03-15" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fecha).toEqual(new Date("2025-03-15T00:00:00.000Z"));
    }
  });

  it("rechaza una fecha con formato inválido", () => {
    const result = crearClaseSchema.safeParse({ ...claseValida, fecha: "15/03/2025" });
    expect(result.success).toBe(false);
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

  it("acepta corregir solo la fecha y la normaliza a UTC", () => {
    const result = editarClaseSchema.safeParse({ fecha: "2025-04-12" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fecha).toEqual(new Date("2025-04-12T00:00:00.000Z"));
      expect(result.data.nombre).toBeUndefined();
    }
  });

  it("rechaza una fecha inexistente en el calendario", () => {
    const result = editarClaseSchema.safeParse({ fecha: "2025-02-31" });
    expect(result.success).toBe(false);
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
      expect(result.data.fecha).toEqual(new Date("2025-03-15T00:00:00.000Z"));
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

  it("acepta el formato 'AAAA-MM-DD' que manda <input type=\"date\">", () => {
    // Regresión: el formulario de nueva sesión mandaba "2025-04-05" y el schema
    // exigía un ISO 8601 completo, así que crear una sesión desde la interfaz
    // siempre devolvía 422.
    const result = crearSesionSchema.safeParse({ ...sesionValida, fecha: "2025-04-05" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fecha).toEqual(new Date("2025-04-05T00:00:00.000Z"));
    }
  });

  it("normaliza a medianoche UTC sin correr el día (sábado)", () => {
    const result = crearSesionSchema.safeParse({ ...sesionValida, fecha: "2025-03-08" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fecha.toISOString()).toBe("2025-03-08T00:00:00.000Z");
    }
  });

  it("rechaza una fecha que no existe en el calendario", () => {
    const result = crearSesionSchema.safeParse({ ...sesionValida, fecha: "2025-02-31" });
    expect(result.success).toBe(false);
  });

  it("rechaza claseId vacío", () => {
    const result = crearSesionSchema.safeParse({
      ...sesionValida,
      claseId: "",
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

  it("acepta corregir la fecha de la sesión", () => {
    // Regresión: el schema no declaraba 'fecha', así que un dedazo en el año
    // quedaba permanente en cuanto la sesión tenía asistencias.
    const result = actualizarSesionSchema.safeParse({ fecha: "2025-03-08" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fecha).toEqual(new Date("2025-03-08T00:00:00.000Z"));
    }
  });

  it("rechaza una fecha con formato inválido al actualizar", () => {
    const result = actualizarSesionSchema.safeParse({ fecha: "08/03/2025" });
    expect(result.success).toBe(false);
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

// ── subirImagenClaseSchema ────────────────────────────────────────────────────

describe("subirImagenClaseSchema", () => {
  const PNG_1X1 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

  it("acepta un PNG válido en base64", () => {
    const result = subirImagenClaseSchema.safeParse({
      mimeType: "image/png",
      data: PNG_1X1,
    });
    expect(result.success).toBe(true);
  });

  it("acepta un título opcional y lo recorta", () => {
    const result = subirImagenClaseSchema.safeParse({
      mimeType: "image/webp",
      data: PNG_1X1,
      titulo: "  Cartel de la clase  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.titulo).toBe("Cartel de la clase");
    }
  });

  it("rechaza formatos que no son imagen permitida", () => {
    const result = subirImagenClaseSchema.safeParse({
      mimeType: "application/pdf",
      data: PNG_1X1,
    });
    expect(result.success).toBe(false);
  });

  it("rechaza contenido que no es base64", () => {
    const result = subirImagenClaseSchema.safeParse({
      mimeType: "image/png",
      data: "no-es-base64-¡óé!",
    });
    expect(result.success).toBe(false);
  });

  it("rechaza imágenes que superan el tamaño máximo", () => {
    const result = subirImagenClaseSchema.safeParse({
      mimeType: "image/jpeg",
      data: "A".repeat(5 * 1024 * 1024),
    });
    expect(result.success).toBe(false);
  });

  it("rechaza contenido vacío", () => {
    const result = subirImagenClaseSchema.safeParse({
      mimeType: "image/png",
      data: "",
    });
    expect(result.success).toBe(false);
  });
});
