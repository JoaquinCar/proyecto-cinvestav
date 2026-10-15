/**
 * Vacía la base de datos para recargar una edición desde cero.
 *
 *   CONFIRMAR=si npm run limpiar
 *
 * ⚠️  BORRA DATOS REALES Y NO SE DESHACE. Respalda ANTES:
 *
 *   npm run respaldar
 *
 * CONSERVA las cuentas de usuario a propósito: sin ellas nadie podría entrar
 * a cargar nada después, ni siquiera para arreglar el estropicio.
 *
 * Las FOTOS: se borran sus registros, pero los archivos siguen ocupando sitio
 * en Supabase Storage, ya sin nada que los enlace. Hay que limpiarlos aparte
 * desde el panel de Supabase si se quiere recuperar el espacio.
 */
import { PrismaClient } from "@prisma/client";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("\n✗ No hay DATABASE_URL.\n");
  process.exit(1);
}

// Nunca imprimir la URL completa: lleva la contraseña.
console.log(`\n  Base: ${url.replace(/^.*@/, "").replace(/[?].*$/, "")}\n`);

if (process.env.CONFIRMAR !== "si") {
  console.error("  Falta CONFIRMAR=si. Nada se ha tocado.\n");
  process.exit(1);
}

const prisma = new PrismaClient();

// El orden lo mandan las llaves foráneas: cada tabla antes que aquellas de las
// que depende. `inscripcion` va antes que `acompanante` porque esa relación es
// Restrict a propósito: borrar una ficha que todavía acompaña a alguien
// desligaría a varios niños de golpe.
const ORDEN = [
  "asistencia",
  "resumenSesion",
  "imagenClase",
  "staffClase",
  "sesion",
  "clase",
  "inscripcion",
  "acompanante",
  "participante",
  "staff",
  "edicion",
];

try {
  console.log("  ANTES");
  for (const t of ORDEN) {
    const n = await prisma[t].count();
    if (n) console.log(`    ${t.padEnd(16)} ${n}`);
  }
  console.log(`    ${"usuarios".padEnd(16)} ${await prisma.user.count()}  (se conservan)\n`);

  for (const t of ORDEN) {
    const { count } = await prisma[t].deleteMany({});
    if (count) console.log(`  · ${count} de ${t}`);
  }

  let resto = 0;
  console.log("\n  DESPUÉS");
  for (const t of ORDEN) {
    const n = await prisma[t].count();
    resto += n;
    if (n) console.log(`    ⚠ ${t}: ${n}`);
  }
  console.log(
    `    ${resto === 0 ? "✓ vacía" : "✗ QUEDAN RESTOS"} · usuarios: ${await prisma.user.count()}\n`,
  );
} finally {
  await prisma.$disconnect();
}
