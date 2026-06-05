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
  data: { nombre: string; asistentes: number }[];
}

const CHART_VARS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

// recorta nombres largos para el eje
function corto(nombre: string): string {
  const limpio = nombre.replace(/^\d+\.\s*/, "");
  return limpio.length > 28 ? limpio.slice(0, 27) + "…" : limpio;
}

export function GraficaRanking({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
        Sin datos aún
      </div>
    );
  }

  const chartData = data.map((d) => ({ ...d, label: corto(d.nombre) }));
  const altura = Math.max(220, chartData.length * 44);

  return (
    <ResponsiveContainer width="100%" height={altura}>
      <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 24 }}>
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
          dataKey="label"
          width={170}
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
          formatter={(v) => [`${v} asistencias`, ""]}
        />
        <Bar dataKey="asistentes" radius={[0, 4, 4, 0]}>
          {chartData.map((_, i) => (
            <Cell key={i} fill={CHART_VARS[i % CHART_VARS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
