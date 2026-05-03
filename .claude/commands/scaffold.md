# Comando: scaffold
## Propósito
Crear la estructura completa del proyecto desde cero. Ejecutar solo una vez al inicio.

## Cuándo Usarlo
Cuando el repositorio está vacío y se necesita el scaffolding completo con todas las dependencias y configuraciones base.

## Pasos a Ejecutar (en orden)

### 1. Crear proyecto Next.js
```bash
npx create-next-app@latest . \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --no-turbopack
```

### 2. Instalar dependencias de producción
```bash
npm install \
  @prisma/client \
  next-auth@beta \
  @auth/prisma-adapter \
  zod \
  react-hook-form \
  @hookform/resolvers \
  @tanstack/react-query \
  recharts \
  @react-pdf/renderer \
  @supabase/supabase-js \
  zustand \
  xlsx \
  date-fns \
  clsx \
  tailwind-merge
```

### 3. Instalar dependencias de desarrollo
```bash
npm install -D \
  prisma \
  vitest \
  @vitejs/plugin-react \
  @playwright/test \
  @types/react-pdf
```

### 4. Instalar shadcn/ui
```bash
npx shadcn@latest init
npx shadcn@latest add button input label card table badge dialog
npx shadcn@latest add select checkbox form toast skeleton tabs
```

### 5. Inicializar Prisma
```bash
npx prisma init
```
Luego copiar el schema del agente `architect.md` a `prisma/schema.prisma`.

### 6. Crear estructura de directorios
```bash
mkdir -p src/{server/{actions,queries},lib/{schemas,pdf,auth},types}
mkdir -p .github/workflows
mkdir -p tests/{unit,integration/api,e2e}
```

### 7. Archivos de configuración a crear
- `.env.example` (copiar del agente devops.md)
- `.env.local` (llenar con valores reales — NO commitear)
- `vercel.json` (copiar del agente devops.md)
- `vitest.config.ts`
- `playwright.config.ts`
- `.github/workflows/ci.yml`
- `.github/workflows/deploy.yml`
- `.github/workflows/security.yml`
- `prisma/schema.prisma`

### 8. Primera migración
```bash
npx prisma migrate dev --name init-esquema-inicial
```

### 9. Verificar que todo compila
```bash
npm run type-check
npm run lint
npm run build
```

### 10. Primer commit
```bash
git add .
git commit -m "feat: scaffold inicial del proyecto Pasaporte Científico"
git push -u origin main
```

## Orden de Desarrollo de Módulos

Después del scaffold, desarrollar los módulos en este orden (dependencias entre ellos):

1. **Auth** — login/logout, middleware de protección de rutas
2. **Módulo 2: Ediciones** — base de todo lo demás
3. **Módulo 1: Participantes** — registro e búsqueda
4. **Módulo 3: Clases y Sesiones** — catálogo
5. **Módulo 4: Asistencia** — depende de participantes + sesiones
6. **Módulo 5: Constancias PDF** — depende de asistencia
7. **Módulo 6: Dashboard** — depende de todos los anteriores
8. **Módulo 7: Reporte PDF por clase** — depende de sesiones + asistencia
9. **Módulo 8: Historial entre ediciones** — depende de todos