import {
  Users,
  Cake,
  School,
  TrendingDown,
  Activity,
  HeartHandshake,
  Crown,
} from "lucide-react";
import { obtenerAnalisisProfundo } from "@/server/queries/estadisticas";
import { obtenerHistoricoEdiciones } from "@/server/queries/historico";
import { PanelGrafica } from "@/components/dashboard/PanelGrafica";
import { BarrasApiladas } from "@/components/dashboard/BarrasApiladas";
import { PiramideEdad } from "@/components/dashboard/PiramideEdad";
import { GraficaConcentracion } from "@/components/dashboard/GraficaConcentracion";
import { GraficaRetencion } from "@/components/dashboard/GraficaRetencion";
import { GraficaHistorico } from "@/components/dashboard/GraficaHistorico";

// ─────────────────────────────────────────────────────────────────────────────
// Panel de análisis a fondo de UNA edición.
//
// Vive aquí, y no dentro de /estadisticas, porque el mismo reporte se pide desde
// dos sitios: /estadisticas?edicion=… y /ediciones/[id]/reportes. La edición
// llega siempre por props: este componente no sabe cuál es la activa ni le
// importa. Ese era justo el defecto anterior — el reporte de una edición
// mostraba el de la edición activa.
// ─────────────────────────────────────────────────────────────────────────────

