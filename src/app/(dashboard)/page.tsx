import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Users, ClipboardCheck, Award, BookOpen, Download } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/server/db";
import { obtenerMetricasEdicion } from "@/server/queries/estadisticas";
import { GraficaEscuelas } from "@/components/dashboard/GraficaEscuelas";
import { GraficaGrados } from "@/components/dashboard/GraficaGrados";

export const metadata: Metadata = { title: "Dashboard · Pasaporte Científico" };

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const edicion = await prisma.edicion.findFirst({ where: { activa: true } });
  const metricas = edicion ? await obtenerMetricasEdicion(edicion.id) : null;

  const statCards = [
    {
      label: "Participantes inscritos",
      value: metricas?.totalParticipantes ?? "—",
      icon: Users,
      color: "oklch(0.72 0.165 72)",
      bg: "oklch(0.72 0.165 72 / 0.1)",
    },
    {
      label: "Asistencia promedio",
      value: metricas ? `${metricas.promedioAsistencia}%` : "—",
      icon: ClipboardCheck,
      color: "oklch(0.52 0.17 152)",
      bg: "oklch(0.52 0.17 152 / 0.1)",
    },
    {
      label: "Constancias generadas",
      value: metricas?.totalConstancias ?? "—",
      icon: Award,
      color: "oklch(0.64 0.12 220)",
      bg: "oklch(0.64 0.12 220 / 0.1)",
    },
    {
      label: "Sesiones impartidas",
      value: metricas?.totalSesiones ?? "—",
      icon: BookOpen,
      color: "oklch(0.55 0.15 280)",
      bg: "oklch(0.55 0.15 280 / 0.1)",
    },
  ];

  return (
    <div className="space-y-8">
      <div className="animate-fade-up flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1
            className="font-display text-3xl font-light"
            style={{ color: "oklch(0.96 0.01 80)" }}
          >
            Resumen de la{" "}
            <em style={{ color: "oklch(0.72 0.165 72)" }}>edición activa</em>
          </h1>
          <p className="mt-1 text-sm" style={{ color: "oklch(0.62 0.06 235)" }}>
            {edicion
              ? `${edicion.nombre} ${edicion.anio} · CINVESTAV Unidad Mérida`
              : "Sin edición activa — crea una en /ediciones"}
          </p>
        </div>
        {edicion && session.user.role === "ADMIN" && (
          <a
            href={`/api/exportar/excel/${edicion.id}`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-80"
            style={{
              background: "oklch(0.18 0.032 248)",
              border: "1px solid oklch(0.28 0.055 248)",
              color: "oklch(0.72 0.165 72)",
            }}
          >
            <Download size={15} />
            Exportar Excel
          </a>
        )}
      </div>

      <div className="gold-rule animate-fade-up animate-fade-up-delay-1" />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, color, bg }, i) => (
          <div
            key={label}
            className={`animate-fade-up animate-fade-up-delay-${i + 1} rounded-xl p-6`}
            style={{
              background: "oklch(0.18 0.032 248)",
              border: "1px solid oklch(0.28 0.055 248)",
            }}
          >
            <div className="flex items-start justify-between mb-4">
              <p
                className="text-xs font-medium tracking-wide uppercase"
                style={{
                  color: "oklch(0.55 0.05 240)",
                  letterSpacing: "0.07em",
                }}
              >
                {label}
              </p>
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center"
                style={{ background: bg }}
              >
                <Icon size={18} strokeWidth={2} style={{ color }} />
              </div>
            </div>
            <div className="stat-number text-5xl">{value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-fade-up animate-fade-up-delay-4">
        <div
          className="lg:col-span-2 rounded-xl p-6"
          style={{
            background: "oklch(0.18 0.032 248)",
            border: "1px solid oklch(0.28 0.055 248)",
          }}
        >
          <h3
            className="text-sm font-semibold mb-1"
            style={{ color: "oklch(0.82 0.04 240)" }}
          >
            Participación por escuela
          </h3>
          <p className="text-xs mb-4" style={{ color: "oklch(0.55 0.04 240)" }}>
            Top 10 escuelas con más inscritos
          </p>
          <GraficaEscuelas data={metricas?.porEscuela ?? []} />
        </div>

        <div
          className="rounded-xl p-6"
          style={{
            background: "oklch(0.18 0.032 248)",
            border: "1px solid oklch(0.28 0.055 248)",
          }}
        >
          <h3
            className="text-sm font-semibold mb-1"
            style={{ color: "oklch(0.82 0.04 240)" }}
          >
            Distribución por grado
          </h3>
          <p className="text-xs mb-4" style={{ color: "oklch(0.55 0.04 240)" }}>
            Inscritos por año escolar
          </p>
          <GraficaGrados data={metricas?.porGrado ?? []} />
        </div>
      </div>
    </div>
  );
}
