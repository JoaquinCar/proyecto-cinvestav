import type { Metadata } from "next";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import {
  Calendar,
  Users,
  BookOpen,
  ClipboardCheck,
  ArrowLeft,
  Pencil,
  Trash2,
  Zap,
  BarChart3,
  ChevronRight,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { obtenerEdicionPorId } from "@/server/queries/ediciones";

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Edicion · Pasaporte Cientifico" };
}

function formatDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function EdicionDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const isAdmin = session.user.role === "ADMIN";
  const { id } = await params;

  const edicion = await obtenerEdicionPorId(id);
  if (!edicion) notFound();

  const inscripciones = edicion._count?.inscripciones ?? 0;
  const clases = edicion._count?.clases ?? 0;

  const stats = [
    { label: "Participantes", value: inscripciones, icon: Users,          colorClass: "text-primary",   bgClass: "bg-primary/10"  },
    { label: "Clases",        value: clases,         icon: BookOpen,       colorClass: "text-success",   bgClass: "bg-success/10"  },
    { label: "Sesiones",      value: "—",            icon: ClipboardCheck, colorClass: "text-secondary", bgClass: "bg-secondary/10"},
  ];

  const quickLinks = [
    { href: `/ediciones/${edicion.id}/participantes`, label: "Ver participantes", icon: Users,     detail: `${inscripciones} inscritos` },
    { href: `/ediciones/${edicion.id}/clases`,        label: "Ver clases",        icon: BookOpen,  detail: `${clases} clases` },
    { href: `/ediciones/${edicion.id}/reportes`,      label: "Ver reportes",      icon: BarChart3, detail: "Asistencia y constancias" },
  ];

  return (
    <div className="space-y-8">
      <div className="animate-fade-up">
        <Link
          href="/ediciones"
          className="inline-flex items-center gap-1.5 text-sm mb-5 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={15} strokeWidth={2} aria-hidden />
          Ediciones
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4 min-w-0">
            <div
              className="stat-number shrink-0 leading-none hidden sm:block tabular"
              style={{ fontSize: "4.5rem" }}
            >
              {edicion.anio}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="sm:hidden font-display text-2xl font-semibold tabular text-foreground">
                  {edicion.anio}
                </span>
                {edicion.activa ? (
                  <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium bg-success/10 border border-success/40 text-success">
                    <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                    Activa
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium bg-muted border border-border text-muted-foreground">
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    Inactiva
                  </span>
                )}
              </div>
              <h1 className="font-display text-2xl sm:text-3xl font-semibold leading-snug text-foreground">
                {edicion.nombre}
              </h1>
              <div className="flex items-center gap-1.5 mt-2 text-sm text-muted-foreground">
                <Calendar size={14} strokeWidth={1.8} aria-hidden />
                <span>{formatDate(edicion.fechaInicio)} — {formatDate(edicion.fechaFin)}</span>
              </div>
            </div>
          </div>

          {isAdmin && (
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {!edicion.activa && (
                <form action={`/api/ediciones/${edicion.id}/activar`} method="POST">
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium bg-success/10 border border-success/40 text-success hover:bg-success/20 transition-colors min-h-[44px]"
                  >
                    <Zap size={14} strokeWidth={2} aria-hidden />
                    Activar
                  </button>
                </form>
              )}
              <Link
                href={`/ediciones/${edicion.id}/editar`}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium bg-muted border border-border text-muted-foreground hover:text-foreground transition-colors min-h-[44px]"
              >
                <Pencil size={14} strokeWidth={2} aria-hidden />
                Editar
              </Link>
              <Link
                href={`/ediciones/${edicion.id}/eliminar`}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium bg-destructive/10 border border-destructive/40 text-destructive hover:bg-destructive/20 transition-colors min-h-[44px]"
              >
                <Trash2 size={14} strokeWidth={2} aria-hidden />
                Eliminar
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="h-px bg-border animate-fade-up animate-fade-up-delay-1" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fade-up animate-fade-up-delay-2">
        {stats.map(({ label, value, icon: Icon, colorClass, bgClass }) => (
          <div key={label} className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground" style={{ letterSpacing: "0.07em" }}>{label}</p>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${bgClass}`}>
                <Icon size={16} strokeWidth={2} className={colorClass} aria-hidden />
              </div>
            </div>
            <div className="stat-number text-5xl tabular">{value}</div>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-2xl p-6 animate-fade-up animate-fade-up-delay-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide mb-4 text-muted-foreground" style={{ letterSpacing: "0.07em" }}>
          Configuracion de constancias
        </h2>
        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-y-4 gap-x-8">
          <div>
            <dt className="text-xs mb-1 text-muted-foreground">Minimo de asistencias</dt>
            <dd className="font-display text-3xl font-semibold tabular text-primary">{edicion.minAsistencias}</dd>
          </div>
          <div>
            <dt className="text-xs mb-1 text-muted-foreground">Porcentaje minimo</dt>
            <dd className="font-display text-3xl font-semibold tabular text-foreground">
              {edicion.porcentajeMinimo != null ? `${edicion.porcentajeMinimo}%` : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs mb-1 text-muted-foreground">Tipo de asistencia</dt>
            <dd className="text-sm font-medium mt-1 text-foreground">
              {edicion.asistenciaGlobal ? "Global (todas las sesiones)" : "Por clase"}
            </dd>
          </div>
        </dl>
      </div>

      <div className="animate-fade-up animate-fade-up-delay-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide mb-3 text-muted-foreground" style={{ letterSpacing: "0.07em" }}>
          Accesos rapidos
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {quickLinks.map(({ href, label, icon: Icon, detail }) => (
            <Link
              key={href}
              href={href}
              className="group flex items-center justify-between gap-3 px-5 py-4 rounded-2xl bg-card border border-border hover:border-primary/40 hover:bg-muted transition-all duration-200 min-h-[44px]"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-primary/10">
                  <Icon size={17} strokeWidth={1.8} className="text-primary" aria-hidden />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate text-foreground">{label}</p>
                  <p className="text-xs truncate text-muted-foreground">{detail}</p>
                </div>
              </div>
              <ChevronRight
                size={15} strokeWidth={2}
                className="shrink-0 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-200 text-primary"
                aria-hidden
              />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
