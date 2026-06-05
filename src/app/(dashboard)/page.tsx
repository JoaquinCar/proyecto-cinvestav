import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Users, ClipboardCheck, BookOpen, Download } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/server/db";
import { obtenerMetricasEdicion } from "@/server/queries/estadisticas";
import { GraficaEscuelas } from "@/components/dashboard/GraficaEscuelas";
import { GraficaGrados } from "@/components/dashboard/GraficaGrados";
import { GraficaTendencia } from "@/components/dashboard/GraficaTendencia";
import { GraficaEdad } from "@/components/dashboard/GraficaEdad";
import { GraficaGenero } from "@/components/dashboard/GraficaGenero";
import { GraficaRanking } from "@/components/dashboard/GraficaRanking";

export const metadata: Metadata = { title: "Dashboard · Pasaporte Científico" };

const statCards = [
  {
    label: "Participantes inscritos",
    icon: Users,
    colorClass: "text-secondary",
    bgClass: "bg-secondary/10",
  },
  {
    label: "Asistencia promedio",
    icon: ClipboardCheck,
    colorClass: "text-success",
    bgClass: "bg-success/10",
  },
  {
    label: "Sesiones impartidas",
    icon: BookOpen,
    colorClass: "text-chart-5",
    bgClass: "bg-chart-5/10",
  },
] as const;

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const edicion = await prisma.edicion.findFirst({ where: { activa: true } });
  const metricas = edicion ? await obtenerMetricasEdicion(edicion.id) : null;

  const statValues = [
    metricas?.totalParticipantes ?? "—",
    metricas ? `${metricas.promedioAsistencia}%` : "—",
    metricas?.totalSesiones ?? "—",
  ];

  return (
    <div className="space-y-8">
      <div className="animate-fade-up flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-semibold text-foreground">
            Resumen de la{" "}
            <em className="text-primary not-italic font-semibold">edición activa</em>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {edicion
              ? `${edicion.nombre} ${edicion.anio} · CINVESTAV Unidad Mérida`
              : "Sin edición activa — crea una en /ediciones"}
          </p>
        </div>
        {edicion && session.user.role === "ADMIN" && (
          <a
            href={`/api/exportar/excel/${edicion.id}`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-border bg-muted text-foreground transition-opacity hover:opacity-80"
          >
            <Download size={15} />
            Exportar Excel
          </a>
        )}
      </div>

      <div className="h-px bg-border animate-fade-up animate-fade-up-delay-1" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {statCards.map(({ label, icon: Icon, colorClass, bgClass }, i) => (
          <div
            key={label}
            className={`animate-fade-up animate-fade-up-delay-${i + 1} bg-card border border-border rounded-2xl p-6`}
          >
            <div className="flex items-start justify-between mb-4">
              <p className="text-xs font-medium tracking-wide uppercase text-muted-foreground">
                {label}
              </p>
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${bgClass}`}>
                <Icon size={18} strokeWidth={2} className={colorClass} />
              </div>
            </div>
            <div className="stat-number text-5xl">{statValues[i]}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-fade-up animate-fade-up-delay-4">
        <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-6">
          <h3 className="text-sm font-semibold mb-1 text-foreground">
            Participación por escuela
          </h3>
          <p className="text-xs mb-4 text-muted-foreground">
            Top 10 escuelas con más inscritos
          </p>
          <GraficaEscuelas data={metricas?.porEscuela ?? []} />
        </div>

        <div className="bg-card border border-border rounded-2xl p-6">
          <h3 className="text-sm font-semibold mb-1 text-foreground">
            Distribución por grado
          </h3>
          <p className="text-xs mb-4 text-muted-foreground">
            Inscritos por año escolar
          </p>
          <GraficaGrados data={metricas?.porGrado ?? []} />
        </div>
      </div>

      {/* Tendencia de asistencia por fecha */}
      <div className="bg-card border border-border rounded-2xl p-6 animate-fade-up">
        <h3 className="text-sm font-semibold mb-1 text-foreground">
          Tendencia de asistencia
        </h3>
        <p className="text-xs mb-4 text-muted-foreground">
          Asistentes presentes por fecha de sesión
        </p>
        <GraficaTendencia data={metricas?.tendencia ?? []} />
      </div>

      {/* Edad + Género */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-fade-up">
        <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-6">
          <h3 className="text-sm font-semibold mb-1 text-foreground">
            Distribución por edad
          </h3>
          <p className="text-xs mb-4 text-muted-foreground">
            Participantes inscritos por edad
          </p>
          <GraficaEdad data={metricas?.porEdad ?? []} />
        </div>

        <div className="bg-card border border-border rounded-2xl p-6">
          <h3 className="text-sm font-semibold mb-1 text-foreground">
            Niñas y niños
          </h3>
          <p className="text-xs mb-4 text-muted-foreground">
            Distribución por género
          </p>
          <GraficaGenero data={metricas?.porGenero ?? []} />
        </div>
      </div>

      {/* Ranking de clases */}
      <div className="bg-card border border-border rounded-2xl p-6 animate-fade-up">
        <h3 className="text-sm font-semibold mb-1 text-foreground">
          Clases con más convocatoria
        </h3>
        <p className="text-xs mb-4 text-muted-foreground">
          Total de asistencias registradas por clase
        </p>
        <GraficaRanking data={metricas?.rankingClases ?? []} />
      </div>
    </div>
  );
}
