import { describe, it, expect } from "vitest";
import {
  moverImagen,
  posicionDestino,
  type Movimiento,
} from "@/lib/orden-imagenes";

const IDS = ["a", "b", "c", "d"];

describe("moverImagen", () => {
  it("sube una imagen una posición", () => {
    expect(moverImagen(IDS, "c", "subir")).toEqual(["a", "c", "b", "d"]);
  });

  it("baja una imagen una posición", () => {
    expect(moverImagen(IDS, "b", "bajar")).toEqual(["a", "c", "b", "d"]);
  });

  it("manda una imagen al inicio", () => {
    expect(moverImagen(IDS, "d", "inicio")).toEqual(["d", "a", "b", "c"]);
  });

  it("manda una imagen al final", () => {
    expect(moverImagen(IDS, "a", "final")).toEqual(["b", "c", "d", "a"]);
  });

  it("no hace nada si la primera intenta subir", () => {
    const resultado = moverImagen(IDS, "a", "subir");
    expect(resultado).toEqual(IDS);
    // Misma referencia: la UI puede usarla para saber que no hay nada que guardar.
    expect(resultado).toBe(IDS);
  });

  it("no hace nada si la última intenta bajar", () => {
    expect(moverImagen(IDS, "d", "bajar")).toBe(IDS);
  });

  it("ignora un id que no está en la lista", () => {
    expect(moverImagen(IDS, "z", "subir")).toBe(IDS);
  });

  it("nunca pierde ni duplica imágenes", () => {
    const movimientos: Movimiento[] = ["subir", "bajar", "inicio", "final"];
    for (const movimiento of movimientos) {
      for (const id of IDS) {
        const resultado = moverImagen(IDS, id, movimiento);
        expect([...resultado].sort()).toEqual([...IDS].sort());
        expect(new Set(resultado).size).toBe(IDS.length);
      }
    }
  });

  it("no modifica la lista original", () => {
    const original = [...IDS];
    moverImagen(IDS, "c", "inicio");
    expect(IDS).toEqual(original);
  });
});

describe("posicionDestino", () => {
  it("describe a dónde va la imagen, en posiciones que ve la persona (1..n)", () => {
    expect(posicionDestino(IDS, "c", "subir")).toBe(2);
    expect(posicionDestino(IDS, "c", "bajar")).toBe(4);
    expect(posicionDestino(IDS, "c", "inicio")).toBe(1);
    expect(posicionDestino(IDS, "c", "final")).toBe(4);
  });

  it("devuelve null cuando el movimiento no cambia nada", () => {
    expect(posicionDestino(IDS, "a", "subir")).toBeNull();
    expect(posicionDestino(IDS, "d", "bajar")).toBeNull();
    expect(posicionDestino(IDS, "a", "inicio")).toBeNull();
    expect(posicionDestino(IDS, "d", "final")).toBeNull();
    expect(posicionDestino(IDS, "z", "subir")).toBeNull();
  });
});
