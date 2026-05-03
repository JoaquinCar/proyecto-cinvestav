# Agente: Architect
## Rol
Diseñar y mantener el schema de base de datos, las relaciones entre entidades, y las decisiones arquitectónicas del sistema. Es el agente de mayor autoridad sobre la estructura del proyecto.

## Responsabilidades
- Diseñar y evolucionar el schema de Prisma
- Decidir patrones de arquitectura (Server Actions vs API Routes, etc.)
- Revisar cualquier PR que toque `prisma/schema.prisma`
- Documentar decisiones en `context/db-schema.md`
- Generar migraciones con nombres descriptivos

## Schema Prisma Canónico

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ──────────────────────────────────────────
// AUTH
// ──────────────────────────────────────────

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String?
  role          Role      @default(BECARIO)
  passwordHash  String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  sesionesRegistradas Sesion[]
}

enum Role {
  ADMIN
  BECARIO
  READONLY
}

// ──────────────────────────────────────────
// DOMINIO PRINCIPAL
// ──────────────────────────────────────────

model Edicion {
  id          String   @id @default(cuid())
  anio        Int      @unique
  nombre      String   // ej: "Pasaporte Científico 2025"
  fechaInicio DateTime
  fechaFin    DateTime

  // ── Criterio para constancia (confirmar con coordinador antes de cada edición) ──
  // Solo uno de los dos modos debe estar activo a la vez.
  // Modo 1 — número fijo: el participante necesita X sesiones en total
  minAsistencias     Int     @default(5)
  // Modo 2 — porcentaje: el participante necesita asistir al N% de todas las sesiones
  // Si es null, se usa minAsistencias. Si tiene valor (0-100), se ignora minAsistencias.
  porcentajeMinimo   Float?
  // ¿Se cuentan todas las clases juntas o hay mínimo por clase específica?
  // true  → suma global de asistencias (más flexible, recomendado para este programa)
  // false → debe cumplir el mínimo en CADA clase individualmente
  asistenciaGlobal   Boolean @default(true)

  activa      Boolean  @default(false)
  createdAt   DateTime @default(now())

  clases       Clase[]
  inscripciones Inscripcion[]
}

model Participante {
  id           String   @id @default(cuid())
  nombre       String
  apellidos    String
  edad         Int
  escuela      String
  grado        String   // "1°", "2°", ... "6°"
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  inscripciones Inscripcion[]

  @@index([nombre, apellidos])
}

model Inscripcion {
  id             String       @id @default(cuid())
  participanteId String
  edicionId      String
  constanciaUrl  String?      // URL en Supabase Storage
  constanciaGenerada Boolean  @default(false)
  createdAt      DateTime     @default(now())

  participante  Participante  @relation(fields: [participanteId], references: [id])
  edicion       Edicion       @relation(fields: [edicionId], references: [id])
  asistencias   Asistencia[]

  @@unique([participanteId, edicionId])
}

model Clase {
  id           String   @id @default(cuid())
  edicionId    String
  nombre       String   // "Astronomía", "Robótica"
  investigador String
  descripcion  String?
  createdAt    DateTime @default(now())

  edicion   Edicion   @relation(fields: [edicionId], references: [id])
  sesiones  Sesion[]
}

model Sesion {
  id        String   @id @default(cuid())
  claseId   String
  fecha     DateTime
  temas     String?  // texto libre con los temas vistos
  notas     String?
  registradaPorId String?
  createdAt DateTime @default(now())

  clase         Clase       @relation(fields: [claseId], references: [id])
  registradaPor User?       @relation(fields: [registradaPorId], references: [id])
  asistencias   Asistencia[]
}

model Asistencia {
  id            String   @id @default(cuid())
  inscripcionId String
  sesionId      String
  presente      Boolean  @default(true)
  createdAt     DateTime @default(now())

  inscripcion Inscripcion @relation(fields: [inscripcionId], references: [id])
  sesion      Sesion      @relation(fields: [sesionId], references: [id])

  @@unique([inscripcionId, sesionId])
}
```

## Reglas del Arquitecto
1. **Nunca eliminar campos de producción** sin una migración explícita que preserve datos históricos.
2. **Soft deletes** para Participantes y Ediciones (agregar `deletedAt DateTime?` si se necesita).
3. **Índices** en todos los campos usados en WHERE frecuentes.
4. **`@@unique`** en combinaciones que deben ser únicas (ej: un participante solo se inscribe una vez por edición).
5. Toda migración debe tener un `--name` descriptivo en español.

## Cuándo Interviene este Agente
- Antes de crear cualquier modelo nuevo
- Cuando un módulo nuevo requiere relaciones que no existen
- Para revisar PRs que modifiquen el schema
- Para decidir si una consulta compleja necesita una vista o un procedimiento almacenado