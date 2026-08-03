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
import type { HistoricoEdicion } from "@/server/queries/historico";

type Serie = "totalParticipantes" | "totalSesiones" | "promedioAsistencia";

interface Props {
  data: HistoricoEdicion[];
  /** Qué medida se grafica. Una por gráfica: ver abajo por qué. */
  serie?: Serie;
  color?: string;
}

const ETIQUETA: Record<Serie, string> = {
  totalParticipantes: "participantes",
  totalSesiones: "sesiones",
  promedioAsistencia: "de asistencia",
};

/**
 * Una sola medida por edición.
 *
 * Antes esta gráfica ponía participantes (decenas) y sesiones (unidades) en el
 * mismo plano: dos magnitudes de escala muy distinta compartiendo eje aplastan la
 * pequeña contra el suelo y sugieren una relación que los datos no dicen. Ahora
 * cada medida es su propia gráfica —"small multiples"—, comparables por año y
 * honestas por separado.
 */
export function GraficaHistorico({
  data,
  serie = "totalParticipantes",
  color = "var(--chart-1)",
}: Props) {
  if (data.length === 0) {
    return (
      <div className="h-full min-h-32 flex items-center justify-center text-sm text-muted-foreground">
        Sin datos históricos — crea más de una edición para ver tendencias
      </div>
    );
  }

  const sufijo = serie === "promedioAsistencia" ? "%" : "";

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 20, right: 12, left: -12, bottom: 0 }}>
        <CartesianGrid stroke="var(--border)" vertical={false} />
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
          cursor={{ fill: "var(--muted)" }}
          labelFormatter={(l, payload) => payload?.[0]?.payload?.nombre ?? `${l}`}
          formatter={(v) => [`${v}${sufijo} ${ETIQUETA[serie]}`, ""]}
        />
        <Bar maxBarSize={48} dataKey={serie} fill={color} radius={[4, 4, 0, 0]}>
          <LabelList
            dataKey={serie}
            position="top"
            formatter={(v: React.ReactNode) => `${v}${sufijo}`}
            style={{ fill: "var(--muted-foreground)", fontSize: 11 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
