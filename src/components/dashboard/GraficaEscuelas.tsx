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
} from "recharts";

interface Props {
  data: { escuela: string; cantidad: number }[];
}

// chart-1 through chart-5 cycling for bars
const CHART_VARS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export function GraficaEscuelas({ data }: Props) {
  const top10 = data.slice(0, 10);

  if (top10.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
        Sin datos aún
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart
        data={top10}
        layout="vertical"
        margin={{ left: 0, right: 16 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="var(--border)"
          horizontal={false}
        />
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
          width={130}
          tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
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
          {top10.map((_, i) => (
            <Cell key={i} fill={CHART_VARS[i % CHART_VARS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
