"use client";

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from "recharts";

interface Props {
  data: { escuela: string; cantidad: number; pct: number; acumPct: number }[];
  /** Corta la cola larga para que las etiquetas se lean. */
  max?: number;
}

/** Recorta nombres de escuela largos para el eje. */
function corto(nombre: string, n = 22): string {
  return nombre.length > n ? `${nombre.slice(0, n - 1)}…` : nombre;
}

/**
 * Pareto de concentración: qué escuelas aportan la mayoría de los niños.
 *
 * Las dos series van en la MISMA escala (porcentaje 0–100): barras = % que aporta
 * cada escuela, línea = % acumulado. Nada de doble eje —dos escalas en un mismo
 * plano inventan correlaciones que no están en los datos—; aquí ambas miden lo
 * mismo, así que comparten eje honestamente.
 */
export function GraficaConcentracion({ data, max = 12 }: Props) {
  if (data.length === 0) {
    return (
      <div className="h-full min-h-32 flex items-center justify-center text-sm text-muted-foreground">
        Sin datos aún
      </div>
    );
  }

  const items = data.slice(0, max).map((d) => ({ ...d, corto: corto(d.escuela) }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={items} margin={{ left: -12, right: 34, top: 8, bottom: 8 }}>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="corto"
          interval={0}
          angle={-35}
          textAnchor="end"
          height={92}
          tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tickFormatter={(v: number) => `${v}%`}
          tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        {/* El 80% es la lectura clásica de Pareto: dónde se junta la mayoría */}
        <ReferenceLine
          y={80}
          stroke="var(--border)"
          label={{
            value: "80%",
            position: "insideTopRight",
            fill: "var(--muted-foreground)",
            fontSize: 10,
          }}
        />
        <Tooltip
          contentStyle={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            color: "var(--foreground)",
          }}
          cursor={{ fill: "var(--muted)" }}
          labelFormatter={(_l, payload) => payload?.[0]?.payload?.escuela ?? ""}
          formatter={(v, name, item) => {
            const p = item?.payload as { cantidad: number } | undefined;
            return name === "% de los niños"
              ? [`${v}% (${p?.cantidad ?? 0} niños)`, name]
              : [`${v}%`, name];
          }}
        />
        {/* Arriba: abajo chocaría con los nombres de escuela rotados */}
        <Legend
          verticalAlign="top"
          align="right"
          height={26}
          formatter={(value) => (
            <span style={{ color: "var(--muted-foreground)", fontSize: 12 }}>{value}</span>
          )}
        />
        <Bar
          maxBarSize={24}
          dataKey="pct"
          name="% de los niños"
          fill="var(--chart-1)"
          radius={[4, 4, 0, 0]}
        />
        <Line
          type="monotone"
          dataKey="acumPct"
          name="Acumulado"
          stroke="var(--chart-5)"
          strokeWidth={2}
          dot={{ fill: "var(--chart-5)", r: 4, stroke: "var(--card)", strokeWidth: 2 }}
          activeDot={{ r: 6, stroke: "var(--card)", strokeWidth: 2 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
