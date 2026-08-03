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
  ReferenceLine,
} from "recharts";

interface Props {
  /** a = niñas, b = niños, etiqueta = edad */
  data: { etiqueta: string; a: number; b: number }[];
}

/**
 * Pirámide poblacional: niñas a la izquierda, niños a la derecha, compartiendo el
 * eje de edad. Es la forma correcta para "composición por edad y género": la
 * simetría hace visible de un vistazo dónde se desbalancea, cosa que unas barras
 * agrupadas obligan a comparar par por par.
 */
export function PiramideEdad({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="h-full min-h-32 flex items-center justify-center text-sm text-muted-foreground">
        Sin datos aún
      </div>
    );
  }

  // Las niñas van en negativo para dibujarse hacia la izquierda; el eje y el
  // tooltip muestran siempre el valor absoluto.
  const chartData = data.map((d) => ({ ...d, aNeg: -d.a }));
  const max = Math.max(...data.map((d) => Math.max(d.a, d.b)), 1);
  const tope = Math.ceil(max * 1.15);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} layout="vertical" stackOffset="sign" margin={{ left: 0, right: 12, top: 4 }}>
        <CartesianGrid stroke="var(--border)" horizontal={false} />
        <XAxis
          type="number"
          domain={[-tope, tope]}
          tickFormatter={(v: number) => `${Math.abs(v)}`}
          tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <YAxis
          type="category"
          dataKey="etiqueta"
          width={44}
          interval={0}
          tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          label={{
            value: "Edad",
            position: "insideTopLeft",
            offset: -2,
            fill: "var(--muted-foreground)",
            fontSize: 11,
          }}
        />
        <ReferenceLine x={0} stroke="var(--border)" />
        <Tooltip
          contentStyle={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            color: "var(--foreground)",
          }}
          cursor={{ fill: "var(--muted)" }}
          formatter={(v, name) => [`${Math.abs(Number(v))}`, name]}
          labelFormatter={(l) => `${l} años`}
        />
        <Legend
          formatter={(value) => (
            <span style={{ color: "var(--muted-foreground)", fontSize: 12 }}>{value}</span>
          )}
        />
        <Bar
          maxBarSize={22}
          dataKey="aNeg"
          name="Niñas"
          fill="var(--chart-3)"
          stackId="edad"
          radius={[4, 0, 0, 4]}
        />
        <Bar
          maxBarSize={22}
          dataKey="b"
          name="Niños"
          fill="var(--chart-1)"
          stackId="edad"
          radius={[0, 4, 4, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
