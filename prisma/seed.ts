import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await hash("admin123", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@cinvestav.mx" },
    update: {},
    create: {
      email: "admin@cinvestav.mx",
      name: "Admin CINVESTAV",
      role: "ADMIN",
      passwordHash,
    },
  });

  const becario = await prisma.user.upsert({
    where: { email: "becario@cinvestav.mx" },
    update: {},
    create: {
      email: "becario@cinvestav.mx",
      name: "Becario Prueba",
      role: "BECARIO",
      passwordHash: await hash("becario123", 12),
    },
  });

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

  console.log("✓ Admin:", admin.email);
  console.log("✓ Becario:", becario.email);
  console.log("✓ Edición:", edicion.nombre, "(activa)");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
