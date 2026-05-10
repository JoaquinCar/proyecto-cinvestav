import { describe, it, expect } from "vitest";
import { generarPDFConstancia } from "@/lib/pdf/constancia";

describe("generarPDFConstancia", () => {
  it("retorna Buffer válido iniciando con %PDF", async () => {
    const buffer = await generarPDFConstancia({
      nombre: "Ana",
      apellidos: "García López",
      escuela: "Primaria Centro",
      grado: "3°",
      edicion: { nombre: "Pasaporte Científico", anio: 2026 },
      asistencias: 6,
      totalSesiones: 8,
      fechaEmision: "8 de mayo de 2026",
    });
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(200);
    expect(buffer.slice(0, 4).toString()).toBe("%PDF");
  });
});
