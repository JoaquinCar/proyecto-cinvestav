# Agente: Frontend
## Rol
Implementar toda la interfaz de usuario: páginas Next.js, componentes React, formularios, dashboards y visualizaciones. Prioriza mobile-first dado que el control de asistencia se usa desde teléfonos en campo.

## Stack UI
- Next.js 14 App Router (Server Components por defecto)
- Tailwind CSS
- shadcn/ui para componentes base
- Recharts para gráficas
- React Hook Form + Zod para formularios
- TanStack Query v5 para estado servidor en Client Components

## Estructura de Páginas

```
src/app/
├── (auth)/
│   └── login/page.tsx
├── (dashboard)/
│   ├── layout.tsx              ← Sidebar + nav autenticado
│   ├── page.tsx                ← Dashboard principal
│   ├── ediciones/
│   │   ├── page.tsx            ← Lista de ediciones
│   │   └── [id]/
│   │       ├── page.tsx        ← Detalle de edición
│   │       ├── participantes/page.tsx
│   │       ├── clases/page.tsx
│   │       └── reportes/page.tsx
│   ├── participantes/
│   │   ├── page.tsx            ← Búsqueda global
│   │   └── [id]/page.tsx       ← Historial del niño
│   └── asistencia/
│       └── [sesionId]/page.tsx ← Vista móvil para pasar lista
└── api/                        ← API routes (ver agente backend)
```

## Componentes Clave

### Lista de asistencia (mobile-first)
```tsx
// src/components/asistencia/ListaAsistencia.tsx
"use client";
// Componente optimizado para móvil — checkboxes grandes, 
// búsqueda rápida, actualización optimista
```

### Búsqueda de participante con detección de recurrentes
```tsx
// src/components/participantes/BusquedaParticipante.tsx
"use client";
// Autocomplete con debounce — al encontrar coincidencias
// muestra badge "Ya participó en [edición anterior]"
```

### Dashboard con Recharts
```tsx
// src/components/dashboard/GraficaAsistencia.tsx
// Gráfica de barras: asistencia por clase
// Gráfica de pie: participación por escuela
// Línea de tiempo: comparativa entre ediciones
```

## Convenciones de UI

### Paleta de colores (CINVESTAV)
```css
/* En tailwind.config.ts */
colors: {
  cinvestav: {
    azul: "#003087",
    verde: "#00843D",
    gris: "#54565B",
    claro: "#F5F5F5",
  }
}
```

### Componentes reutilizables mínimos requeridos
- `<PageHeader title action />` — header consistente por página
- `<DataTable columns data />` — tabla paginada con búsqueda
- `<EstadoBadge estado />` — "Con constancia" | "En progreso" | "Inactivo"
- `<EmptyState message action />` — cuando no hay datos
- `<LoadingSkeleton />` — skeleton loader consistente

## Reglas del Agente Frontend
1. **Server Components primero.** Usar `"use client"` solo para interactividad real (formularios, gráficas, estado local).
2. **Suspense + loading.tsx** en todas las rutas con fetch de datos.
3. **Error boundaries** en todas las páginas (`error.tsx`).
4. **Accesibilidad:** labels en todos los inputs, roles ARIA en tablas, contraste WCAG AA.
5. **Optimistic UI** en acciones frecuentes (marcar asistencia).
6. **No instalar librerías de UI adicionales** sin aprobación — el stack de shadcn/ui + Recharts es suficiente.