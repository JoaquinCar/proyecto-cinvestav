"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const COLORS = [
  "oklch(0.72 0.165 72)",
  "oklch(0.52 0.17 152)",
  "oklch(0.64 0.12 220)",
  "oklch(0.55 0.15 280)",
  "oklch(0.70 0.18 40)",
  "oklch(0.65 0.14 320)",
];

interface Props {
  data: { grado: string; cantidad: number }[];
}

export function GraficaGrados({ data }: Props) {
  if (data.length === 0) {
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
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: "oklch(0.18 0.032 248)",
            border: "1px solid oklch(0.28 0.055 248)",
            borderRadius: "8px",
            color: "oklch(0.96 0.01 80)",
          }}
        />
        <Legend
          formatter={(value) => (
            <span style={{ color: "oklch(0.62 0.06 235)", fontSize: 11 }}>
              {value}
            </span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
