"use client";

interface Props {
  data: { genero: string; cantidad: number }[];
}

const COLOR: Record<string, string> = {
  FEMENINO: "var(--chart-3)",
  MASCULINO: "var(--chart-1)",
  "Sin especificar": "var(--muted-foreground)",
};

const LABEL: Record<string, string> = {
  FEMENINO: "Niñas",
  MASCULINO: "Niños",
  "Sin especificar": "Sin especificar",
};

/**
 * Reparto por género como una sola barra de proporción.
 *
 * Antes era una dona de dos rebanadas: para dos valores, el ángulo es la forma
 * más difícil de comparar que existe, y además el dashboard ya trae el conteo
 * exacto en las tarjetas de arriba. Una barra parte-sobre-todo se lee de un
 * vistazo y deja el porcentaje escrito, sin depender del color.
 */
export function GraficaGenero({ data }: Props) {
  const total = data.reduce((a, d) => a + d.cantidad, 0);

  if (data.length === 0 || total === 0) {
    return (
      <div className="h-full min-h-32 flex items-center justify-center text-sm text-muted-foreground">
        Sin datos aún
      </div>
    );
  }

  const partes = data.map((d) => ({
    ...d,
    label: LABEL[d.genero] ?? d.genero,
    color: COLOR[d.genero] ?? "var(--chart-5)",
    pct: Math.round((d.cantidad / total) * 100),
  }));

  return (
    <div className="flex flex-col justify-center h-full gap-5">
      {/* La separación entre segmentos es un hueco del color de la superficie */}
      <div className="flex gap-0.5 h-10 rounded-lg overflow-hidden" role="img"
        aria-label={partes.map((p) => `${p.label}: ${p.cantidad} (${p.pct}%)`).join(", ")}>
        {partes.map((p) => (
          <div
            key={p.genero}
            className="h-full flex items-center justify-center first:rounded-l-lg last:rounded-r-lg"
            style={{ width: `${p.pct}%`, background: p.color }}
            title={`${p.label}: ${p.cantidad} (${p.pct}%)`}
          >
            {/* Solo se escribe dentro si cabe con holgura; si no, va en la leyenda */}
            {p.pct >= 14 && (
              <span className="text-xs font-semibold text-white drop-shadow-sm">{p.pct}%</span>
            )}
          </div>
        ))}
      </div>

      <ul className="space-y-2">
        {partes.map((p) => (
          <li key={p.genero} className="flex items-center gap-2 text-sm">
            <span
              aria-hidden
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ background: p.color }}
            />
            <span className="text-muted-foreground">{p.label}</span>
            <span className="ml-auto tabular text-foreground font-medium">{p.cantidad}</span>
            <span className="tabular text-muted-foreground w-10 text-right">{p.pct}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
