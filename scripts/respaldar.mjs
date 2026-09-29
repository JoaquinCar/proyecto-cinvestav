/**
 * Respaldo de la base de datos a un archivo local.
 *
 *   npm run respaldar
 *
 * Vuelca cada tabla a JSON usando la misma conexión que usa la aplicación, así
 * que no hace falta instalar PostgreSQL ni Docker. El esquema NO se guarda aquí
 * a propósito: lo reconstruyen las migraciones (`prisma migrate deploy`), que
 * es como ya se recuperó la base una vez.
 *
 * El archivo queda en respaldos/, que está en .gitignore. NO se commitea: el
 * repositorio es PÚBLICO y el volcado lleva nombre, edad, escuela, teléfono y
 * correo de cada niño. Viaja en USB. Ver docs/respaldos.md.
 */
import { PrismaClient } from "@prisma/client";
import { mkdirSync, writeFileSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { cifrar } from "./cifrado.mjs";

const DESTINO = "respaldos";

// El orden importa al restaurar: cada tabla va después de aquellas de las que
// depende por llave foránea.
const TABLAS = [
  "user", "account", "verificationToken",
  "edicion", "participante", "acompanante", "inscripcion",
  "clase", "sesion", "resumenSesion", "asistencia",
  "imagenClase", "staff", "staffClase",
];

function abortar(m) { console.error(`\n✗ ${m}\n`); process.exit(1); }

const url = process.env.DATABASE_URL;
if (!url) {
  abortar("No hay DATABASE_URL.\n  export $(grep -E '^(DATABASE_URL|DIRECT_URL)=' .env | xargs) && npm run respaldar");
}
// Nunca imprimir la URL completa: lleva la contraseña.
const host = url.replace(/^.*@/, "").replace(/[?].*$/, "");
console.log(`\n  Respaldando de: ${host}`);

const prisma = new PrismaClient();
const datos = {};
let total = 0;
try {
  for (const t of TABLAS) {
    if (!prisma[t]) continue;
    const filas = await prisma[t].findMany();
    datos[t] = filas;
    total += filas.length;
    console.log(`    ${t.padEnd(20)} ${String(filas.length).padStart(5)} filas`);
  }
} catch (e) {
  // El mensaje de Prisma puede traer la URL: se recorta antes de mostrarlo.
  abortar("Error leyendo la base: " + String(e.message).split("\n")[0].replace(/postgres(ql)?:\/\/\S+/g, "<url oculta>"));
} finally {
  await prisma.$disconnect();
}

if (!datos.participante || !datos.inscripcion) {
  abortar("El volcado no trae las tablas esperadas. NO sirve como respaldo.");
}

mkdirSync(DESTINO, { recursive: true });
const sello = new Date().toISOString().slice(0, 16).replace(/[-:]/g, "").replace("T", "-");
const clave = process.env.RESPALDO_CLAVE;
const comprimido = gzipSync(JSON.stringify({ generado: new Date().toISOString(), datos }), { level: 9 });
const archivo = `${DESTINO}/pasaporte-${sello}.json.gz${clave ? ".cifrado" : ""}`;
writeFileSync(archivo, clave ? cifrar(comprimido, clave) : comprimido);

if (!clave) {
  console.log("\n  ⚠️  Sin cifrar: no hay RESPALDO_CLAVE.");
  console.log("     Vale para el USB, pero este archivo NO puede subirse a ningún sitio.");
}

console.log(`\n  ✓ ${archivo}  (${(statSync(archivo).size / 1024).toFixed(0)} KB, ${total} filas)`);
if (clave) {
  console.log(`\n  Cifrado. Puede viajar en el USB o guardarse fuera: sin la clave no se abre.\n`);
} else {
  console.log(`\n  Cópialo al USB del proyecto. NO lo subas a ningún sitio: va sin cifrar.\n`);
}
