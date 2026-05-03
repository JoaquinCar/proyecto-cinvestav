# CLAUDE.md — Pasaporte Científico · CINVESTAV Mérida

## Visión del Proyecto
Plataforma web centralizada para gestión integral del programa Pasaporte Científico de CINVESTAV Unidad Mérida. Permite registrar participantes, controlar asistencias, administrar clases y generar reportes y constancias en PDF. Diseñada para ser reutilizable en ediciones futuras sin requerir conocimientos técnicos avanzados.

## Stack Tecnológico

### Frontend
- **Framework:** Next.js 14 (App Router)
- **UI:** Tailwind CSS + shadcn/ui
- **Estado:** Zustand + React Query (TanStack Query v5)
- **Formularios:** React Hook Form + Zod
- **Gráficas:** Recharts
- **PDF:** @react-pdf/renderer (constancias y reportes)

### Backend
- **Runtime:** Node.js 20 LTS
- **Framework:** Next.js API Routes (no servidor separado necesario)
- **ORM:** Prisma
- **Base de datos:** PostgreSQL (Supabase Free Tier — HTTPS incluido, gratis)
- **Auth:** NextAuth.js v5 (credenciales + magic link)
- **Storage PDFs:** Supabase Storage (gratis hasta 1GB)

### Infraestructura
- **Hosting:** Vercel (Free Tier — HTTPS automático, dominio gratis `*.vercel.app`)
- **DB:** Supabase (Free Tier — PostgreSQL managed)
- **CI/CD:** GitHub Actions
- **Repositorio:** GitHub

### Seguridad
- HTTPS por defecto en Vercel (certificados Let's Encrypt automáticos)
- Variables de entorno en Vercel (nunca en código)
- Autenticación obligatoria para todas las rutas de admin
- Rate limiting en API routes (upstash/ratelimit)
- Input sanitization con Zod en todos los endpoints
- RLS (Row Level Security) en Supabase por edición

---

## Estructura del Proyecto

```
pasaporte-cientifico/
├── .claude/
│   ├── CLAUDE.md              ← Este archivo
│   ├── agents/
│   │   ├── architect.md       ← Diseño de DB y arquitectura
│   │   ├── backend.md         ← API routes, Prisma, lógica de negocio
│   │   ├── frontend.md        ← UI components, páginas, UX
│   │   ├── pdf.md             ← Generación de constancias y reportes PDF
│   │   ├── devops.md          ← GitHub Actions, Vercel, Supabase config
│   │   └── qa.md              ← Tests, validaciones, PRs
│   ├── commands/
│   │   ├── scaffold.md        ← Crear estructura inicial del proyecto
│   │   ├── new-module.md      ← Agregar un nuevo módulo al sistema
│   │   ├── deploy.md          ← Flujo completo de despliegue
│   │   └── review-pr.md       ← Revisar y aprobar PRs
│   └── context/
│       ├── modules.md         ← Especificación detallada de los 8 módulos
│       ├── db-schema.md       ← Schema de Prisma completo
│       └── security.md        ← Reglas de seguridad y auth
├── src/
│   ├── app/                   ← Next.js App Router
│   ├── components/
│   ├── lib/
│   ├── server/
│   └── types/
├── prisma/
│   └── schema.prisma
├── .github/
│   └── workflows/
├── .env.example
└── README.md
```

---

## Módulos del Sistema

| # | Módulo | Estado |
|---|--------|--------|
| 0 | Auth (NextAuth v5 credentials + magic link) | ✅ Completo — PR #1 |
| 1 | Registro de participantes | 🔄 En progreso — feature/modulos-1-2 |
| 2 | Gestión de ediciones | 🔄 En progreso — feature/modulos-1-2 |
| 3 | Clases y temas | 🔲 Pendiente |
| 4 | Control de asistencia | 🔲 Pendiente |
| 5 | Constancia automática PDF | 🔲 Pendiente |
| 6 | Dashboard y reportes | 🔲 Pendiente |
| 7 | Reporte PDF por clase | 🔲 Pendiente |
| 8 | Historial entre ediciones | 🔲 Pendiente |

---

## Reglas de Trabajo para Claude Code

### Principios Generales
1. **Siempre leer el contexto relevante** antes de implementar. Revisar `context/modules.md` y `context/db-schema.md` antes de tocar base de datos o lógica de negocio.
2. **Un PR por módulo.** Nunca mezclar cambios de múltiples módulos en un solo commit.
3. **Tests antes de PR.** Todo nuevo endpoint debe tener al menos un test de integración.
4. **Validación Zod en TODO.** Ningún endpoint acepta datos sin validar con Zod.
5. **Variables de entorno.** Nunca hardcodear secrets. Agregar al `.env.example` cuando se necesite una nueva variable.
6. **Mobile-first.** Las vistas de asistencia se usan desde teléfonos en campo. Diseñar para pantallas pequeñas primero.

### Flujo de Trabajo Git
```
main          ← producción (Vercel auto-deploy)
  └─ develop  ← integración (Vercel preview)
       └─ feature/modulo-X  ← trabajo activo
```
- Crear rama `feature/modulo-X` desde `develop`
- Commits en español, descriptivos: `feat: agregar registro de participante`
- Abrir PR hacia `develop` cuando el módulo esté completo
- El agente `qa` revisa el PR antes de mergear
- `develop` → `main` solo cuando todos los módulos del sprint estén listos

### Convenciones de Código
- TypeScript estricto (`strict: true` en tsconfig)
- Server Components por defecto; `"use client"` solo cuando sea necesario
- Prisma queries en `src/server/` — nunca en componentes
- Nombres en español para variables de dominio (ej: `participante`, `edicion`, `asistencia`)
- Nombres en inglés para infraestructura (ej: `handler`, `schema`, `router`)

### Seguridad — Checklist Obligatorio
Antes de cada PR verificar:
- [ ] Todos los endpoints tienen autenticación (`getServerSession`)
- [ ] Inputs validados con Zod
- [ ] No hay secrets en el código
- [ ] Queries de Prisma usan parámetros (no concatenación)
- [ ] Archivos PDF generados no exponen rutas internas

---

## Comandos Rápidos

```bash
# Desarrollo local
npm run dev

# Generar cliente Prisma tras cambios al schema
npx prisma generate

# Migración de base de datos
npx prisma migrate dev --name descripcion

# Tests
npm test
npm run test:e2e

# Verificar tipos
npm run type-check

# Lint
npm run lint
```

---

## Contexto de Dominio

**Pasaporte Científico** es un programa de divulgación científica para niños de primaria organizado por CINVESTAV Unidad Mérida. Se realiza una vez al año (una "edición"). Los niños ("participantes") asisten a clases impartidas por investigadores, acompañados por becarios. Al completar un mínimo de asistencias, reciben una constancia.

**Roles de usuario:**
- `ADMIN` — Coordinador general, acceso total
- `BECARIO` — Pasa lista, registra temas de sesión
- `READONLY` — Consulta de reportes y estadísticas

**Términos clave:**
- `Edicion` — Una instancia anual del programa
- `Participante` — Niño registrado (puede aparecer en varias ediciones)
- `Clase` — Materia/tema del programa (ej: "Astronomía", "Robótica")
- `Sesion` — Una clase en una fecha específica
- `Asistencia` — Registro de presencia de un participante en una sesión
- `Constancia` — PDF generado cuando el participante cumple el mínimo requerido