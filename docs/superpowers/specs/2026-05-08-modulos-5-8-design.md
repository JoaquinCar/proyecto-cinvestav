# Diseño: Módulos 5–8 — Pasaporte Científico CINVESTAV

**Fecha:** 2026-05-08  
**Estrategia:** Secuencial puro (5 → 6 → 7 → 8)  
**Stack:** Next.js 16 App Router, Prisma 5, Supabase, @react-pdf/renderer, Recharts, xlsx

---

## Estado previo

Módulos completados: 0 (Auth), 1 (Participantes), 2 (Ediciones), 3 (Clases), 4 (Asistencia).  
183 tests de integración + unitarios pasando en CI.

---

## Módulo 5: Constancia Automática PDF

### Objetivo
Generar una constancia en PDF para participantes que cumplieron el mínimo de asistencias de la edición, guardarla en Supabase Storage, y hacerla descargable desde el perfil del participante.

### Arquitectura
- PDF generado en el servidor (Node.js) con `@react-pdf/renderer` renderizado a buffer.
- Buffer subido a Supabase Storage.
- URL guardada en `Inscripcion.constanciaUrl` (campo ya existe en el schema).
- Sin generación en cliente.

### Backend

**`src/lib/pdf/constancia.ts`**
- Documento React-PDF: texto estructurado limpio.
- Campos: nombre completo, escuela, grado, edición (nombre + año), total de asistencias, fecha de generación, texto institucional CINVESTAV.
- Función exportada: `generarPDFConstancia(datos: DatosConstancia): Promise<Buffer>`

**`src/server/queries/constancias.ts`**
- `verificarElegibilidad(inscripcionId: string)` → `{ elegible: boolean, asistencias: number, minimo: number }`
- `generarYGuardarConstancia(inscripcionId: string, userId: string)` → sube a Storage, actualiza DB, retorna URL

**API Routes:**
- `POST /api/pdf/constancia/[inscripcionId]` — genera + guarda. Requiere ADMIN o BECARIO. Retorna `{ url: string }`.
- `GET /api/pdf/constancia/[inscripcionId]` — retorna `{ url, elegible, asistencias, minimo }`.

**Storage path:** `constancias/{edicionId}/{inscripcionId}.pdf`

### Frontend

**`src/components/constancias/BotonConstancia.tsx`** (client component)
- Props: `inscripcionId`, `elegible`, `asistencias`, `minimo`, `constanciaUrl?`
- Estado "no elegible": badge `{asistencias}/{minimo} asistencias`, deshabilitado.
- Estado "elegible sin constancia": botón "Generar Constancia" → llama `POST`, muestra spinner.
- Estado "constancia generada": botón "Descargar Constancia" → link al URL.

**Integración:**
- `BotonConstancia` aparece en `/participantes/[id]` dentro de cada `TimelineItem` de inscripción.

### Tests
- Integración: `tests/integration/api/constancias.test.ts` — elegibilidad, generación, acceso no-ADMIN, participante sin mínimo.
- Unitario: `tests/unit/pdf/constancia.test.ts` — verifica que el buffer generado sea PDF válido.

---

## Módulo 6: Dashboard y Reportes Generales

### Objetivo
Página principal del sistema con métricas en tiempo real de la edición activa, gráficas de participación, y exportación a Excel.

### Arquitectura
- Server Components fetching directo a Prisma para datos iniciales (sin HTTP self-fetch).
- Client Components para gráficas (Recharts requiere `"use client"`).
- Endpoint de stats para refetch client-side opcional.

### Backend

**`src/server/queries/estadisticas.ts`**
- `obtenerMetricasEdicion(edicionId: string)` → estructura completa de métricas:
  ```ts
  {
    totalParticipantes: number,
    totalSesiones: number,
    promedioAsistencia: number,          // porcentaje 0-100
    porEscuela: { escuela: string, cantidad: number }[],
    porGrado: { grado: string, cantidad: number }[],
    clasesResumen: { nombre: string, asistenciaPromedio: number }[]
  }
  ```
- `exportarDatosExcel(edicionId: string)` → datos crudos para sheet: participantes, asistencias por sesión.

**API Routes:**
- `GET /api/estadisticas/edicion/[id]` — retorna `{ metricas }`. READONLY+.
- `GET /api/exportar/excel/[edicionId]` — genera xlsx con `xlsx`, responde como descarga. ADMIN+.

### Frontend

