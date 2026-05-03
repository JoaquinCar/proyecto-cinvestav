import { describe, it, expect } from "vitest";
import { z } from "zod";

// Mismo schema que src/lib/auth/config.ts — se valida independientemente
const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

describe("credentialsSchema", () => {
  it("acepta email y contraseña válidos", () => {
    const result = credentialsSchema.safeParse({
      email: "admin@cinvestav.mx",
      password: "secreto123",
    });
    expect(result.success).toBe(true);
  });

  it("rechaza email malformado", () => {
    const result = credentialsSchema.safeParse({
      email: "no-es-email",
      password: "secreto123",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("email");
  });

  it("rechaza contraseña menor a 6 caracteres", () => {
    const result = credentialsSchema.safeParse({
      email: "admin@cinvestav.mx",
      password: "123",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("password");
  });

  it("rechaza input sin campos requeridos", () => {
    const result = credentialsSchema.safeParse({});
    expect(result.success).toBe(false);
    expect(result.error?.issues.length).toBeGreaterThanOrEqual(2);
  });

  it("rechaza email vacío", () => {
    const result = credentialsSchema.safeParse({
      email: "",
      password: "secreto123",
    });
    expect(result.success).toBe(false);
  });
});
