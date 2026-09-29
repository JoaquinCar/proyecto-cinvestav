/**
 * Restaura un respaldo sobre una base de datos.
 *
 *   npm run restaurar -- respaldos/pasaporte-AAAAMMDD-HHMM.json.gz
 *
 * ESTE SCRIPT BORRA Y REESCRIBE LA BASE DE DESTINO. Por eso dice en voz alta a
 * dónde va a escribir y exige confirmación antes de tocar nada.
 *
 * El esquema debe existir ya: primero `npx prisma migrate deploy`, luego esto.
 * Ver docs/respaldos.md.
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync, existsSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { descifrar, estaCifrado } from "./cifrado.mjs";

// Al borrar hay que ir al revés que al insertar: primero lo que depende.
const ORDEN = [
  "user", "account", "verificationToken",
  "edicion", "participante", "acompanante", "inscripcion",
  "clase", "sesion", "resumenSesion", "asistencia",
  "imagenClase", "staff", "staffClase",
];

function abortar(m) { console.error(`\n✗ ${m}\n`); process.exit(1); }

const archivo = process.argv[2];
if (!archivo) abortar("Falta el archivo.\n  npm run restaurar -- respaldos/pasaporte-AAAAMMDD-HHMM.json.gz");
if (!existsSync(archivo)) abortar(`No existe: ${archivo}`);

const url = process.env.DATABASE_URL;
if (!url) abortar("No hay DATABASE_URL.");
const host = url.replace(/^.*@/, "").replace(/[?].*$/, "");
const esProduccion = !/localhost|127\.0\.0\.1/.test(host);

let crudo = readFileSync(archivo);
if (estaCifrado(crudo)) {
  const clave = process.env.RESPALDO_CLAVE;
  if (!clave) {
    abortar(
      "Este respaldo está cifrado y no hay RESPALDO_CLAVE.\n" +
        "  La clave está en el USB del proyecto (CLAVES.md) y con el coordinador.\n" +
        "    RESPALDO_CLAVE='...' CONFIRMAR_RESTAURACION=si npm run restaurar -- " + archivo,
    );
  }
  try { crudo = descifrar(crudo, clave); } catch (e) { abortar(e.message); }
}
const { generado, datos } = JSON.parse(gunzipSync(crudo).toString("utf8"));
if (!datos?.participante) abortar("El archivo no parece un respaldo de este proyecto.");

const total = Object.values(datos).reduce((a, f) => a + f.length, 0);
console.log(`\n  Archivo  : ${archivo}`);
console.log(`  Generado : ${generado}`);
console.log(`  Contenido: ${total} filas — ${datos.participante.length} participantes, ${datos.inscripcion?.length ?? 0} inscripciones`);
console.log(`  DESTINO  : ${host}${esProduccion ? "   ⚠️  ESTO ES PRODUCCIÓN" : "   (base local)"}`);

if (process.env.CONFIRMAR_RESTAURACION !== "si") {
  console.error(
    `\n✗ Abortado: esto BORRA y reescribe la base de arriba.\n\n` +
      `  Si es lo que quieres:\n    CONFIRMAR_RESTAURACION=si npm run restaurar -- ${archivo}\n`,
  );
  process.exit(1);
}

const prisma = new PrismaClient();
try {
  console.log("\n  Borrando lo que hay…");
  for (const t of [...ORDEN].reverse()) if (prisma[t]) await prisma[t].deleteMany({});

  console.log("  Insertando…");
  for (const t of ORDEN) {
    const filas = datos[t];
    if (!prisma[t] || !filas?.length) continue;
    // createMany no revive fechas desde JSON: hay que reconstruir los Date.
    const limpias = filas.map((f) =>
      Object.fromEntries(Object.entries(f).map(([k, v]) =>
        [k, typeof v === "string" && /^\d{4}-\d\d-\d\dT[\d:.]+Z$/.test(v) ? new Date(v) : v])));
    await prisma[t].createMany({ data: limpias, skipDuplicates: true });
    console.log(`    ${t.padEnd(20)} ${String(filas.length).padStart(5)} filas`);
  }
} catch (e) {
  abortar("Falló a media restauración: " + String(e.message).split("\n")[0].replace(/postgres(ql)?:\/\/\S+/g, "<url oculta>"));
} finally {
  await prisma.$disconnect();
}
console.log(`\n  ✓ Restaurado en ${host}. Comprueba los conteos antes de darlo por bueno.\n`);