**`src/app/(dashboard)/page.tsx`** (Server Component)
- Redirige a login si no hay sesión.
- Fetcha edición activa + métricas.
- Muestra 4 stat cards (participantes, sesiones, asistencia promedio, constancias generadas).
- Incluye `GraficaEscuelas` y `GraficaGrados`.

**`src/components/dashboard/GraficaEscuelas.tsx`** (client)
- `BarChart` horizontal de Recharts. Top 10 escuelas.

**`src/components/dashboard/GraficaGrados.tsx`** (client)
- `PieChart` / donut de Recharts por grado escolar.

**Botón "Exportar Excel"** — fetch + download blob.

### Tests
- Integración: `tests/integration/api/estadisticas.test.ts` — métricas correctas, autorización, exportación xlsx.

---

## Módulo 7: Reporte PDF por Clase

### Objetivo
PDF descargable por clase: lista de participantes con asistencia por sesión, temas vistos, resumen estadístico.

### Arquitectura
- Reutiliza `src/lib/pdf/` del Módulo 5.
- PDF generado on-demand (no guardado en Storage), servido directamente como response stream.
- `Content-Type: application/pdf`, `Content-Disposition: attachment`.

### Backend

**`src/lib/pdf/reporte-clase.ts`**
- Documento React-PDF con:
  - Encabezado: nombre clase, investigador, edición.
  - Tabla participantes × sesiones (asistencia: ✓/✗).
  - Sección temas por sesión (texto).
  - Resumen: total participantes, sesiones, promedio asistencia.
- Función: `generarPDFReporteClase(datos: DatosReporteClase): Promise<Buffer>`

**`src/server/queries/reportes.ts`**
- `obtenerDatosReporteClase(claseId: string)` — todos los datos necesarios en una query (clase + sesiones + inscripciones + asistencias).

**API Route:**
- `GET /api/pdf/reporte-clase/[claseId]` — genera y responde PDF. ADMIN+.

### Frontend
- Botón "Descargar Reporte PDF" en `/clases/[id]` (la vista de detalle de clase, ya existente).
- Link directo al endpoint — el browser descarga.

### Tests
- Integración: `tests/integration/api/reportes.test.ts` — generación exitosa, formato PDF, autorización.

---

## Módulo 8: Historial entre Ediciones

### Objetivo
Dashboard histórico comparativo: crecimiento año a año, escuelas recurrentes, participantes que han participado en múltiples ediciones.

### Arquitectura
- Pure query + display. Sin nueva infraestructura de storage o PDF.
- Server Component principal, Client Components para gráficas de línea.

### Backend

**`src/server/queries/historico.ts`**
- `obtenerHistoricoEdiciones()` → `{ anio, totalParticipantes, totalSesiones, promedioAsistencia }[]`
- `obtenerEscuelasRecurrentes(limit?: number)` → `{ escuela, ediciones, totalParticipantes }[]`
- `obtenerParticipantesRecurrentes(limit?: number)` → `{ nombre, apellidos, ediciones, escuela }[]`

**API Routes:**
- `GET /api/estadisticas/historico` — retorna `{ ediciones, escuelas, participantes }`. READONLY+.

### Frontend

**`src/app/(dashboard)/estadisticas/page.tsx`** (Server Component)
- Sección "Crecimiento histórico": `LineChart` (Recharts) — eje X años, eje Y participantes.
- Tabla "Escuelas más constantes" — ranking ordenado por ediciones.
- Tabla "Participantes recurrentes" — nombre, ediciones participadas, escuela.

### Tests
- Integración: `tests/integration/api/historico.test.ts` — queries correctas, multi-edición.

---

## Dependencias entre Módulos

```
Módulo 5 → crea src/lib/pdf/ (base para Módulo 7)
Módulo 6 → crea src/server/queries/estadisticas.ts (base para Módulo 8)
Módulo 7 → reutiliza src/lib/pdf/ del Módulo 5
Módulo 8 → extiende patrones de queries del Módulo 6
```

## Archivos Nuevos Estimados

| Módulo | Archivos backend | Archivos frontend | Tests |
|--------|-----------------|-------------------|-------|
| 5 | 4 | 2 | 2 |
| 6 | 3 | 4 | 1 |
| 7 | 3 | 1 | 1 |
| 8 | 2 | 2 | 1 |

## Checklist de Seguridad (por módulo)

- [ ] Todos los endpoints tienen autenticación (`auth()`)
- [ ] Inputs validados con Zod
- [ ] No hay secrets en código
- [ ] URLs de Storage no exponen rutas internas (signed URLs si es necesario)
- [ ] PDFs no incluyen datos de otros participantes
