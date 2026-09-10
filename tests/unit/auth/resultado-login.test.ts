import { describe, it, expect } from "vitest";
import { interpretarLogin } from "@/lib/auth/resultado-login";

describe("interpretarLogin", () => {
  // Forma REAL que devuelve next-auth 5.0.0-beta.31 con credenciales malas:
  // el endpoint responde HTTP 200, así que `ok` viene en true. Solo `error` sirve.
  it("detecta credenciales incorrectas aunque ok sea true", () => {
    const lectura = interpretarLogin({
      error: "CredentialsSignin",
      code: "credentials",
      status: 200,
      ok: true,
      url: null,
    });

    expect(lectura.entro).toBe(false);
    expect(lectura).toHaveProperty("mensaje", "Correo o contraseña incorrectos.");
  });

  it("acepta el login cuando no hay error", () => {
    const lectura = interpretarLogin({
      error: undefined,
      code: undefined,
      status: 200,
      ok: true,
      url: "https://ejemplo.mx/dashboard",
    });

    expect(lectura.entro).toBe(true);
  });

  it("da un mensaje genérico ante un fallo de configuración", () => {
    const lectura = interpretarLogin({
      error: "Configuration",
      status: 500,
      ok: false,
      url: null,
    });

    expect(lectura.entro).toBe(false);
    expect(lectura).toHaveProperty(
      "mensaje",
      "No se pudo iniciar sesión. Intenta de nuevo en un momento."
    );
  });

  it("nunca reporta éxito si signIn no devolvió nada", () => {
    const lectura = interpretarLogin(undefined);

    expect(lectura.entro).toBe(false);
    expect(lectura).toHaveProperty(
      "mensaje",
      "No se pudo iniciar sesión. Intenta de nuevo en un momento."
    );
  });
});
