// Carga la edición REAL 2026: limpia datos demo y carga registro + asistencia agregada.
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";

const prisma = new PrismaClient();
const participantes = JSON.parse(readFileSync("scripts/data/participantes-2026.json", "utf8"));
const sesiones = JSON.parse(readFileSync("scripts/data/asistencia-2026.json", "utf8"));

async function main() {
  console.log("── Limpiando datos previos (demo) ──");
  await prisma.asistencia.deleteMany({});
  await prisma.resumenSesion.deleteMany({});
  await prisma.sesion.deleteMany({});
  await prisma.clase.deleteMany({});
  await prisma.inscripcion.deleteMany({});
  await prisma.participante.deleteMany({});
  await prisma.edicion.deleteMany({});
  console.log("  ✓ Datos previos eliminados");

  // ── Edición 2026 ──
  const conFecha = sesiones.filter((s) => s.fecha).map((s) => new Date(s.fecha));
  const fechaInicio = new Date(Math.min(...conFecha.map((d) => d.getTime())));
  const fechaFin = new Date(Math.max(...conFecha.map((d) => d.getTime())));

  const edicion = await prisma.edicion.create({
    data: {
      anio: 2026,
      nombre: "Pasaporte Científico Mérida 2026",
      fechaInicio,
      fechaFin,
      minAsistencias: 6,
      asistenciaGlobal: true,
      activa: true,
    },
  });
  console.log(`  ✓ Edición creada: ${edicion.nombre} (activa)`);

  // ── Clases + Sesiones + Resumen (una clase por tema/sesión) ──
  let nClases = 0, nResumen = 0;
  for (const s of sesiones.sort((a, b) => a.orden - b.orden)) {
    const clase = await prisma.clase.create({
      data: {
        edicionId: edicion.id,
        nombre: s.tema,
        investigador: "Investigador(a) invitado(a) · CINVESTAV",
        descripcion: `Sesión ${s.orden} · ${s.fechaTexto} · Sede ${s.sede}`,
      },
    });
    nClases++;
    const sesion = await prisma.sesion.create({
      data: {
        claseId: clase.id,
        fecha: s.fecha ? new Date(s.fecha) : edicion.fechaInicio,
        temas: s.tema,
        notas: s.conDatos ? null : "Sesión sin datos de asistencia registrados.",
      },
    });
    if (s.conDatos) {
      await prisma.resumenSesion.create({
        data: {
          sesionId: sesion.id,
          ninas: s.ninas, ninos: s.ninos, total: s.total,
          mamas: s.mamas, papas: s.papas,
          preescolar: s.preescolar, primaria: s.primaria,
          secundaria: s.secundaria, mediaSuperior: s.mediaSuperior,
          porEdad: s.porEdad,
        },
      });
      nResumen++;
    }
  }
  console.log(`  ✓ ${nClases} clases/sesiones · ${nResumen} con resumen de asistencia`);

  // ── Participantes + Inscripciones ──
  let nPart = 0;
  for (const p of participantes) {
    const participante = await prisma.participante.create({
      data: {
        nombre: p.nombre,
        apellidos: p.apellidos,
        edad: p.edad,
        escuela: p.escuela,
        grado: p.grado,
        genero: p.genero,
        nivel: p.nivel,
        correo: p.correo || null,
        telefono: p.telefono || null,
        ciudad: p.ciudad || null,
      },
    });
    await prisma.inscripcion.create({
      data: { participanteId: participante.id, edicionId: edicion.id },
    });
    nPart++;
  }
  console.log(`  ✓ ${nPart} participantes + inscripciones`);

  console.log("\n✅ Carga 2026 completada.");
}

main()
  .catch((e) => { console.error("ERROR:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
