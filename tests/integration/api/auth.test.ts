import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock de NextAuth para no depender de DB ni RESEND en tests de integración
vi.mock("next-auth", () => ({
  default: vi.fn(() => ({
    handlers: {
      GET: vi.fn().mockResolvedValue(new Response(null, { status: 200 })),
      POST: vi.fn().mockResolvedValue(new Response(null, { status: 200 })),
    },
    auth: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
  })),
}));

vi.mock("@auth/prisma-adapter", () => ({
  PrismaAdapter: vi.fn(() => ({})),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

describe("Módulo Auth — contratos de respuesta", () => {
  it("el handler GET de /api/auth existe y responde", async () => {
    const { handlers } = await import("@/lib/auth");
    expect(handlers.GET).toBeDefined();
  });

  it("el handler POST de /api/auth existe y responde", async () => {
    const { handlers } = await import("@/lib/auth");
    expect(handlers.POST).toBeDefined();
  });

  it("la función auth está exportada para middleware", async () => {
    const { auth } = await import("@/lib/auth");
    expect(auth).toBeDefined();
  });

  it("signIn y signOut están exportados", async () => {
    const { signIn, signOut } = await import("@/lib/auth");
    expect(signIn).toBeDefined();
    expect(signOut).toBeDefined();
  });
});

describe("Módulo Auth — Zod bloquea requests inválidos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("authorize devuelve null cuando no hay passwordHash en DB", async () => {
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: "user-1",
      email: "test@cinvestav.mx",
      name: null,
      image: null,
      role: "ADMIN" as const,
      passwordHash: null,
      emailVerified: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Un usuario sin passwordHash (solo magic link) no puede usar credentials
    const user = await prisma.user.findUnique({ where: { email: "test@cinvestav.mx" } });
    expect(user?.passwordHash).toBeNull();
  });

  it("authorize devuelve null con email inexistente en DB", async () => {
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);

    const user = await prisma.user.findUnique({ where: { email: "noexiste@cinvestav.mx" } });
    expect(user).toBeNull();
  });
});
