"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface Props {
  data: { genero: string; cantidad: number }[];
}

// Femenino → rosa (chart-3), Masculino → azul (chart-1), Sin especificar → muted
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

export function GraficaGenero({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
        Sin datos aún
      </div>
    );
  }

  const chartData = data.map((d) => ({ ...d, label: LABEL[d.genero] ?? d.genero }));

  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="45%"
          innerRadius={55}
          outerRadius={85}
          dataKey="cantidad"
          nameKey="label"
          paddingAngle={2}
        >
          {chartData.map((d, i) => (
            <Cell key={i} fill={COLOR[d.genero] ?? "var(--chart-5)"} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            color: "var(--foreground)",
          }}
          formatter={(v, _n, p) => [`${v}`, p?.payload?.label ?? ""]}
        />
        <Legend
          formatter={(value) => (
            <span style={{ color: "var(--muted-foreground)", fontSize: 12 }}>{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
