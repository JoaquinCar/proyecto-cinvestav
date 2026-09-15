import { describe, it, expect } from "vitest";

import {
  acompananteSchema,
  asignarAcompananteSchema,
  busquedaAcompananteSchema,
  PARENTESCOS,
} from "@/lib/schemas/acompanante.schema";

// ─────────────────────────────────────────────────────────────────────────────
// El acompañante es opcional en todo el flujo de registro, pero cuando se
// captura tiene que quedar identificable: un nombre de verdad y, si se da un
// correo, que sea un correo. Lo que NO puede pasar es que un espacio en blanco
// cuente como nombre — ese texto es el que verá el becario para reutilizarlo.
// ─────────────────────────────────────────────────────────────────────────────

describe("acompananteSchema — alta de un acompañante", () => {
  it("acepta lo mínimo: nombre y parentesco", () => {
    const r = acompananteSchema.safeParse({
      nombre: "Laura",
      parentesco: "MADRE",
    });
    expect(r.success).toBe(true);
  });

  it("recorta los espacios del nombre antes de guardarlo", () => {
    const r = acompananteSchema.safeParse({
      nombre: "  Laura  ",
      apellidos: "  Pérez Gómez ",
      parentesco: "MADRE",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.nombre).toBe("Laura");
      expect(r.data.apellidos).toBe("Pérez Gómez");
    }
  });

  it("rechaza un nombre de solo espacios", () => {
    const r = acompananteSchema.safeParse({
      nombre: "   ",
      parentesco: "MADRE",
    });
    expect(r.success).toBe(false);
  });

  it("rechaza un correo que no es correo", () => {
    const r = acompananteSchema.safeParse({
      nombre: "Laura",
      parentesco: "MADRE",
      correo: "no-es-un-correo",
    });
    expect(r.success).toBe(false);
  });

  it("acepta correo y teléfono vacíos como ausentes", () => {
    const r = acompananteSchema.safeParse({
      nombre: "Laura",
      parentesco: "MADRE",
      correo: "",
      telefono: "",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.correo).toBeUndefined();
      expect(r.data.telefono).toBeUndefined();
    }
  });

  it("cubre los parentescos colectivos, no solo los familiares", () => {
    // Los 25 niños de un grupo organizado comparten acompañante y no son
    // hermanos: sin GRUPO / INSTITUCION habría que mentir marcándolos "TUTOR".
    expect(PARENTESCOS).toContain("GRUPO");
    expect(PARENTESCOS).toContain("INSTITUCION");
    expect(acompananteSchema.safeParse({
      nombre: "Grupo Zarigüeyas",
      parentesco: "GRUPO",
    }).success).toBe(true);
  });

  it("rechaza un parentesco que no está en la lista", () => {
    const r = acompananteSchema.safeParse({
      nombre: "Laura",
      parentesco: "PRIMO_SEGUNDO",
    });
    expect(r.success).toBe(false);
  });
});

describe("asignarAcompananteSchema — reutilizar o crear", () => {
  it("acepta el id de un acompañante que ya existe", () => {
    const r = asignarAcompananteSchema.safeParse({ acompananteId: "a1" });
    expect(r.success).toBe(true);
  });

  it("acepta los datos de uno nuevo", () => {
    const r = asignarAcompananteSchema.safeParse({
      acompanante: { nombre: "Laura", parentesco: "MADRE" },
    });
    expect(r.success).toBe(true);
  });

  it("rechaza un cuerpo vacío: hay que decir a quién se liga", () => {
    const r = asignarAcompananteSchema.safeParse({});
    expect(r.success).toBe(false);
  });

  it("rechaza mandar las dos cosas a la vez", () => {
    // Mandar id Y datos nuevos es ambiguo: o se reutiliza o se crea. Aceptar
    // ambos abre la puerta a crear un duplicado del que ya se eligió.
    const r = asignarAcompananteSchema.safeParse({
      acompananteId: "a1",
      acompanante: { nombre: "Laura", parentesco: "MADRE" },
    });
    expect(r.success).toBe(false);
  });
});

describe("busquedaAcompananteSchema", () => {
  it("acepta una búsqueda vacía", () => {
    expect(busquedaAcompananteSchema.safeParse({}).success).toBe(true);
  });

  it("acepta texto de búsqueda", () => {
    const r = busquedaAcompananteSchema.safeParse({ q: "Laura" });
    expect(r.success).toBe(true);
  });
});
