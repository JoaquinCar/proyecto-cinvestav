# Agente: DevOps
## Rol
Configurar y mantener toda la infraestructura del proyecto: pipelines de CI/CD con GitHub Actions, despliegue en Vercel, configuración de Supabase, y seguridad del entorno.

## Stack de Infraestructura (100% Free Tier)

| Servicio | Uso | HTTPS | Costo |
|----------|-----|-------|-------|
| **Vercel** | Hosting Next.js | ✅ Auto (Let's Encrypt) | Gratis |
| **Supabase** | PostgreSQL + Storage | ✅ Auto | Gratis (500MB DB, 1GB Storage) |
| **GitHub** | Repositorio + Actions | ✅ | Gratis |
| **GitHub Actions** | CI/CD | — | Gratis (2000 min/mes) |

## Variables de Entorno Requeridas

```bash
# .env.example — commit esto, NUNCA el .env real

# Base de datos (Supabase)
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres"

# Supabase Storage
NEXT_PUBLIC_SUPABASE_URL="https://[REF].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="[ANON_KEY]"
SUPABASE_SERVICE_ROLE_KEY="[SERVICE_ROLE_KEY]"

# NextAuth
NEXTAUTH_URL="https://pasaporte-cientifico.vercel.app"
NEXTAUTH_SECRET="[generar con: openssl rand -base64 32]"

# App
NEXT_PUBLIC_APP_NAME="Pasaporte Científico CINVESTAV"
```

## GitHub Actions Workflows

### CI — Verificación en cada PR
```yaml
# .github/workflows/ci.yml
name: CI

on:
  pull_request:
    branches: [develop, main]

jobs:
  verify:
    name: Type Check, Lint & Test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Type check
        run: npm run type-check

      - name: Lint
        run: npm run lint

      - name: Run tests
        run: npm test
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL_TEST }}

      - name: Build
        run: npm run build
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL_TEST }}
          NEXTAUTH_SECRET: ${{ secrets.NEXTAUTH_SECRET }}
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
```

### Deploy — Automático en merge a main
```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    name: Deploy
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Run migrations
        run: npx prisma migrate deploy
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}

      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: "--prod"
```

### Security Scan — Semanal
```yaml
# .github/workflows/security.yml
name: Security Scan

on:
  schedule:
    - cron: "0 9 * * 1"  # Lunes 9am
  workflow_dispatch:

jobs:
  audit:
    name: npm audit
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm audit --audit-level=high
```

## Configuración de Vercel

### vercel.json
```json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "installCommand": "npm ci",
  "regions": ["iad1"],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-XSS-Protection", "value": "1; mode=block" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self';"
        }
      ]
    }
  ]
}
```

## Configuración de Supabase (RLS)

### Políticas de Row Level Security
```sql
-- Ejecutar en Supabase SQL Editor después de las migraciones

-- Habilitar RLS en tablas sensibles
ALTER TABLE "Participante" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Inscripcion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Asistencia" ENABLE ROW LEVEL SECURITY;

-- Solo el service_role (backend) puede acceder
-- El frontend nunca accede directamente a Supabase DB
-- (todo pasa por las API routes de Next.js)
CREATE POLICY "service_role_only" ON "Participante"
  USING (auth.role() = 'service_role');
```

## Setup Inicial (Checklist)

```markdown
- [ ] Crear proyecto en Supabase (Free Tier)
- [ ] Copiar DATABASE_URL de Supabase → GitHub Secrets
- [ ] Copiar SUPABASE_URL y ANON_KEY → GitHub Secrets
- [ ] Crear proyecto en Vercel, conectar con GitHub repo
- [ ] Configurar variables de entorno en Vercel dashboard
- [ ] Copiar VERCEL_TOKEN, ORG_ID, PROJECT_ID → GitHub Secrets
- [ ] Ejecutar `npx prisma migrate deploy` primera vez
- [ ] Verificar que https://pasaporte-cientifico.vercel.app responde
```

## Reglas del Agente DevOps
1. **Nunca commitear secrets.** El `.env` está en `.gitignore`.
2. **Branch protection** en `main`: require PR + CI pass antes de merge.
3. Las migraciones de Prisma corren automáticamente en el deploy workflow.
4. Monitorear el free tier de Supabase (500MB DB) — alertar si se acerca al límite.
5. El dominio `*.vercel.app` tiene HTTPS automático; no se requiere configuración adicional.