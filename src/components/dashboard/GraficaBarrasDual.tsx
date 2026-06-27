"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface Props {
  data: { etiqueta: string; tema?: string; a: number; b: number }[];
  labelA: string;
  labelB: string;
  colorA?: string;
  colorB?: string;
  height?: number;
}

export function GraficaBarrasDual({
  data,
  labelA,
  labelB,
  colorA = "var(--chart-3)",
  colorB = "var(--chart-1)",
  height = 260,
}: Props) {
  if (data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
        Sin datos aún
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ left: -10, right: 8, top: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="etiqueta"
          tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            color: "var(--foreground)",
          }}
          cursor={{ fill: "var(--muted)" }}
          labelFormatter={(l, payload) => payload?.[0]?.payload?.tema ?? l}
        />
        <Legend
          formatter={(value) => (
            <span style={{ color: "var(--muted-foreground)", fontSize: 12 }}>{value}</span>
          )}
        />
        <Bar dataKey="a" name={labelA} fill={colorA} radius={[4, 4, 0, 0]} />
        <Bar dataKey="b" name={labelB} fill={colorB} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
