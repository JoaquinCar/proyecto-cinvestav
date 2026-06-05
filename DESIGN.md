# Pasaporte Científico CINVESTAV — Design System

Sistema generado con `ui-ux-pro-max` y pulido con `impeccable`. Formato
[awesome-claude-design](https://github.com/rohitg00/awesome-claude-design).
Las skills de diseño deben enrutar a través de este archivo.

## 1. Visual Theme & Atmosphere

Divulgación científica para niños, respaldada por una institución seria (CINVESTAV).
Equilibrio: **fondo neutro limpio + acentos vivos y amigables**. Tipografía redondeada,
esquinas suaves, KPI cards claros. Serio en estructura, juguetón en color y forma.

Mood: claro, accesible, confiable, con chispa.

## 2. Color Palette & Roles

**Fondo fijo neutro** (sin tinte). Acentos sí varían. Soporta dark/light mode.

```
/* ---------- LIGHT ---------- */
--background:    oklch(1 0 0)            /* blanco puro */
--surface:       oklch(0.985 0 0)        /* cards apenas elevadas */
--surface-alt:   oklch(0.96 0 0)         /* inputs, zonas secundarias */
--foreground:    oklch(0.20 0.02 260)    /* texto principal */
--muted-fg:      oklch(0.50 0.02 260)    /* texto secundario */
--border:        oklch(0.90 0.005 260)

/* ---------- DARK ---------- */
--background:    oklch(0.16 0 0)         /* negro/casi negro neutro */
--surface:       oklch(0.20 0 0)
--surface-alt:   oklch(0.25 0 0)
--foreground:    oklch(0.97 0 0)
--muted-fg:      oklch(0.70 0.01 260)
--border:        oklch(0.30 0.005 260)

/* ---------- ACENTOS (iguales en ambos modos, ajustar L en dark) ---------- */
--primary:       oklch(0.55 0.22 264)    /* azul aprendizaje #2563EB */
--on-primary:    oklch(1 0 0)
--secondary:     oklch(0.80 0.16 80)     /* amarillo juego #F59E0B */
--on-secondary:  oklch(0.20 0.02 260)
--accent:        oklch(0.68 0.21 0)      /* rosa diversión #EC4899 */
--on-accent:     oklch(1 0 0)

/* ---------- ESTADO (semántico) ---------- */
--success:       oklch(0.65 0.17 150)
--warning:       oklch(0.80 0.16 80)
--danger:        oklch(0.58 0.22 27)
--ring:          oklch(0.55 0.22 264)    /* = primary */
```

Reglas:
- Fondo SIEMPRE neutro (blanco/negro). Nunca tintar el fondo con azul/rosa.
- **Azul** = acción primaria, navegación activa, enlaces, focus ring.
- **Amarillo** = highlights, badges de logro/constancia, énfasis cálido.
- **Rosa** = acento puntual (CTA secundaria destacada, decoraciones de divulgación).
- Estado (success/danger) solo con significado, con icono además del color.
- Dark mode: subir L de acentos ~+0.05 para mantener contraste 4.5:1.

## 3. Typography Rules

```
@import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Nunito:wght@300;400;500;600;700&display=swap');
fontFamily: { heading: ['Fredoka', ...], body: ['Nunito', ...] }
```

- **Títulos:** `Fredoka` 500/600/700 — redondeada, amigable, legible.
- **Body / UI:** `Nunito` 400/500/600.
- **Cifras dashboard:** Nunito 700 con `font-variant-numeric: tabular-nums`.
- Escala: 12 / 14 / 16 / 18 / 20 / 24 / 30 / 36 / 48.
- Body mínimo 16px (evita auto-zoom iOS). Line-height 1.5–1.6.

## 4. Component Stylings

**Botones** (radius `xl`, h-11, weight 600, transición 150–200ms)
- Primario: fill `--primary`, texto `--on-primary`.
- Secundario: `--surface-alt` fill, `--foreground`, `--border` outline.
- Acento: fill `--accent` para CTA destacada puntual.
- Peligro: fill `--danger`. Disabled: opacity 0.5 + cursor-not-allowed.

**Cards**: `--surface`, `--border` 1px, radius `2xl`, padding generoso. Sombra suave
solo `0 1px 3px rgb(0 0 0 / 0.06)` en light; en dark sin sombra, depender de borde.

**Inputs**: `--surface-alt`, `--border` 1px (→ `--danger` si error), radius `lg`, h-11.
Label visible arriba. Error inline 13px `--danger` debajo. Focus: ring 2px `--primary`.

**Badges/pills**: redondeados full, fondo color a `/0.12`, texto color pleno.
Constancia/logro → amarillo. Activa → success con punto pulsante.

**KPI card**: icono en chip de color a `/0.12`, label uppercase 12px muted, número
grande Fredoka tabular.

## 5. Layout Principles

- Sidebar 240px en `lg+`; en móvil bottom-nav ≤5 items (asistencia se usa en teléfono).
- Contenido `max-w-7xl`, `p-4 sm:p-6 lg:p-8`, `space-y-6`.
- **Mobile-first**: grids `grid-cols-1 sm:grid-cols-2 xl:grid-cols-4`. Tablas →
  tarjetas key-value < `sm`. Touch targets ≥44px.
- Spacing 4/8: escala 4/8/12/16/24/32/48.

## 6. Depth & Elevation

Plano con borde. Sombra mínima solo en light para cards/popovers. Dark = borde define
jerarquía. Escala única de elevación (card < dropdown < modal). Scrim modal 40–60%.

## 7. Do's and Don'ts

**Do**
- Fondo neutro siempre; color en acentos y componentes.
- Fredoka títulos, Nunito body. Iconos Lucide, stroke 1.8–2.
- Soportar dark/light con tokens semánticos.
- Tabular-nums en columnas de datos y métricas.

**Don't**
- Tintar el fondo. Usar más de un acento por jerarquía.
- Emojis como iconos. Sombras pesadas. Texto < 16px en body móvil.
- Color como único indicador de estado.

## 8. Responsive Behavior

- < 768px: sidebar → bottom-nav; tablas → cards apiladas; KPIs 1 col.
- Gráficas Recharts: reflow, menos ticks, barras horizontales en móvil.
- Respetar `prefers-reduced-motion` y safe-areas.

## 9. Agent Prompt Guide

Bias: fondo neutro blanco/negro (oklch L=1 / L=0.16, croma 0), acentos azul-amarillo-rosa,
Fredoka headings + Nunito body, radius 2xl en cards / xl en botones, dark+light por tokens,
mobile-first con bottom-nav, tabular-nums, Lucide icons, animaciones 150–300ms.

Reject: fondos tintados, segundo acento por jerarquía, emojis-icono, sombras pesadas,
serif, color-only state, body < 16px móvil.