function InsightCard({
  label,
  value,
  hint,
  icon: Icon,
  colorClass,
  bgClass,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  colorClass: string;
  bgClass: string;
}) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${bgClass}`}>
          <Icon size={16} strokeWidth={2} className={colorClass} />
        </div>
      </div>
      <div className="stat-number text-4xl tabular">{value}</div>
      {hint && <p className="mt-1.5 text-xs text-muted-foreground leading-snug">{hint}</p>}
    </div>
  );
}

export async function AnalisisEdicion({
  edicionId,
  mostrarComparativo = true,
}: {
  edicionId: string;
  /** El comparativo entre ediciones solo tiene sentido en la vista general. */
  mostrarComparativo?: boolean;
}) {
  const [a, ediciones] = await Promise.all([
    obtenerAnalisisProfundo(edicionId),
    mostrarComparativo ? obtenerHistoricoEdiciones() : Promise.resolve([]),
  ]);

  // Lectura de Pareto: cuántas escuelas hacen falta para llegar al 80% de los niños
  const escuelasHasta80 = a.concentracionEscuelas.findIndex((e) => e.acumPct >= 80) + 1;

  return (
    <div className="space-y-8">
      {/* ── Qué se está contando ──
          El reporte cuenta solo sesiones de pasaporte: decirlo arriba evita la
          pregunta de siempre («¿por qué aquí salen 12 si en la lista hay
          22?»). La lectura y los eventos se capturan igual, pero no entran. */}
      <p className="animate-fade-up text-sm leading-relaxed rounded-xl px-4 py-3 bg-muted/40 border border-border text-muted-foreground">
        Este reporte cuenta <strong className="text-foreground">solo las sesiones de
        pasaporte</strong>. En las sesiones de lectura y en los eventos especiales se
        pasa lista igual y ese dato se conserva —se consulta en sus listas de{" "}
        <strong className="text-foreground">Sesiones</strong> y{" "}
        <strong className="text-foreground">Eventos</strong>—, pero queda fuera de
        estas cifras.
      </p>

      {/* ── Insights destacados ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-up animate-fade-up-delay-1">
        <InsightCard
          label="Niños registrados"
          value={a.totalNinos}
          hint={`${a.totalNinas} niñas (${a.pctNinas}%) · ${a.totalNinosM} niños`}
          icon={Users}
          colorClass="text-secondary"
          bgClass="bg-secondary/10"
        />
        <InsightCard
          label="Edad promedio"
          value={`${a.edadPromedio}`}
          hint={`de ${a.edadMin} a ${a.edadMax} años`}
          icon={Cake}
          colorClass="text-chart-3"
          bgClass="bg-chart-3/10"
        />
        <InsightCard
          label="Escuelas"
          value={a.numEscuelas}
          hint={a.escuelaTop ? `Top: ${a.escuelaTop.nombre} (${a.escuelaTop.pct}%)` : undefined}
          icon={School}
          colorClass="text-chart-5"
          bgClass="bg-chart-5/10"
        />
        <InsightCard
          label="Asistencia promedio"
          value={a.promedioAsist}
          hint={`por sesión de pasaporte capturada (${a.sesionesCapturadas} de ${a.sesionesTotal} registradas)`}
          icon={Activity}
          colorClass="text-success"
          bgClass="bg-success/10"
        />
        <InsightCard
          label="Pico de asistencia"
          value={a.picoAsist?.total ?? "—"}
          hint={a.picoAsist?.tema}
          icon={Crown}
          colorClass="text-secondary"
          bgClass="bg-secondary/10"
        />
        <InsightCard
          label="Caída de asistencia"
          value={`${a.caidaPct}%`}
          hint="de la 1ª a la última sesión con datos"
          icon={TrendingDown}
          colorClass="text-destructive"
          bgClass="bg-destructive/10"
        />
        <InsightCard
          label="Acompañantes"
          value={a.totalAcompanantes}
          // El desglose antes que el ratio: el coordinador pidió ver «mamás: 5,
          // papás: 4», que es la pregunta que se hace. El ratio es contexto.
          hint={`${a.totalMamas} mamás · ${a.totalPapas} papás · ${a.ratioAcompanantes} por cada 10 niños`}
          icon={HeartHandshake}
          colorClass="text-chart-3"
          bgClass="bg-chart-3/10"
        />
      </div>

      {/* ── Composición: género × nivel + pirámide de edad ── */}
      <section className="animate-fade-up">
        <h2 className="font-display text-xl font-semibold text-foreground mb-4">
          ¿Quiénes participan?
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <PanelGrafica
            title="Niñas y niños por nivel escolar"
            subtitle="Composición de cada nivel, normalizada al 100%"
            alto={260}
            datos={{
              columnas: ["Nivel", "Niñas", "Niños", "Total", "% niñas"],
              filas: a.generoPorNivel.map((g) => [
                g.etiqueta,
                g.a,
                g.b,
                g.a + g.b,
                `${g.a + g.b ? Math.round((g.a / (g.a + g.b)) * 100) : 0}%`,
              ]),
            }}
          >
            <BarrasApiladas
              data={a.generoPorNivel}
              labelA="Niñas"
              labelB="Niños"
              porcentaje
              horizontal
              anchoEtiqueta={104}
            />
          </PanelGrafica>

          <PanelGrafica
            title="Pirámide de edad"
            subtitle="Niñas a la izquierda, niños a la derecha, sobre el mismo eje de edad"
            alto={260}
            datos={{
              columnas: ["Edad", "Niñas", "Niños", "Total"],
              filas: a.edadGenero.map((e) => [`${e.etiqueta} años`, e.a, e.b, e.a + e.b]),
            }}
          >
            <PiramideEdad data={a.edadGenero} />
          </PanelGrafica>
        </div>
      </section>

      {/* ── Concentración por escuela ── */}
      <section className="animate-fade-up">
        <h2 className="font-display text-xl font-semibold text-foreground mb-4">
          ¿De dónde vienen?
        </h2>
        <PanelGrafica
          title="Concentración por escuela"
          subtitle="Cuánto aporta cada escuela (barras) y cuánto se acumula (línea) — ambas en % sobre el mismo eje"
          alto={320}
          altoExpandido={560}
          nota={
            escuelasHasta80 > 0
              ? `${escuelasHasta80} ${
                  escuelasHasta80 === 1 ? "escuela concentra" : "escuelas concentran"
                } el 80% de los niños, de ${a.numEscuelas} en total.`
              : undefined
          }
          datos={{
            columnas: ["Escuela", "Niños", "%", "Acumulado"],
            filas: a.concentracionEscuelas.map((e) => [
              e.escuela,
              e.cantidad,
              `${e.pct}%`,
              `${e.acumPct}%`,
            ]),
          }}
        >
          <GraficaConcentracion data={a.concentracionEscuelas} />
        </PanelGrafica>
      </section>

      {/* ── Asistencia a lo largo del programa ── */}
      <section className="animate-fade-up">
        <h2 className="font-display text-xl font-semibold text-foreground mb-4">
          Asistencia a lo largo del programa
        </h2>
        <div className="grid grid-cols-1 gap-4">
          <PanelGrafica
            title="Retención de asistencia"
            subtitle={
              a.picoAsist && a.minAsist
                ? `Del pico de ${a.picoAsist.total} se bajó a ${a.minAsist.total} — una caída del ${a.caidaPct}% hacia el final`
                : "Asistentes por sesión"
            }
            alto={280}
            altoExpandido={520}
            datos={{
              columnas: ["Sesión", "Asistentes"],
              filas: a.retencion.map((r) => [r.etiqueta, r.presentes]),
            }}
          >
            <GraficaRetencion data={a.retencion} />
          </PanelGrafica>

          <PanelGrafica
            title="Acompañantes por sesión"
            subtitle={`Mamás y papás presentes · ${a.ratioAcompanantes} acompañantes por cada 10 niños`}
            alto={280}
            altoExpandido={520}
            datos={{
              columnas: ["Sesión", "Mamás", "Papás", "Total"],
              filas: a.acompanantesPorSesion.map((s) => [s.etiqueta, s.a, s.b, s.a + s.b]),
            }}
          >
            <BarrasApiladas
              data={a.acompanantesPorSesion}
              labelA="Mamás"
              labelB="Papás"
              colorA="var(--chart-5)"
              colorB="var(--chart-2)"
            />
          </PanelGrafica>
        </div>
      </section>

      {/* ── Histórico (solo con más de una edición) ── */}
      {mostrarComparativo && ediciones.length > 1 && (
        <section className="animate-fade-up">
          <h2 className="font-display text-xl font-semibold text-foreground mb-4">
            Comparativo entre ediciones
          </h2>
          {/* Small multiples: cada medida en su propia escala. Participantes
              (decenas) y sesiones (unidades) en un mismo eje aplastarían la
              segunda contra el suelo. */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <PanelGrafica
              title="Participantes por edición"
              subtitle="Niños registrados en cada año"
              alto={230}
              altoExpandido={480}
              datos={{
                columnas: ["Edición", "Participantes"],
                filas: ediciones.map((e) => [`${e.anio} · ${e.nombre}`, e.totalParticipantes]),
              }}
            >
              <GraficaHistorico data={ediciones} serie="totalParticipantes" />
            </PanelGrafica>

            <PanelGrafica
              title="Sesiones por edición"
              subtitle="Cuántas sesiones de pasaporte se impartieron"
              alto={230}
              altoExpandido={480}
              datos={{
                columnas: ["Edición", "Sesiones"],
                filas: ediciones.map((e) => [`${e.anio} · ${e.nombre}`, e.totalSesiones]),
              }}
            >
              <GraficaHistorico data={ediciones} serie="totalSesiones" color="var(--chart-5)" />
            </PanelGrafica>

            <PanelGrafica
              title="Asistencia promedio"
              subtitle="% de asistencia a las sesiones de pasaporte de cada edición"
              alto={230}
              altoExpandido={480}
              datos={{
                columnas: ["Edición", "Asistencia promedio"],
                filas: ediciones.map((e) => [
                  `${e.anio} · ${e.nombre}`,
                  `${e.promedioAsistencia}%`,
                ]),
              }}
            >
              <GraficaHistorico data={ediciones} serie="promedioAsistencia" color="var(--chart-4)" />
            </PanelGrafica>
          </div>
        </section>
      )}
    </div>
  );
}
