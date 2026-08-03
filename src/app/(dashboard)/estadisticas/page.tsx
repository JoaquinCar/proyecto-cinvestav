import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  Users,
  Cake,
  School,
  TrendingDown,
  Activity,
  HeartHandshake,
  Crown,
  Contact,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/server/db";
import { obtenerHistoricoEdiciones } from "@/server/queries/historico";
import { obtenerAnalisisProfundo } from "@/server/queries/estadisticas";
import { PanelGrafica } from "@/components/dashboard/PanelGrafica";
import { BarrasApiladas } from "@/components/dashboard/BarrasApiladas";
import { PiramideEdad } from "@/components/dashboard/PiramideEdad";
import { GraficaConcentracion } from "@/components/dashboard/GraficaConcentracion";
import { GraficaRetencion } from "@/components/dashboard/GraficaRetencion";
import { GraficaHistorico } from "@/components/dashboard/GraficaHistorico";

export const metadata: Metadata = {
  title: "Estadísticas · Pasaporte Científico",
};

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

function maskContacto(c: string): string {
  if (/^\d{6,}$/.test(c)) return `tel. ••••${c.slice(-4)}`;
  if (c.includes("@")) {
    const [u, d] = c.split("@");
    return `${u.slice(0, 2)}•••@${d}`;
  }
  return c;
}

export default async function EstadisticasPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const [edicion, ediciones] = await Promise.all([
    prisma.edicion.findFirst({ where: { activa: true } }),
    obtenerHistoricoEdiciones(),
  ]);

  if (!edicion) {
    return (
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-semibold text-foreground">Estadísticas</h1>
        <p className="text-sm text-muted-foreground">Sin edición activa — crea una en /ediciones</p>
      </div>
    );
  }

  const a = await obtenerAnalisisProfundo(edicion.id);
  const maxContacto = a.registrosPorContacto[0]?.cantidad ?? 0;
  // Lectura de Pareto: cuántas escuelas hacen falta para llegar al 80% de los niños
  const escuelasHasta80 =
    a.concentracionEscuelas.findIndex((e) => e.acumPct >= 80) + 1;

  return (
    <div className="space-y-8 max-w-6xl">
      <div className="animate-fade-up">
        <h1 className="font-display text-3xl font-semibold text-foreground">
          Análisis <em className="text-primary not-italic font-semibold">a fondo</em>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {edicion.nombre} · una mirada completa a los participantes y su asistencia
        </p>
      </div>

      <div className="h-px bg-border animate-fade-up animate-fade-up-delay-1" />

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
          label="Contactos"
          value={a.numContactos}
          hint={`registraron a los ${a.totalNinos} niños`}
          icon={Contact}
          colorClass="text-primary"
          bgClass="bg-primary/10"
        />
        <InsightCard
          label="Asistencia promedio"
          value={a.promedioAsist}
          hint={`por sesión (${a.sesionesConDatos} de ${a.sesionesTotal} con datos)`}
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
          hint={`${a.ratioAcompanantes} por cada 10 niños`}
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

      {/* ── Familias / registros por contacto ── */}
      <section className="animate-fade-up">
        <h2 className="font-display text-xl font-semibold text-foreground mb-4">
          Familias y grupos
        </h2>
        <PanelGrafica
          title="Registros por contacto"
          subtitle="Un mismo teléfono/correo puede inscribir a varios niños (familias o grupos)"
          alto="auto"
          altoExpandido="auto"
          nota={
            maxContacto > 5
              ? `El ${a.registrosPorContacto[0]?.label ?? "contacto principal"} registró ${maxContacto} niños; el resto son familias de 1 a ${
                  a.registrosPorContacto.filter((c) => c.cantidad < maxContacto)[0]?.cantidad ?? 1
                } niños.`
              : "La mayoría de los registros son familias pequeñas."
          }
          datos={{
            columnas: ["Contacto", "Niños registrados", "Ejemplo"],
            filas: a.registrosPorContacto.map((c) => [
              c.label ?? maskContacto(c.contacto),
              c.cantidad,
              c.ejemplo,
            ]),
          }}
        >
          <div className="space-y-2">
            {a.registrosPorContacto.slice(0, 8).map((c, i) => (
              <div key={i} className="flex items-center gap-3">
                <div
                  className={`w-36 shrink-0 text-xs truncate ${
                    c.label ? "font-medium text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {c.label ?? maskContacto(c.contacto)}
                </div>
                <div className="flex-1 h-5 rounded-md bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-md bg-secondary/50 flex items-center px-2"
                    style={{ width: `${Math.max((c.cantidad / maxContacto) * 100, 8)}%` }}
                  >
                    <span className="text-xs font-medium text-foreground tabular">{c.cantidad}</span>
                  </div>
                </div>
                <div className="w-40 shrink-0 text-xs text-muted-foreground truncate hidden sm:block">
                  p. ej. {c.ejemplo}
                </div>
              </div>
            ))}
          </div>
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
      {ediciones.length > 1 && (
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
              subtitle="Cuántas sesiones se impartieron"
              alto={230}
              altoExpandido={480}
              datos={{
                columnas: ["Edición", "Sesiones"],
                filas: ediciones.map((e) => [`${e.anio} · ${e.nombre}`, e.totalSesiones]),
              }}
            >
              <GraficaHistorico
                data={ediciones}
                serie="totalSesiones"
                color="var(--chart-5)"
              />
            </PanelGrafica>

            <PanelGrafica
              title="Asistencia promedio"
              subtitle="% de asistencia de cada edición"
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
              <GraficaHistorico
                data={ediciones}
                serie="promedioAsistencia"
                color="var(--chart-4)"
              />
            </PanelGrafica>
          </div>
        </section>
      )}
    </div>
  );
}
