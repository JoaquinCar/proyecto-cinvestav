import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // ── Usuarios ─────────────────────────────────────────────────────────────
  const adminHash = await hash("admin123", 12);
  const becarioHash = await hash("becario123", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@cinvestav.mx" },
    update: {},
    create: { email: "admin@cinvestav.mx", name: "Admin CINVESTAV", role: "ADMIN", passwordHash: adminHash },
  });

  const becario = await prisma.user.upsert({
    where: { email: "becario@cinvestav.mx" },
    update: {},
    create: { email: "becario@cinvestav.mx", name: "Becario Prueba", role: "BECARIO", passwordHash: becarioHash },
  });

  // ── Edición 2025 ─────────────────────────────────────────────────────────
  const edicion = await prisma.edicion.upsert({
    where: { anio: 2025 },
    update: {},
    create: {
      anio: 2025,
      nombre: "Pasaporte Científico 2025",
      fechaInicio: new Date("2025-02-01"),
      fechaFin: new Date("2025-06-30"),
      minAsistencias: 5,
      asistenciaGlobal: true,
      activa: true,
    },
  });

  // ── Clases ────────────────────────────────────────────────────────────────
  const clasesData = [
    { nombre: "Astronomía", investigador: "Dr. Carlos Medina", descripcion: "Exploración del universo y el sistema solar" },
    { nombre: "Robótica", investigador: "Dra. Ana Pérez", descripcion: "Construcción y programación de robots" },
    { nombre: "Química", investigador: "Dr. Luis Torres", descripcion: "Reacciones químicas y laboratorio" },
    { nombre: "Biología Marina", investigador: "Dra. María López", descripcion: "Ecosistemas del Mar Caribe" },
    { nombre: "Física Experimental", investigador: "Dr. Roberto Sosa", descripcion: "Experimentos de mecánica y electricidad" },
  ];

  const clases = await Promise.all(
    clasesData.map((c) =>
      prisma.clase.upsert({
        where: { id: `clase-${c.nombre.toLowerCase().replace(/\s+/g, "-")}` },
        update: {},
        create: { id: `clase-${c.nombre.toLowerCase().replace(/\s+/g, "-")}`, edicionId: edicion.id, ...c },
      })
    )
  );

  // ── Sesiones (3 por clase) ────────────────────────────────────────────────
  const semanasBase = [
    new Date("2025-02-08"),
    new Date("2025-02-22"),
    new Date("2025-03-08"),
  ];

  const temasAstronomia = ["Sistema Solar y planetas", "Estrellas y constelaciones", "Agujeros negros y galaxias"];
  const temasRobotica = ["Sensores y actuadores", "Programación con Scratch", "Construcción de robot seguidor"];
  const temasQuimica = ["Reacciones ácido-base", "Cromatografía", "Polímeros y plásticos"];
  const temasBiologia = ["Arrecifes de coral", "Microorganismos marinos", "Tortugas y manatíes"];
  const temasFisica = ["Movimiento y velocidad", "Electricidad estática", "Óptica y luz"];

  const temasPorClase = [temasAstronomia, temasRobotica, temasQuimica, temasBiologia, temasFisica];

  const todasLasSesiones: { id: string; claseIdx: number }[] = [];

  for (let ci = 0; ci < clases.length; ci++) {
    for (let si = 0; si < semanasBase.length; si++) {
      const sesionId = `sesion-${ci}-${si}`;
      await prisma.sesion.upsert({
        where: { id: sesionId },
        update: {},
        create: {
          id: sesionId,
          claseId: clases[ci].id,
          fecha: semanasBase[si],
          temas: temasPorClase[ci][si],
          notas: si === 0 ? "Primera sesión del ciclo, presentación del investigador." : undefined,
          registradaPorId: becario.id,
        },
      });
      todasLasSesiones.push({ id: sesionId, claseIdx: ci });
    }
  }

  // ── Participantes ─────────────────────────────────────────────────────────
  const participantesData = [
    { nombre: "Sofía", apellidos: "Ramírez Díaz", edad: 10, escuela: "Escuela Primaria Benito Juárez", grado: "4to" },
    { nombre: "Diego", apellidos: "González Herrera", edad: 11, escuela: "Escuela Primaria Benito Juárez", grado: "5to" },
    { nombre: "Valentina", apellidos: "Martínez Cruz", edad: 9, escuela: "Instituto Mérida AC", grado: "3ro" },
    { nombre: "Mateo", apellidos: "López Sánchez", edad: 11, escuela: "Instituto Mérida AC", grado: "5to" },
    { nombre: "Isabella", apellidos: "Pérez Torres", edad: 10, escuela: "Colegio Montejo", grado: "4to" },
    { nombre: "Sebastián", apellidos: "Rodríguez Vega", edad: 12, escuela: "Colegio Montejo", grado: "6to" },
    { nombre: "Camila", apellidos: "Flores Ortega", edad: 9, escuela: "Primaria Vicente Guerrero", grado: "3ro" },
    { nombre: "Lucas", apellidos: "García Reyes", edad: 11, escuela: "Primaria Vicente Guerrero", grado: "5to" },
    { nombre: "Emma", apellidos: "Hernández Ávila", edad: 10, escuela: "Escuela Primaria Benito Juárez", grado: "4to" },
    { nombre: "Nicolás", apellidos: "Jiménez Morales", edad: 12, escuela: "Instituto Mérida AC", grado: "6to" },
    { nombre: "Mía", apellidos: "Ruiz Castillo", edad: 9, escuela: "Colegio Montejo", grado: "3ro" },
    { nombre: "Emiliano", apellidos: "Vargas Mendoza", edad: 11, escuela: "Primaria Vicente Guerrero", grado: "5to" },
    { nombre: "Lucía", apellidos: "Castro Navarro", edad: 10, escuela: "Escuela Primaria Benito Juárez", grado: "4to" },
    { nombre: "Alejandro", apellidos: "Moreno Fuentes", edad: 12, escuela: "Instituto Mérida AC", grado: "6to" },
    { nombre: "Renata", apellidos: "Gutiérrez Peña", edad: 9, escuela: "Primaria Vicente Guerrero", grado: "3ro" },
  ];

  const participantes = await Promise.all(
    participantesData.map((p, i) =>
      prisma.participante.upsert({
        where: { id: `participante-${i}` },
        update: {},
        create: { id: `participante-${i}`, ...p },
      })
    )
  );

  // ── Inscripciones ─────────────────────────────────────────────────────────
  const inscripciones = await Promise.all(
    participantes.map((p, i) =>
      prisma.inscripcion.upsert({
        where: { participanteId_edicionId: { participanteId: p.id, edicionId: edicion.id } },
        update: {},
        create: { id: `inscripcion-${i}`, participanteId: p.id, edicionId: edicion.id },
      })
    )
  );

  // ── Asistencias ───────────────────────────────────────────────────────────
  // Patrón: primeros 10 participantes asisten a 5-15 sesiones (califican constancia)
  // Últimos 5 asisten a 1-3 sesiones (no califican)
  const sesionIds = todasLasSesiones.map((s) => s.id); // 15 sesiones total

  const patronAsistencia: number[][] = [
    [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14], // Sofía — todas
    [0,1,2,3,4,5,6,7,8,9,10],              // Diego — 11
    [0,1,2,3,4,5,6,7],                     // Valentina — 8
    [0,1,2,3,4,5],                         // Mateo — 6
    [0,1,2,3,4,5,6,7,8,9,10,11],          // Isabella — 12
    [0,1,2,3,4,6,7,8],                     // Sebastián — 8
    [0,1,2,3,4,5,6],                       // Camila — 7
    [0,1,2,3,4,5,6,7,8,9],                // Lucas — 10
    [0,1,2,3,4,5],                         // Emma — 6
    [0,1,2,3,4,5,6,7,8,9,10,11,12,13],   // Nicolás — 14
    [0,1],                                 // Mía — 2 (no califica)
    [0,1,2],                               // Emiliano — 3 (no califica)
    [0],                                   // Lucía — 1 (no califica)
    [0,1,2,3],                             // Alejandro — 4 (no califica)
    [0,1],                                 // Renata — 2 (no califica)
  ];

  let asistenciasCreadas = 0;
  for (let pi = 0; pi < inscripciones.length; pi++) {
    const sesionesDelParticipante = patronAsistencia[pi];
    for (const si of sesionesDelParticipante) {
      if (si >= sesionIds.length) continue;
      await prisma.asistencia.upsert({
        where: {
          inscripcionId_sesionId: {
            inscripcionId: inscripciones[pi].id,
            sesionId: sesionIds[si],
          },
        },
        update: {},
        create: {
          inscripcionId: inscripciones[pi].id,
          sesionId: sesionIds[si],
          presente: true,
        },
      });
      asistenciasCreadas++;
    }
  }

  console.log("✓ Admin:", admin.email);
  console.log("✓ Becario:", becario.email);
  console.log("✓ Edición:", edicion.nombre, "(activa)");
  console.log("✓ Clases:", clases.length);
  console.log("✓ Sesiones:", todasLasSesiones.length);
  console.log("✓ Participantes:", participantes.length);
  console.log("✓ Inscripciones:", inscripciones.length);
  console.log("✓ Asistencias:", asistenciasCreadas);
  console.log("  → Califican constancia (≥5): 10 participantes");
  console.log("  → No califican (<5): 5 participantes");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
