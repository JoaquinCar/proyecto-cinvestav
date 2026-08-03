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
  LabelList,
} from "recharts";

interface Props {
  /** a y b son las dos partes que suman el total de cada categoría. */
  data: { etiqueta: string; tema?: string; a: number; b: number }[];
  labelA: string;
  labelB: string;
  colorA?: string;
  colorB?: string;
  /** Normaliza cada barra a 100%: la pregunta es la composición, no el volumen. */
  porcentaje?: boolean;
  /** Barras horizontales: mejor cuando las etiquetas son largas. */
  horizontal?: boolean;
  anchoEtiqueta?: number;
}

/**
 * Barras apiladas para preguntas de parte-sobre-total ("de cada nivel, cuánto es
 * niñas y cuánto niños"). Frente a las barras agrupadas, el apilado deja leer el
 * total de un vistazo y la composición sin comparar alturas separadas.
 * La separación entre segmentos es un hueco del color de la superficie, no un borde.
 */
export function BarrasApiladas({
  data,
  labelA,
  labelB,
  colorA = "var(--chart-3)",
  colorB = "var(--chart-1)",
  porcentaje = false,
  horizontal = false,
  anchoEtiqueta = 110,
}: Props) {
  if (data.length === 0) {
    return (
      <div className="h-full min-h-32 flex items-center justify-center text-sm text-muted-foreground">
        Sin datos aún
      </div>
    );
  }

  const filas = data.map((d) => {
    const total = d.a + d.b;
    return {
      ...d,
      total,
      valorA: porcentaje && total ? Math.round((d.a / total) * 100) : d.a,
      valorB: porcentaje && total ? 100 - Math.round((d.a / total) * 100) : d.b,
    };
  });

  const ejeNumerico = {
    tick: { fill: "var(--muted-foreground)", fontSize: 11 },
    tickLine: false,
    axisLine: false,
    allowDecimals: false,
    ...(porcentaje
      ? { domain: [0, 100] as [number, number], tickFormatter: (v: number) => `${v}%` }
      : {}),
  };
  const ejeCategoria = {
    dataKey: "etiqueta",
    tick: { fill: "var(--muted-foreground)", fontSize: 11 },
    tickLine: false,
    axisLine: false,
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={filas}
        layout={horizontal ? "vertical" : "horizontal"}
        margin={{ left: horizontal ? 0 : -10, right: 12, top: 8 }}
      >
        <CartesianGrid stroke="var(--border)" horizontal={!horizontal} vertical={horizontal} />
        {horizontal ? (
          <>
            <XAxis type="number" {...ejeNumerico} />
            <YAxis type="category" width={anchoEtiqueta} interval={0} {...ejeCategoria} />
          </>
        ) : (
          <>
            <XAxis type="category" interval={0} {...ejeCategoria} />
            <YAxis type="number" {...ejeNumerico} />
          </>
        )}
        <Tooltip
          contentStyle={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            color: "var(--foreground)",
          }}
          cursor={{ fill: "var(--muted)" }}
          labelFormatter={(l, payload) => payload?.[0]?.payload?.tema ?? l}
          formatter={(v, name, item) => {
            const p = item?.payload as { a: number; b: number } | undefined;
            if (!porcentaje || !p) return [`${v}`, name];
            const abs = name === labelA ? p.a : p.b;
            return [`${abs} (${v}%)`, name];
          }}
        />
        <Legend
          formatter={(value) => (
            <span style={{ color: "var(--muted-foreground)", fontSize: 12 }}>{value}</span>
          )}
        />
        <Bar
          maxBarSize={28}
          dataKey="valorA"
          name={labelA}
          fill={colorA}
          stackId="t"
          radius={horizontal ? [4, 0, 0, 4] : [0, 0, 4, 4]}
          // El hueco de 2px lo hace la superficie, no un borde sobre la marca
          stroke="var(--card)"
          strokeWidth={2}
        />
        <Bar
          maxBarSize={28}
          dataKey="valorB"
          name={labelB}
          fill={colorB}
          stackId="t"
          radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
          stroke="var(--card)"
          strokeWidth={2}
        >
          {!porcentaje && (
            <LabelList
              dataKey="total"
              position={horizontal ? "right" : "top"}
              style={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            />
          )}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
