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

export function GraficaEscuelas({ data }: Props) {
  const top10 = data.slice(0, 10);

  if (top10.length === 0) {
    return (
      <div
        className="h-48 flex items-center justify-center text-sm"
        style={{ color: "oklch(0.35 0.04 248)" }}
      >
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
          stroke="oklch(0.24 0.04 248)"
          horizontal={false}
        />
        <XAxis
          type="number"
          tick={{ fill: "oklch(0.55 0.05 240)", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <YAxis
          type="category"
          dataKey="escuela"
          width={130}
          tick={{ fill: "oklch(0.62 0.06 235)", fontSize: 10 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={{
            background: "oklch(0.18 0.032 248)",
            border: "1px solid oklch(0.28 0.055 248)",
            borderRadius: "8px",
            color: "oklch(0.96 0.01 80)",
          }}
          cursor={{ fill: "oklch(0.20 0.035 248)" }}
        />
        <Bar dataKey="cantidad" radius={[0, 4, 4, 0]}>
          {top10.map((_, i) => (
            <Cell key={i} fill={`oklch(0.72 0.165 ${72 + i * 6})`} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
