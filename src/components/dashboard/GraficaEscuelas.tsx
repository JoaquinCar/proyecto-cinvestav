"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
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
export function GraficaEscuelas({ data, max, labelWidth = 200 }: Props) {
  const items = typeof max === "number" ? data.slice(0, max) : data;

  if (items.length === 0) {
    return (
      <div className="h-full min-h-32 flex items-center justify-center text-sm text-muted-foreground">
        Sin datos aún
      </div>
    );
  }


  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={items} layout="vertical" margin={{ left: 0, right: 28, top: 4, bottom: 4 }}>
        <CartesianGrid stroke="var(--border)" horizontal={false} />
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
        <Bar maxBarSize={24} dataKey="cantidad" fill="var(--chart-1)" radius={[0, 4, 4, 0]}>
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
