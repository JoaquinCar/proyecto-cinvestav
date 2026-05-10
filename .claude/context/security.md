# context/security.md — Seguridad del Sistema

## Principios de Seguridad

### 1. HTTPS por Defecto
- Vercel provee HTTPS automático con certificados Let's Encrypt para todos los proyectos
- El dominio `pasaporte-cientifico.vercel.app` siempre usa HTTPS
- Si se configura dominio personalizado, Vercel gestiona el certificado automáticamente
- No hay configuración adicional requerida para HTTPS

### 2. Autenticación (NextAuth.js v5)
- Todas las rutas bajo `/(dashboard)` requieren sesión válida
- Middleware en `src/middleware.ts` protege las rutas
- Sesiones con JWT firmado con `NEXTAUTH_SECRET`
- Expiración de sesión: 8 horas (tiempo de un día de trabajo)

```typescript
// src/middleware.ts
import { auth } from "@/lib/auth";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isApiAuth = req.nextUrl.pathname.startsWith("/api/auth");
  const isLoginPage = req.nextUrl.pathname === "/login";

  if (!isLoggedIn && !isApiAuth && !isLoginPage) {
    return Response.redirect(new URL("/login", req.url));
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

### 3. Autorización por Roles

| Acción | ADMIN | BECARIO | READONLY |
|--------|-------|---------|----------|
| Crear/editar ediciones | ✅ | ❌ | ❌ |
| Registrar participantes | ✅ | ✅ | ❌ |
| Pasar lista | ✅ | ✅ | ❌ |
| Registrar temas de sesión | ✅ | ✅ | ❌ |
| Ver reportes | ✅ | ✅ | ✅ |
| Descargar PDFs | ✅ | ✅ | ✅ |
| Gestionar usuarios | ✅ | ❌ | ❌ |

```typescript
// Helper de autorización
export function requireRole(session: Session, minRole: Role) {
  const hierarchy: Record<Role, number> = {
    READONLY: 0,
    BECARIO: 1,
    ADMIN: 2,
  };
  if (hierarchy[session.user.role] < hierarchy[minRole]) {
    throw new Error("Acceso denegado");
  }
}
```

### 4. Validación de Inputs (Zod)
- Todo input de usuario pasa por un schema Zod antes de tocar la DB
- Los schemas están en `src/lib/schemas/`
- Los errores de validación se devuelven con status 400 y detalles

### 5. Variables de Entorno
- **Nunca en código:** API keys, connection strings, secrets
- **Siempre en:** Variables de entorno de Vercel (producción) o `.env.local` (desarrollo)
- `.env.local` en `.gitignore` — nunca se commitea
- `.env.example` sí se commitea — sin valores reales

### 6. Headers de Seguridad (vercel.json)
- `X-Content-Type-Options: nosniff` — previene MIME sniffing
- `X-Frame-Options: DENY` — previene clickjacking
- `X-XSS-Protection: 1; mode=block` — protección XSS legacy
- `Content-Security-Policy` — restringe fuentes de scripts/estilos

### 7. Rate Limiting
Para endpoints críticos (login, generación de PDFs):
```typescript
import { Ratelimit } from "@upstash/ratelimit";
// O implementación simple con memoria para el free tier:
const requestCounts = new Map<string, { count: number; resetAt: number }>();
```

### 8. Supabase Storage (PDFs)
- Los PDFs de constancias son públicos (URL pública) — correcto, son documentos para imprimir
- Las URLs tienen el formato: `https://[ref].supabase.co/storage/v1/object/public/documentos/constancias/[año]/[id].pdf`
- Solo el backend (service_role) puede subir/eliminar archivos

## Checklist de Seguridad Pre-Deploy

```markdown
- [ ] NEXTAUTH_SECRET generado con `openssl rand -base64 32`
- [ ] DATABASE_URL no expuesta en ningún archivo commitado
- [ ] Middleware de auth activo y probado
- [ ] Headers de seguridad configurados en vercel.json
- [ ] RLS habilitado en Supabase
- [ ] npm audit sin vulnerabilidades high/critical
- [ ] No hay console.log con datos sensibles en producción
```