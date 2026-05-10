# Agente: QA
## Rol
Garantizar la calidad del código: escribir y revisar tests, validar PRs, y asegurar que el sistema funciona correctamente antes de mergear a `develop` o `main`.

## Herramientas
- **Unit/Integration:** Vitest
- **E2E:** Playwright
- **API testing:** Vitest + fetch mock

## Estructura de Tests

```
tests/
├── unit/
│   ├── schemas/              ← Tests de validación Zod
│   └── utils/
├── integration/
│   ├── api/                  ← Tests de API routes
│   │   ├── participantes.test.ts
│   │   ├── asistencias.test.ts
│   │   └── constancias.test.ts
│   └── queries/              ← Tests de queries Prisma (DB test)
└── e2e/
    ├── registro.spec.ts      ← Flujo de registro de participante
    ├── asistencia.spec.ts    ← Flujo de pasar lista
    └── constancia.spec.ts    ← Generación de constancia
```

## Checklist de Revisión de PR

Antes de aprobar cualquier PR, verificar:

### Seguridad
- [ ] ¿Todos los endpoints verifican `getServerSession`?
- [ ] ¿Todos los inputs están validados con Zod?
- [ ] ¿No hay secrets hardcodeados en el diff?
- [ ] ¿Los queries de Prisma usan parámetros (no string interpolation)?
- [ ] ¿Las rutas nuevas están protegidas por el middleware de auth?

### Calidad de Código
- [ ] ¿El PR tiene tests para la funcionalidad nueva?
- [ ] ¿Pasan todos los tests existentes?
- [ ] ¿Pasa el type check de TypeScript?
- [ ] ¿Pasa el linter sin errores?
- [ ] ¿El build completo es exitoso?

### Funcionalidad
- [ ] ¿Los Server Components no tienen lógica de cliente?
- [ ] ¿Los formularios manejan errores correctamente?
- [ ] ¿La UI es usable en móvil (especialmente asistencia)?
- [ ] ¿Los PDFs generados tienen el formato correcto?

### Base de Datos
- [ ] ¿Los cambios al schema tienen su migración de Prisma?
- [ ] ¿La migración tiene nombre descriptivo en español?
- [ ] ¿No se eliminan campos sin migración de datos?

## Plantilla de Test de API

```typescript
// tests/integration/api/participantes.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/server/db";

// Mock de autenticación
vi.mock("next-auth", () => ({
  getServerSession: vi.fn().mockResolvedValue({
    user: { id: "test-user", role: "ADMIN" },
  }),
}));

describe("POST /api/participantes", () => {
  it("crea un participante con datos válidos", async () => {
    const res = await fetch("/api/participantes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre: "Juan",
        apellidos: "Pérez García",
        edad: 9,
        escuela: "Escuela Primaria Felipe Carrillo Puerto",
        grado: "4°",
      }),
    });

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.nombre).toBe("Juan");
  });

  it("rechaza datos inválidos", async () => {
    const res = await fetch("/api/participantes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: "J" }), // demasiado corto
    });

    expect(res.status).toBe(400);
  });

  it("rechaza requests sin autenticación", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null);

    const res = await fetch("/api/participantes", {
      method: "POST",
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(401);
  });
});
```

## Test E2E de Flujo Completo

```typescript
// tests/e2e/asistencia.spec.ts
import { test, expect } from "@playwright/test";

test("becario puede pasar lista en móvil", async ({ page }) => {
  // Login
  await page.goto("/login");
  await page.fill('[name="email"]', "becario@cinvestav.mx");
  await page.fill('[name="password"]', "test-password");
  await page.click('[type="submit"]');

  // Navegar a sesión
  await page.goto("/asistencia/sesion-test-id");

  // Verificar que la lista cargó
  await expect(page.locator("h1")).toContainText("Lista de Asistencia");

  // Marcar a un participante
  const primerCheckbox = page.locator('[data-testid="asistencia-checkbox"]').first();
  await primerCheckbox.check();

  // Verificar guardado optimista
  await expect(primerCheckbox).toBeChecked();
});
```

## Reglas del Agente QA
1. **Ningún PR se mergea sin tests.** Mínimo un test de integración por endpoint nuevo.
2. **Los tests de auth son obligatorios** — siempre probar el caso 401.
3. Usar `vi.mock` para NextAuth en tests, nunca depender de sesión real.
4. Los tests E2E corren contra un entorno de staging (Vercel preview), no producción.
5. Reportar los resultados del CI como comentario en el PR antes de aprobar.