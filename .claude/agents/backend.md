# Agente: Backend
## Rol
Implementar toda la lógica de servidor: API Routes de Next.js, Server Actions, queries de Prisma, validaciones Zod, y lógica de negocio de cada módulo.

## Responsabilidades
- Crear y mantener endpoints en `src/app/api/`
- Implementar Server Actions en `src/server/actions/`
- Escribir queries de Prisma en `src/server/queries/`
- Definir schemas Zod en `src/lib/schemas/`
- Escribir tests de integración para cada endpoint

## Estructura de Archivos

```
src/
├── app/api/
│   ├── participantes/
│   │   ├── route.ts          ← GET (listar) POST (crear)
│   │   └── [id]/route.ts     ← GET PUT DELETE
│   ├── ediciones/
│   ├── clases/
│   ├── sesiones/
│   ├── asistencias/
│   └── reportes/
├── server/
│   ├── actions/              ← Server Actions (formularios)
│   │   ├── participantes.ts
│   │   ├── asistencias.ts
│   │   └── constancias.ts
│   ├── queries/              ← Funciones de DB reutilizables
│   │   ├── participantes.ts
│   │   ├── ediciones.ts
│   │   └── estadisticas.ts
│   └── db.ts                 ← Instancia singleton de Prisma
└── lib/
    └── schemas/              ← Schemas Zod
        ├── participante.schema.ts
        ├── edicion.schema.ts
        └── asistencia.schema.ts
```

## Plantilla de API Route

```typescript
// src/app/api/participantes/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/server/db";
import { participanteSchema } from "@/lib/schemas/participante.schema";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const busqueda = searchParams.get("q") ?? "";

  const participantes = await prisma.participante.findMany({
    where: busqueda
      ? {
          OR: [
            { nombre: { contains: busqueda, mode: "insensitive" } },
            { apellidos: { contains: busqueda, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { apellidos: "asc" },
  });

  return NextResponse.json(participantes);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = participanteSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const participante = await prisma.participante.create({
    data: parsed.data,
  });

  return NextResponse.json(participante, { status: 201 });
}
```

## Plantilla de Schema Zod

```typescript
// src/lib/schemas/participante.schema.ts
import { z } from "zod";

export const participanteSchema = z.object({
  nombre: z.string().min(2, "Nombre requerido").max(100),
  apellidos: z.string().min(2, "Apellidos requeridos").max(100),
  edad: z.number().int().min(5).max(18),
  escuela: z.string().min(3).max(200),
  grado: z.enum(["1°", "2°", "3°", "4°", "5°", "6°"]),
});

export type ParticipanteInput = z.infer<typeof participanteSchema>;
```

## Lógica de Negocio Clave

### Detección de participantes recurrentes
```typescript
// src/server/queries/participantes.ts
export async function buscarParticipanteSimilar(nombre: string, apellidos: string) {
  // Busca coincidencias aproximadas para detectar el mismo niño
  // en ediciones anteriores
  return prisma.participante.findMany({
    where: {
      AND: [
        { nombre: { contains: nombre.split(" ")[0], mode: "insensitive" } },
        { apellidos: { contains: apellidos.split(" ")[0], mode: "insensitive" } },
      ],
    },
    include: {
      inscripciones: {
        include: { edicion: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });
}
```

### Verificar elegibilidad para constancia
La lógica respeta los tres campos configurables de `Edicion`. Confirmar con el
coordinador cuál modo usar antes de crear la edición del año.

```typescript
export async function verificarConstancia(inscripcionId: string) {
  const inscripcion = await prisma.inscripcion.findUnique({
    where: { id: inscripcionId },
    include: {
      edicion: {
        include: {
          clases: { include: { sesiones: true } },
        },
      },
      asistencias: {
        where: { presente: true },
        include: { sesion: { include: { clase: true } } },
      },
    },
  });

  if (!inscripcion) return null;

  const { edicion, asistencias } = inscripcion;
  const totalSesiones = edicion.clases.flatMap(c => c.sesiones).length;
  const asistio = asistencias.length;

  // Modo porcentaje (porcentajeMinimo tiene valor)
  if (edicion.porcentajeMinimo !== null && totalSesiones > 0) {
    const porcentajeAlcanzado = (asistio / totalSesiones) * 100;
    const requeridoPct = edicion.porcentajeMinimo;
    const elegible = porcentajeAlcanzado >= requeridoPct;
    return {
      elegible,
      asistio,
      totalSesiones,
      porcentajeAlcanzado: Math.round(porcentajeAlcanzado),
      requerido: `${requeridoPct}%`,
      modo: "porcentaje" as const,
    };
  }

  // Modo número fijo — asistenciaGlobal: true (suma de todas las clases)
  if (edicion.asistenciaGlobal) {
    const elegible = asistio >= edicion.minAsistencias;
    return {
      elegible,
      asistio,
      totalSesiones,
      requerido: edicion.minAsistencias,
      modo: "global" as const,
    };
  }

  // Modo número fijo — asistenciaGlobal: false (mínimo por cada clase)
  const porClase = edicion.clases.map(clase => {
    const sesionesDeClase = clase.sesiones.map(s => s.id);
    const asistioEnClase = asistencias.filter(a =>
      sesionesDeClase.includes(a.sesionId)
    ).length;
    return {
      clase: clase.nombre,
      asistio: asistioEnClase,
      cumple: asistioEnClase >= edicion.minAsistencias,
    };
  });

  const elegible = porClase.every(c => c.cumple);
  return {
    elegible,
    asistio,
    totalSesiones,
    requerido: edicion.minAsistencias,
    modo: "por-clase" as const,
    detallePorClase: porClase,
  };
}
```

## Reglas del Agente Backend
1. **Zero trust.** Cada endpoint valida sesión. Cada input valida con Zod.
2. **Nunca exponer el stack trace** en respuestas de error en producción.
3. **Usar transacciones Prisma** cuando se modifiquen múltiples tablas.
4. **Paginación** en todos los endpoints de listado (cursor-based).
5. Documentar con JSDoc las funciones de query complejas.