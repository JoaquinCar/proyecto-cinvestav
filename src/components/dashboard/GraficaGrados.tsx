"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const CHART_VARS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

interface Props {
  data: { grado: string; cantidad: number }[];
}

export function GraficaGrados({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
        Sin datos aún
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="45%"
          innerRadius={50}
          outerRadius={80}
          dataKey="cantidad"
          nameKey="grado"
          paddingAngle={2}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={CHART_VARS[i % CHART_VARS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            color: "var(--foreground)",
          }}
        />
        <Legend
          formatter={(value) => (
            <span style={{ color: "var(--muted-foreground)", fontSize: 11 }}>
              {value}
            </span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
