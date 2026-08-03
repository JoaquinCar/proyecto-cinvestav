"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  LabelList,
} from "recharts";

interface Props {
  data: { fecha: string; etiqueta: string; presentes: number; tema?: string }[];
}

/**
 * Retención de asistencia sesión a sesión.
 *
 * Una sola serie ⇒ área (un lavado del mismo tono, no un bloque saturado) y sin
 * caja de leyenda: el título ya dice qué se grafica. Se etiquetan solo tres
 * puntos —el pico, el mínimo y la última sesión—; poner el número en cada punto
 * se vuelve ruido y nadie lo lee. La línea de promedio da la referencia que de
 * otro modo habría que calcular a ojo.
 */
export function GraficaRetencion({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="h-full min-h-32 flex items-center justify-center text-sm text-muted-foreground">
        Sin datos aún
      </div>
    );
  }

  const valores = data.map((d) => d.presentes);
  const promedio = Math.round(valores.reduce((a, b) => a + b, 0) / valores.length);
  const maxV = Math.max(...valores);
  const minV = Math.min(...valores);
  const iUlt = data.length - 1;
  const iMax = valores.indexOf(maxV);
  const iMin = valores.lastIndexOf(minV);

  // Solo estos tres puntos llevan número encima; el resto vive en el eje y el tooltip.
  const chartData = data.map((d, i) => ({
    ...d,
    destacado: i === iMax || i === iMin || i === iUlt ? d.presentes : null,
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      {/* left a 0: con margen negativo la etiqueta del primer punto se monta en el eje */}
      <AreaChart data={chartData} margin={{ left: 0, right: 24, top: 20 }}>
        <defs>
          <linearGradient id="lavadoRetencion" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.18} />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--border)" vertical={false} />
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
        <ReferenceLine
          y={promedio}
          stroke="var(--border)"
          label={{
            value: `promedio ${promedio}`,
            position: "insideTopRight",
            fill: "var(--muted-foreground)",
            fontSize: 10,
          }}
        />
        <Tooltip
          contentStyle={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            color: "var(--foreground)",
          }}
          cursor={{ stroke: "var(--border)" }}
          labelFormatter={(l, payload) => {
            const tema = payload?.[0]?.payload?.tema;
            return tema ? `${l} · ${tema}` : l;
          }}
          formatter={(v) => [`${v} asistentes`, ""]}
        />
        <Area
          type="monotone"
          dataKey="presentes"
          stroke="var(--chart-1)"
          strokeWidth={2}
          fill="url(#lavadoRetencion)"
          dot={{ fill: "var(--chart-1)", r: 4, stroke: "var(--card)", strokeWidth: 2 }}
          activeDot={{ r: 6, stroke: "var(--card)", strokeWidth: 2 }}
        >
          <LabelList
            dataKey="destacado"
            position="top"
            offset={10}
            style={{ fill: "var(--muted-foreground)", fontSize: 11 }}
          />
        </Area>
      </AreaChart>
    </ResponsiveContainer>
  );
}
