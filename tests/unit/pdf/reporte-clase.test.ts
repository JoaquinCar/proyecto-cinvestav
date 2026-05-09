import { describe, it, expect } from "vitest";
import { generarPDFReporteClase } from "@/lib/pdf/reporte-clase";

describe("generarPDFReporteClase", () => {
  it("retorna Buffer válido iniciando con %PDF", async () => {
    const buffer = await generarPDFReporteClase({
      clase: { nombre: "Astronomía", investigador: "Dr. Pérez" },
      edicion: { nombre: "Pasaporte Científico", anio: 2026 },
      sesiones: [
        { fecha: "3 mar 2026", temas: "Sistema solar", asistentes: 5, total: 8 },
      ],
      participantes: [
        { nombre: "Ana", apellidos: "García", escuela: "Primaria Centro", asistenciasEnClase: 1 },
      ],
      totalParticipantes: 8,
      promedioAsistencia: 63,
    });
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(200);
    expect(buffer.slice(0, 4).toString()).toBe("%PDF");
  });
});
