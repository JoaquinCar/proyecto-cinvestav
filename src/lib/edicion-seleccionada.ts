// ─────────────────────────────────────────────────────────────────────────────
// Qué edición se está mirando.
//
// El dashboard, las estadísticas y el panel de clases resuelven todos lo mismo:
// la del parámetro `?edicion=`, si no la activa, y si no la más reciente. Antes
// cada pantalla lo hacía a su manera —o directamente solo sabía leer la activa,
// que era el defecto: en 2027 no había forma de consultar 2026 sin reactivarla.
// ─────────────────────────────────────────────────────────────────────────────

export type EdicionSeleccionable = { id: string; activa: boolean };

export function resolverEdicionSeleccionada<T extends EdicionSeleccionable>(
  ediciones: T[],
  edicionParam?: string,
): T | null {
  if (ediciones.length === 0) return null;
  return (
    ediciones.find((e) => e.id === edicionParam) ??
    ediciones.find((e) => e.activa) ??
    ediciones[0]
  );
}
