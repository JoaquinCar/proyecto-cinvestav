"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { HistoricoEdicion } from "@/server/queries/historico";

interface Props {
  data: HistoricoEdicion[];
}

export function GraficaHistorico({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
        Sin datos históricos — crea más de una edición para ver tendencias
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis
          dataKey="anio"
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
        />
        <Legend
          formatter={(value) => (
            <span style={{ color: "var(--muted-foreground)", fontSize: 11 }}>{value}</span>
          )}
        />
        <Line
          type="monotone"
          dataKey="totalParticipantes"
          name="Participantes"
          stroke="var(--chart-1)"
          strokeWidth={2}
          dot={{ fill: "var(--chart-1)", r: 4 }}
          activeDot={{ r: 6 }}
        />
        <Line
          type="monotone"
          dataKey="totalSesiones"
          name="Sesiones"
          stroke="var(--chart-2)"
          strokeWidth={2}
          dot={{ fill: "var(--chart-2)", r: 4 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
