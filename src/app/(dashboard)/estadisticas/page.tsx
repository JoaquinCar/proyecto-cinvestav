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
import { GraficaBarrasDual } from "@/components/dashboard/GraficaBarrasDual";
import { GraficaTendencia } from "@/components/dashboard/GraficaTendencia";
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

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <h3 className="text-sm font-semibold mb-1 text-foreground">{title}</h3>
      {subtitle && <p className="text-xs mb-4 text-muted-foreground">{subtitle}</p>}
      {children}
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
          <Panel title="Niñas y niños por nivel escolar" subtitle="Composición de género en cada nivel">
            <GraficaBarrasDual data={a.generoPorNivel} labelA="Niñas" labelB="Niños" />
          </Panel>
          <Panel title="Pirámide de edad" subtitle="Niñas y niños registrados por edad">
            <GraficaBarrasDual data={a.edadGenero} labelA="Niñas" labelB="Niños" />
          </Panel>
        </div>
      </section>

      {/* ── Concentración por escuela ── */}
      <section className="animate-fade-up">
        <h2 className="font-display text-xl font-semibold text-foreground mb-4">
          ¿De dónde vienen?
        </h2>
        <Panel
          title="Concentración por escuela"
          subtitle="Cuántos niños aporta cada escuela y el acumulado"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
                  <th className="py-2 pr-3 font-medium">Escuela</th>
                  <th className="py-2 px-3 font-medium text-right">Niños</th>
                  <th className="py-2 px-3 font-medium text-right">%</th>
                  <th className="py-2 pl-3 font-medium w-1/3">Acumulado</th>
                </tr>
              </thead>
              <tbody>
                {a.concentracionEscuelas.map((e, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="py-2 pr-3 text-foreground">{e.escuela}</td>
                    <td className="py-2 px-3 text-right tabular text-foreground">{e.cantidad}</td>
                    <td className="py-2 px-3 text-right tabular text-muted-foreground">{e.pct}%</td>
                    <td className="py-2 pl-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary/60"
                            style={{ width: `${e.acumPct}%` }}
                          />
                        </div>
                        <span className="text-xs tabular text-muted-foreground w-9 text-right">
                          {e.acumPct}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </section>

      {/* ── Familias / registros por contacto ── */}
      <section className="animate-fade-up">
        <h2 className="font-display text-xl font-semibold text-foreground mb-4">
          Familias y grupos
        </h2>
        <Panel
          title="Registros por contacto"
          subtitle="Un mismo teléfono/correo puede inscribir a varios niños (familias o grupos)"
        >
          <div className="space-y-2">
            {a.registrosPorContacto.slice(0, 8).map((c, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-32 shrink-0 text-xs text-muted-foreground truncate">
                  {maskContacto(c.contacto)}
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
          <p className="mt-4 text-xs text-muted-foreground leading-relaxed">
            {maxContacto > 5
              ? `Un solo contacto registró ${maxContacto} niños (probablemente un grupo o casa hogar); el resto son familias de 1 a ${
                  a.registrosPorContacto.filter((c) => c.cantidad < maxContacto)[0]?.cantidad ?? 1
                } niños.`
              : "La mayoría de los registros son familias pequeñas."}
          </p>
        </Panel>
      </section>

      {/* ── Asistencia a lo largo del programa ── */}
      <section className="animate-fade-up">
        <h2 className="font-display text-xl font-semibold text-foreground mb-4">
          Asistencia a lo largo del programa
        </h2>
        <div className="grid grid-cols-1 gap-4">
          <Panel
            title="Retención de asistencia"
            subtitle={
              a.picoAsist && a.minAsist
                ? `Del pico de ${a.picoAsist.total} se bajó a ${a.minAsist.total} — una caída del ${a.caidaPct}% hacia el final`
                : "Asistentes por sesión"
            }
          >
            <GraficaTendencia data={a.retencion} />
          </Panel>
          <Panel
            title="Acompañantes por sesión"
            subtitle={`Mamás y papás presentes · ${a.ratioAcompanantes} acompañantes por cada 10 niños`}
          >
            <GraficaBarrasDual
              data={a.acompanantesPorSesion}
              labelA="Mamás"
              labelB="Papás"
              colorA="var(--chart-3)"
              colorB="var(--chart-2)"
            />
          </Panel>
        </div>
      </section>

      {/* ── Histórico (solo con más de una edición) ── */}
      {ediciones.length > 1 && (
        <section className="animate-fade-up">
          <h2 className="font-display text-xl font-semibold text-foreground mb-4">
            Comparativo entre ediciones
          </h2>
          <Panel title="Crecimiento histórico" subtitle="Participantes y sesiones por edición">
            <GraficaHistorico data={ediciones} />
          </Panel>
        </section>
      )}
    </div>
  );
}
