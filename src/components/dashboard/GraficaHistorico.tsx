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
      <div
        className="h-48 flex items-center justify-center text-sm"
        style={{ color: "oklch(0.35 0.04 248)" }}
      >
        Sin datos históricos — crea más de una edición para ver tendencias
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.24 0.04 248)" />
        <XAxis
          dataKey="anio"
          tick={{ fill: "oklch(0.62 0.06 235)", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fill: "oklch(0.55 0.05 240)", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
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
            <span style={{ color: "oklch(0.62 0.06 235)", fontSize: 11 }}>{value}</span>
          )}
        />
        <Line
          type="monotone"
          dataKey="totalParticipantes"
          name="Participantes"
          stroke="oklch(0.72 0.165 72)"
          strokeWidth={2}
          dot={{ fill: "oklch(0.72 0.165 72)", r: 4 }}
          activeDot={{ r: 6 }}
        />
        <Line
          type="monotone"
          dataKey="totalSesiones"
          name="Sesiones"
          stroke="oklch(0.64 0.12 220)"
          strokeWidth={2}
          dot={{ fill: "oklch(0.64 0.12 220)", r: 4 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
