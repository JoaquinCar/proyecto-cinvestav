import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { compare } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

// ── Augmentación de tipos ─────────────────────────────────────────────────────

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string | null;
      image: string | null;
      role: Role;
    };
  }

  interface User {
    role?: Role;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: Role;
  }
}

// ── Schema de validación para credenciales ────────────────────────────────────

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

// ── Rate limit básico de login (defensa-en-profundidad) ───────────────────────
// En serverless el Map es por-instancia (no global), pero frena fuerza bruta /
// password spraying sostenido desde una misma instancia. Para 5 usuarios internos
// es proporcional; sin CAPTCHA.
//
// Solo cuenta INTENTOS FALLIDOS: unas credenciales correctas siempre entran, sin
// importar cuántas veces se haya fallado antes. El freno real contra fuerza bruta
// es el costo de bcrypt (~250 ms por intento con cost 12).
const intentosFallidos = new Map<string, { count: number; resetAt: number }>();
const MAX_INTENTOS = 10;
const VENTANA_MS = 10 * 60 * 1000;
const PENALIZACION_MS = 2000;

/** ¿Este correo ya agotó sus intentos fallidos? Solo consulta, no incrementa. */
function estaBloqueado(email: string): boolean {
  const reg = intentosFallidos.get(email);
  if (!reg || Date.now() > reg.resetAt) {
    intentosFallidos.delete(email);
    return false;
  }
  return reg.count >= MAX_INTENTOS;
}

/** Registrar un intento fallido para este correo. */
function registrarFallo(email: string): void {
  const ahora = Date.now();
  const reg = intentosFallidos.get(email);
  if (!reg || ahora > reg.resetAt) {
    intentosFallidos.set(email, { count: 1, resetAt: ahora + VENTANA_MS });
    return;
  }
  reg.count += 1;
}

// ── Configuración NextAuth v5 ─────────────────────────────────────────────────

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),

  providers: [
    // ── Credentials: email + contraseña ──────────────────────────────────────
    Credentials({
      name: "Contraseña",
      credentials: {
        email: { label: "Correo electrónico", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        // Validar inputs con Zod antes de tocar la DB
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        // Si este correo acumula fallos, penalizar la respuesta en vez de bloquear:
        // el atacante avanza lentísimo, pero una contraseña correcta sigue entrando.
        if (estaBloqueado(email)) {
          await new Promise((resolve) => setTimeout(resolve, PENALIZACION_MS));
        }

        // Buscar usuario en DB
        const usuario = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
            role: true,
            passwordHash: true,
          },
        });

        if (!usuario || !usuario.passwordHash) {
          registrarFallo(email);
          return null;
        }

        // Comparar password con bcrypt (nunca texto plano)
        const passwordValido = await compare(password, usuario.passwordHash);
        if (!passwordValido) {
          registrarFallo(email);
          return null;
        }

        // Login correcto: limpiar el contador de fallos
        intentosFallidos.delete(email);

        return {
          id: usuario.id,
          email: usuario.email,
          name: usuario.name,
          image: usuario.image,
          role: usuario.role,
        };
      },
    }),
  ],

  session: { strategy: "jwt" },

  pages: {
    signIn: "/login",
    error: "/login",
  },

  callbacks: {
    // Enriquecer el JWT con id y role en el primer login
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role ?? "READONLY";
      }
      return token;
    },

    // Exponer id y role en la sesión del cliente
    async session({ session, token }) {
      session.user = {
        ...session.user,
        id: token.id,
        role: token.role,
      };
      return session;
    },
  },
});
