/**
 * Administración de usuarios del sistema.
 *
 * No existe una pantalla para crear usuarios: solo puede entrar quien esté en la
 * tabla `User` con `passwordHash`. Este script cubre ese hueco.
 *
 *   Listar usuarios:
 *     npx tsx scripts/admin-usuarios.ts
 *
 *   Crear un ADMIN o restablecer su contraseña:
 *     npx tsx scripts/admin-usuarios.ts correo@ejemplo.mx "MiContraseña"
 *
 *   Con otro rol:
 *     npx tsx scripts/admin-usuarios.ts correo@ejemplo.mx "MiContraseña" BECARIO
 *
 * Usa el DATABASE_URL del entorno; para tocar producción, expórtalo antes de correr.
 */

import { PrismaClient, type Role } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

const ROLES: Role[] = ["ADMIN", "BECARIO", "READONLY"];
const MIN_PASSWORD = 8; // el login exige 6; aquí subimos el piso al crear

async function listarUsuarios() {
  const usuarios = await prisma.user.findMany({
    select: { email: true, name: true, role: true, passwordHash: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  if (usuarios.length === 0) {
    console.log("No hay usuarios en esta base de datos.");
    console.log('Crea uno: npx tsx scripts/admin-usuarios.ts correo@ejemplo.mx "TuContraseña"');
    return;
  }

  console.log(`${usuarios.length} usuario(s):\n`);
  for (const u of usuarios) {
    // Nunca imprimimos el hash, solo si existe
    console.log(
      `  ${u.email.padEnd(32)} ${u.role.padEnd(9)} contraseña: ${u.passwordHash ? "sí" : "NO — no puede entrar"}`
    );
  }
}

async function guardarUsuario(email: string, password: string, role: Role) {
  const passwordHash = await hash(password, 12);

  const existente = await prisma.user.findUnique({ where: { email }, select: { id: true } });

  const usuario = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role },
    create: { email, passwordHash, role, name: email.split("@")[0] },
    select: { email: true, role: true },
  });

  console.log(
    existente
      ? `Contraseña restablecida para ${usuario.email} (rol ${usuario.role}).`
      : `Usuario creado: ${usuario.email} (rol ${usuario.role}).`
  );
  console.log("Ya puedes entrar con ese correo y esa contraseña.");
}

async function main() {
  const [email, password, rolArg] = process.argv.slice(2);

  if (!email) {
    await listarUsuarios();
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error(`Correo inválido: ${email}`);
  }

  if (!password) {
    throw new Error('Falta la contraseña: npx tsx scripts/admin-usuarios.ts correo@ejemplo.mx "TuContraseña"');
  }

  if (password.length < MIN_PASSWORD) {
    throw new Error(`La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`);
  }

  const role = (rolArg?.toUpperCase() ?? "ADMIN") as Role;
  if (!ROLES.includes(role)) {
    throw new Error(`Rol inválido: ${rolArg}. Usa uno de: ${ROLES.join(", ")}`);
  }

  await guardarUsuario(email.toLowerCase().trim(), password, role);
  console.log("");
  await listarUsuarios();
}

main()
  .catch((e) => {
    console.error(`\n✗ ${e instanceof Error ? e.message : e}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
