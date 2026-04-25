# Pasaporte Científico — CINVESTAV Unidad Mérida

Sistema web de gestión integral para el programa Pasaporte Científico. Permite registrar participantes, controlar asistencias, administrar clases y generar constancias y reportes en PDF.

## Stack

- **Frontend/Backend:** Next.js 14 (App Router) + TypeScript
- **UI:** Tailwind CSS + shadcn/ui
- **Base de datos:** PostgreSQL via Supabase (Free Tier)
- **Auth:** NextAuth.js v5
- **Hosting:** Vercel (HTTPS automático, Free Tier)
- **CI/CD:** GitHub Actions

## Inicio Rápido

```bash


# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con tus valores

# Aplicar migraciones
npx prisma migrate dev

# Iniciar servidor de desarrollo
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000).

## Módulos

| # | Módulo | Descripción |
|---|--------|-------------|
| 1 | Participantes | Registro con detección de recurrentes |
| 2 | Ediciones | Una por año, consultables históricamente |
| 3 | Clases y Temas | Catálogo con investigador asignado |
| 4 | Asistencia | Lista mobile-first desde cualquier dispositivo |
| 5 | Constancias PDF | Generación automática al cumplir requisitos |
| 6 | Dashboard | Gráficas y exportación Excel/PDF |
| 7 | Reporte por Clase | PDF con lista, temas y estadísticas |
| 8 | Historial | Comparativas entre ediciones |

## Documentación

La arquitectura y guías de desarrollo están en `.claude/`:

- `CLAUDE.md` — Guía principal para Claude Code
- `agents/` — Roles especializados (architect, backend, frontend, pdf, devops, qa)
- `commands/` — Protocolos de scaffold, módulos, deploy y PR review
- `context/` — Especificaciones de módulos, schema y seguridad

## Comandos

```bash
npm run dev          # Desarrollo local
npm run build        # Build de producción
npm run type-check   # Verificar tipos TypeScript
npm run lint         # Linter
npm test             # Tests unitarios e integración
npm run test:e2e     # Tests end-to-end con Playwright
npx prisma studio    # Explorador visual de la base de datos
```

## Despliegue

El despliegue es automático via GitHub Actions:
- Push a `develop` → preview en Vercel
- Merge a `main` → producción en Vercel (con migraciones automáticas)

## Licencia

Proyecto de servicio social — CINVESTAV Unidad Mérida.