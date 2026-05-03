import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Resend from "next-auth/providers/resend";
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

        if (!usuario || !usuario.passwordHash) return null;

        // Comparar password con bcrypt (nunca texto plano)
        const passwordValido = await compare(password, usuario.passwordHash);
        if (!passwordValido) return null;

        return {
          id: usuario.id,
          email: usuario.email,
          name: usuario.name,
          image: usuario.image,
          role: usuario.role,
        };
      },
    }),

    // ── Resend: magic link ────────────────────────────────────────────────────
    Resend({
      apiKey: process.env.RESEND_API_KEY,
      from: "noreply@pasaporte-cientifico.vercel.app",
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
        // user.role viene del authorize() de Credentials
        // o desde el adapter para magic link — lo consultamos en DB si hace falta
        if (user.role) {
          token.role = user.role;
        } else {
          // Magic link: el adapter crea/busca al usuario; consultamos el role
          const dbUser = await prisma.user.findUnique({
            where: { id: user.id as string },
            select: { role: true },
          });
          token.role = dbUser?.role ?? "READONLY";
        }
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
