import { describe, it, expect, vi, afterEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Los avisos que ve la gente.
//
// Hasta ahora decían "Error al crear participante" o "Error de red": no dicen a
// quién, ni por qué, ni qué hacer después. El listón lo puso `eliminarClase`,
// que devuelve el motivo con conteos. Aquí se fija ese listón para el resto.
// ─────────────────────────────────────────────────────────────────────────────

describe("mensajeDeError", () => {
  it("traduce el fallo de red del navegador a algo accionable", async () => {
    const { mensajeDeError, MENSAJE_SIN_CONEXION } = await import(
      "@/lib/api/errores"
    );
    // Así llega un fetch que no salió del teléfono: TypeError en inglés.
    const mensaje = mensajeDeError(new TypeError("Failed to fetch"), "algo falló");

    expect(mensaje).toBe(MENSAJE_SIN_CONEXION);
    expect(mensaje).toMatch(/revisa tu conexión/i);
    expect(mensaje).not.toMatch(/failed to fetch/i);
  });

  it("respeta el motivo concreto que mandó el servidor", async () => {
    const { mensajeDeError } = await import("@/lib/api/errores");
    const delServidor = new Error(
      "El participante ya está inscrito en esta edición, así que no hizo falta volver a inscribirlo.",
    );

    expect(mensajeDeError(delServidor, "no se pudo inscribir")).toContain(
      "ya está inscrito",
    );
  });

  it("cae en el texto por defecto cuando no hay nada que contar", async () => {
    const { mensajeDeError } = await import("@/lib/api/errores");
    expect(mensajeDeError(undefined, "No se pudo guardar la sesión.")).toBe(
      "No se pudo guardar la sesión.",
    );
  });
});

describe("mensajeFalloAccion", () => {
  it("nombra a quién y por qué, en vez de 'Error al crear participante'", async () => {
    const { mensajeFalloAccion } = await import("@/lib/api/errores");

    const mensaje = mensajeFalloAccion(
      "registrar",
      "Juan Pérez",
      "El participante ya está inscrito en esta edición",
    );

    expect(mensaje).toBe(
      "No se pudo registrar a Juan Pérez: el participante ya está inscrito en esta edición.",
    );
  });

  it("no encadena dos puntos finales ni deja mayúscula a media frase", async () => {
    const { mensajeFalloAccion } = await import("@/lib/api/errores");
    const mensaje = mensajeFalloAccion("inscribir", "Ana López", "La edición no está activa.");

    // El nombre conserva su mayúscula; la que se baja es la del motivo.
    expect(mensaje).toBe("No se pudo inscribir a Ana López: la edición no está activa.");
    expect(mensaje).not.toMatch(/\.\./);
  });
});

describe("mensajeAltaSinInscripcion", () => {
  it("no dice que se perdió el trabajo cuando la ficha sí se guardó", async () => {
    const { mensajeAltaSinInscripcion } = await import("@/lib/api/errores");

    const mensaje = mensajeAltaSinInscripcion(
      "Juan Pérez",
      "La edición no está activa",
    );

    // Lo que pasó de verdad: la ficha quedó, la inscripción no.
    expect(mensaje).toMatch(/se guardó la ficha de Juan Pérez/i);
    expect(mensaje).toMatch(/no quedó inscrito/i);
    // Y qué hacer ahora, incluido el error que se evita.
    expect(mensaje).toMatch(/no lo captures de nuevo/i);
    expect(mensaje).not.toMatch(/no se pudo registrar/i);
  });
});

// ── Los avisos no deben sonar a disculpa ni gritar ───────────────────────────

describe("tono de los mensajes", () => {
  it("sin signos de exclamación, sin disculpas y sin em-dashes", async () => {
    const errores = await import("@/lib/api/errores");
    const textos = [
      errores.MENSAJE_SIN_CONEXION,
      errores.mensajeFalloAccion("registrar", "Ana López", "la edición está cerrada"),
      errores.mensajeAltaSinInscripcion("Ana López", "la edición está cerrada"),
    ];

    for (const texto of textos) {
      expect(texto).not.toMatch(/[!¡]/);
      expect(texto).not.toMatch(/—/);
      expect(texto).not.toMatch(/lo sentimos|disculpa|perdón|ups/i);
      // Ni jerga: nada de payload, endpoint, constraint o códigos HTTP.
      expect(texto).not.toMatch(/payload|endpoint|constraint|JSON|HTTP|4\d\d|5\d\d/i);
    }
  });
});

// ── El cliente del API: un fetch que no sale no puede mostrar "Failed to fetch"

describe("cliente de participantes", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("convierte el fallo de red en un aviso con el siguiente paso", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );

    const { crearParticipante } = await import("@/lib/api/participantes");
    const { MENSAJE_SIN_CONEXION } = await import("@/lib/api/errores");

    await expect(
      crearParticipante({
        nombre: "Ana",
        apellidos: "López",
        edad: 9,
        escuela: "Primaria Centro",
        grado: "3° primaria",
      }),
    ).rejects.toThrow(MENSAJE_SIN_CONEXION);
  });

  it("si el servidor responde sin cuerpo, dice qué acción no se completó", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 500 })),
    );

    const { darDeBajaInscripcion } = await import("@/lib/api/participantes");

    await expect(darDeBajaInscripcion("insc-1")).rejects.toThrow(
      /sigue inscrito en la edición/i,
    );
  });
});
