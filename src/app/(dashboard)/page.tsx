import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  Users,
  CalendarCheck,
  TrendingUp,
  Download,
  Sparkles,
  UserRound,
  HeartHandshake,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/server/db";
import {
  obtenerMetricasEdicion,
  obtenerMetricasAsistencia,
} from "@/server/queries/estadisticas";
import { GraficaEscuelas } from "@/components/dashboard/GraficaEscuelas";
import { GraficaGrados } from "@/components/dashboard/GraficaGrados";
import { GraficaTendencia } from "@/components/dashboard/GraficaTendencia";
import { GraficaEdad } from "@/components/dashboard/GraficaEdad";
import { GraficaGenero } from "@/components/dashboard/GraficaGenero";
import { GraficaNinasNinos } from "@/components/dashboard/GraficaNinasNinos";

export const metadata: Metadata = { title: "Dashboard · Pasaporte Científico" };

function StatCard({
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
    <div className="bg-card border border-border rounded-2xl p-6">
      <div className="flex items-start justify-between mb-4">
        <p className="text-xs font-medium tracking-wide uppercase text-muted-foreground">
          {label}
        </p>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${bgClass}`}>
          <Icon size={18} strokeWidth={2} className={colorClass} />
        </div>
      </div>
      <div className="stat-number text-5xl">{value}</div>
      {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Panel({
  title,
  subtitle,
  children,
  span2,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  span2?: boolean;
}) {
  return (
    <div className={`bg-card border border-border rounded-2xl p-6 ${span2 ? "lg:col-span-2" : ""}`}>
      <h3 className="text-sm font-semibold mb-1 text-foreground">{title}</h3>
      <p className="text-xs mb-4 text-muted-foreground">{subtitle}</p>
      {children}
    </div>
  );
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const edicion = await prisma.edicion.findFirst({ where: { activa: true } });

  if (!edicion) {
    return (
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Sin edición activa — crea una en /ediciones
        </p>
      </div>
    );
  }

  const [metricas, asist] = await Promise.all([
    obtenerMetricasEdicion(edicion.id),
    obtenerMetricasAsistencia(edicion.id),
  ]);

  return (
    <div className="space-y-8">
      {/* Encabezado */}
      <div className="animate-fade-up flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-semibold text-foreground">
            Análisis ·{" "}
            <em className="text-primary not-italic font-semibold">{edicion.nombre}</em>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            CINVESTAV Unidad Mérida · {edicion.anio}
          </p>
        </div>
        {session.user.role === "ADMIN" && (
          <a
            href={`/api/exportar/excel/${edicion.id}`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-border bg-muted text-foreground transition-opacity hover:opacity-80"
          >
            <Download size={15} />
            Exportar Excel
          </a>
        )}
      </div>

      {/* Banner de cruce registro vs asistencia */}
      <div className="animate-fade-up animate-fade-up-delay-1 rounded-2xl border border-border bg-muted/40 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={16} className="text-primary" />
          <h2 className="text-sm font-semibold text-foreground">
            Registro vs. asistencia — lectura rápida
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wide">Niños registrados</p>
            <p className="text-foreground font-semibold text-lg">
              {metricas.totalParticipantes}
              <span className="text-muted-foreground font-normal text-sm">
                {" "}
                ({metricas.porGenero.find((g) => g.genero === "FEMENINO")?.cantidad ?? 0} niñas ·{" "}
                {metricas.porGenero.find((g) => g.genero === "MASCULINO")?.cantidad ?? 0} niños)
              </span>
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wide">
              Asistencia (eventos)
            </p>
            <p className="text-foreground font-semibold text-lg">
              {asist.totalEventos}
              <span className="text-muted-foreground font-normal text-sm">
                {" "}
                ({asist.totalNinas} niñas · {asist.totalNinos} niños)
              </span>
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wide">
              Sesiones con datos
            </p>
            <p className="text-foreground font-semibold text-lg">
              {asist.sesionesConDatos}
              <span className="text-muted-foreground font-normal text-sm">
                {" "}
                de {asist.totalSesiones}
              </span>
            </p>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
          El <strong>registro</strong> cuenta niños únicos inscritos; la{" "}
          <strong>asistencia</strong> son eventos sumados por sesión (un mismo niño cuenta
          en cada sesión a la que asiste). Por eso los totales no coinciden — son métricas
          distintas, no un error de captura.
        </p>
      </div>

      {/* ════════ SECCIÓN A · ASISTENCIA POR SESIÓN ════════ */}
      <div className="animate-fade-up">
        <h2 className="font-display text-xl font-semibold text-foreground mb-4">
          Asistencia por sesión
        </h2>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Asistencia promedio"
            value={asist.promedioPorSesion}
            hint="por sesión"
            icon={TrendingUp}
            colorClass="text-success"
            bgClass="bg-success/10"
          />
          <StatCard
            label="Pico de asistencia"
            value={asist.picoSesion}
            hint="mejor sesión"
            icon={Users}
            colorClass="text-secondary"
            bgClass="bg-secondary/10"
          />
          <StatCard
            label="Sesiones impartidas"
            value={`${asist.sesionesConDatos}/${asist.totalSesiones}`}
            hint="con datos / total"
            icon={CalendarCheck}
            colorClass="text-chart-5"
            bgClass="bg-chart-5/10"
          />
          <StatCard
            label="Acompañantes"
            value={asist.totalMamas + asist.totalPapas}
            hint={`${asist.totalMamas} mamás · ${asist.totalPapas} papás`}
            icon={HeartHandshake}
            colorClass="text-chart-3"
            bgClass="bg-chart-3/10"
          />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4">
          <Panel
            title="Tendencia de asistencia"
            subtitle="Total de asistentes por sesión a lo largo del programa"
          >
            <GraficaTendencia data={asist.tendencia} />
          </Panel>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4">
          <Panel
            title="Niñas y niños por sesión"
            subtitle="Comparativa de asistencia por género en cada sesión"
          >
            <GraficaNinasNinos data={asist.porSesion} />
          </Panel>
        </div>

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Panel
            title="Asistencia por edad"
            subtitle="Eventos de asistencia agrupados por edad"
            span2
          >
            <GraficaEdad data={asist.porEdad} />
          </Panel>
          <Panel title="Asistencia por nivel" subtitle="Por nivel escolar (eventos)">
            <GraficaEscuelas data={asist.porNivel} labelWidth={120} />
          </Panel>
        </div>
      </div>

      <div className="h-px bg-border" />

      {/* ════════ SECCIÓN B · PERFIL DE LOS INSCRITOS ════════ */}
      <div className="animate-fade-up">
        <h2 className="font-display text-xl font-semibold text-foreground mb-4">
          Perfil de los inscritos
        </h2>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <StatCard
            label="Total inscritos"
            value={metricas.totalParticipantes}
            hint="niños registrados"
            icon={UserRound}
            colorClass="text-secondary"
            bgClass="bg-secondary/10"
          />
          <StatCard
            label="Niñas"
            value={metricas.porGenero.find((g) => g.genero === "FEMENINO")?.cantidad ?? 0}
            icon={Users}
            colorClass="text-chart-3"
            bgClass="bg-chart-3/10"
          />
          <StatCard
            label="Niños"
            value={metricas.porGenero.find((g) => g.genero === "MASCULINO")?.cantidad ?? 0}
            icon={Users}
            colorClass="text-chart-1"
            bgClass="bg-chart-1/10"
          />
          <StatCard
            label="Escuelas"
            value={metricas.porEscuela.length}
            hint="distintas"
            icon={CalendarCheck}
            colorClass="text-chart-5"
            bgClass="bg-chart-5/10"
          />
        </div>

        {/* Por escuela — ancho completo para que quepan todos los nombres */}
        <Panel
          title="Por escuela"
          subtitle={`${metricas.porEscuela.length} escuelas distintas entre los inscritos`}
        >
          <GraficaEscuelas data={metricas.porEscuela} labelWidth={250} />
        </Panel>

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Panel title="Por grado" subtitle="Inscritos por grado (homologado)">
            <GraficaGrados data={metricas.porGrado} />
          </Panel>
          <Panel title="Por edad" subtitle="Inscritos por edad">
            <GraficaEdad data={metricas.porEdad} />
          </Panel>
        </div>

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Panel title="Por nivel escolar" subtitle="Inscritos por nivel">
            <GraficaEscuelas data={metricas.porNivel} labelWidth={120} />
          </Panel>
          <Panel title="Niñas y niños" subtitle="Distribución por género">
            <GraficaGenero data={metricas.porGenero} />
          </Panel>
          <Panel title="Por ciudad" subtitle="Procedencia de los inscritos">
            <GraficaEscuelas data={metricas.porCiudad} labelWidth={120} />
          </Panel>
        </div>
      </div>
    </div>
  );
}
