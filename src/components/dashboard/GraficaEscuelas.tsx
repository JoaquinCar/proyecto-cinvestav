"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";

interface Props {
  data: { escuela: string; cantidad: number }[];
  /** Limita a las N primeras; por defecto muestra todas. */
  max?: number;
  /** Ancho de la columna de etiquetas (nombres largos necesitan más). */
  labelWidth?: number;
}

// chart-1 through chart-5 cycling for bars
const CHART_VARS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export function GraficaEscuelas({ data, max, labelWidth = 200 }: Props) {
  const items = typeof max === "number" ? data.slice(0, max) : data;

  if (items.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
        Sin datos aún
      </div>
    );
  }

  const height = Math.max(220, items.length * 34);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={items} layout="vertical" margin={{ left: 0, right: 28, top: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <YAxis
          type="category"
          dataKey="escuela"
          width={labelWidth}
          interval={0}
          tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            color: "var(--foreground)",
          }}
          cursor={{ fill: "var(--muted)" }}
        />
        <Bar dataKey="cantidad" radius={[0, 4, 4, 0]}>
          {items.map((_, i) => (
            <Cell key={i} fill={CHART_VARS[i % CHART_VARS.length]} />
          ))}
          <LabelList
            dataKey="cantidad"
            position="right"
            style={{ fill: "var(--muted-foreground)", fontSize: 11 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
