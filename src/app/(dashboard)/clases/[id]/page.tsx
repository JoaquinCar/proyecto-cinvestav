import type { Metadata } from "next";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  User,
  Calendar,
  FileText,
  StickyNote,
  Users,
  Pencil,
  FileDown,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { obtenerClasePorId, listarSesionesDeClase } from "@/server/queries/clases";
import { obtenerEdicionPorId } from "@/server/queries/ediciones";
import { EmptyState } from "@/components/shared/EmptyState";
import { FormSesion } from "@/components/clases/FormSesion";

// ── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const clase = await obtenerClasePorId(id);
  return {
    title: clase ? `${clase.nombre} · Pasaporte Científico` : "Clase · Pasaporte Científico",
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatFecha(date: Date | string): string {
  return new Date(date).toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatFechaCorta(date: Date | string): string {
  return new Date(date).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ClaseDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const isAdmin = session.user.role === "ADMIN";
  const isBecarioOrAdmin =
    session.user.role === "ADMIN" || session.user.role === "BECARIO";

  const { id } = await params;

  const [clase, sesiones] = await Promise.all([
    obtenerClasePorId(id),
    listarSesionesDeClase(id),
  ]);

  if (!clase) notFound();

  // Fetch the edicion to get its nombre / anio for breadcrumb
  const edicion = await obtenerEdicionPorId(clase.edicionId);

  const totalAsistencias = sesiones.reduce(
    (acc, s) => acc + s._count.asistencias,
    0
  );

  return (
    <div className="space-y-8 pb-16">
      {/* Breadcrumb / back */}
      <div className="animate-fade-up">
        <div className="flex flex-wrap items-center gap-1.5 text-sm mb-5 text-muted-foreground">
          <Link
            href={edicion ? `/ediciones/${edicion.id}` : "/ediciones"}
            className="hover:underline transition-colors text-primary"
          >
            {edicion?.nombre ?? "Ediciones"}
          </Link>
          <span aria-hidden>/</span>
          <Link
            href={edicion ? `/ediciones/${edicion.id}/clases` : "/ediciones"}
            className="hover:underline transition-colors text-primary"
          >
            Clases
          </Link>
          <span aria-hidden>/</span>
          <span className="truncate max-w-[12rem] text-secondary-foreground font-medium">
            {clase.nombre}
          </span>
        </div>

        {/* Title area */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4 min-w-0">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-secondary/10">
              <BookOpen
                size={22}
                strokeWidth={1.8}
                className="text-secondary-foreground"
                aria-hidden
              />
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-2xl sm:text-3xl font-semibold leading-snug text-foreground">
                {clase.nombre}
              </h1>
              <div className="flex items-center gap-1.5 mt-1.5 text-sm text-muted-foreground">
                <User size={13} strokeWidth={1.8} aria-hidden />
                <span>{clase.investigador}</span>
              </div>
              {edicion && (
                <div className="flex items-center gap-1.5 mt-1 text-xs">
                  <span
                    className={
                      edicion.activa
                        ? "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-secondary/10 border border-secondary/30 text-secondary-foreground"
                        : "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-muted border border-border text-muted-foreground"
                    }
                  >
                    {edicion.nombre} · {edicion.anio}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <a
              href={`/api/pdf/reporte-clase/${clase.id}`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-opacity hover:opacity-80 bg-muted border border-border text-primary"
            >
              <FileDown size={15} />
              Reporte PDF
            </a>
          {isBecarioOrAdmin && (
            <>
              <FormSesion
                claseId={clase.id}
                claseNombre={clase.nombre}
                variant="primary"
              />
              {isAdmin && (
                <Link
                  href={`/clases/${clase.id}/editar`}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium transition-colors bg-muted border border-border text-muted-foreground hover:text-foreground"
                >
                  <Pencil size={14} strokeWidth={2} aria-hidden />
                  Editar
                </Link>
              )}
            </>
          )}
          </div>
        </div>

        {/* Description */}
        {clase.descripcion && (
          <p className="mt-4 text-sm leading-relaxed max-w-2xl text-muted-foreground">
            {clase.descripcion}
          </p>
        )}
      </div>

      <div className="h-px bg-border animate-fade-up animate-fade-up-delay-1" />

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 animate-fade-up animate-fade-up-delay-1">
        {[
          {
            label: "Sesiones",
            value: sesiones.length,
            iconClass: "text-secondary-foreground",
            bgClass: "bg-secondary/10",
            icon: Calendar,
          },
          {
            label: "Asistencias totales",
            value: totalAsistencias,
            iconClass: "text-success",
            bgClass: "bg-success/10",
            icon: Users,
          },
          {
            label: "Promedio / sesión",
            value:
              sesiones.length > 0
                ? Math.round(totalAsistencias / sesiones.length)
                : "—",
            iconClass: "text-primary",
            bgClass: "bg-primary/10",
            icon: Users,
          },
        ].map(({ label, value, iconClass, bgClass, icon: Icon }) => (
          <div
            key={label}
            className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium tracking-wide uppercase text-muted-foreground">
                {label}
              </span>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${bgClass}`}>
                <Icon size={13} strokeWidth={2} className={iconClass} aria-hidden />
              </div>
            </div>
            <div className="stat-number text-4xl">{value}</div>
          </div>
        ))}
      </div>

      {/* Sesiones list */}
      <div className="animate-fade-up animate-fade-up-delay-2">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Sesiones
          </h2>
          {isBecarioOrAdmin && sesiones.length > 0 && (
            <FormSesion
              claseId={clase.id}
              claseNombre={clase.nombre}
              variant="ghost"
            />
          )}
        </div>

        {sesiones.length === 0 ? (
          <EmptyState
            message="Sin sesiones registradas"
            detail={
              isBecarioOrAdmin
                ? "Agrega la primera sesión para comenzar a registrar asistencias."
                : "Aún no se han registrado sesiones para esta clase."
            }
            action={
              isBecarioOrAdmin ? (
                <FormSesion
                  claseId={clase.id}
                  claseNombre={clase.nombre}
                  variant="primary"
                />
              ) : undefined
            }
          />
        ) : (
          <div className="space-y-3">
            {sesiones.map((sesion, i) => (
              <div
                key={sesion.id}
                className={`bg-card border border-border rounded-2xl p-5 animate-fade-up ${
                  i < 4 ? `animate-fade-up-delay-${Math.min(i + 2, 4) as 1 | 2 | 3 | 4}` : ""
                }`}
              >
                {/* Sesion header */}
                <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    {/* Session number pill */}
                    <span
                      className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold shrink-0 bg-secondary/15 text-secondary-foreground"
                      aria-label={`Sesión ${i + 1}`}
                    >
                      {i + 1}
                    </span>
                    <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                      <Calendar size={14} strokeWidth={1.8} aria-hidden />
                      <time dateTime={new Date(sesion.fecha).toISOString()}>
                        {formatFecha(sesion.fecha)}
                      </time>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Attendance badge */}
                    <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium bg-success/10 border border-success/30 text-success">
                      <Users size={11} strokeWidth={2} aria-hidden />
                      {sesion._count.asistencias}{" "}
                      {sesion._count.asistencias === 1 ? "asistente" : "asistentes"}
                    </span>

                    {/* Update temas button (BECARIO+) */}
                    {isBecarioOrAdmin && (
                      <Link
                        href={`/sesiones/${sesion.id}/temas`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors bg-muted border border-border text-muted-foreground hover:text-foreground"
                        aria-label={`Actualizar temas de la sesión del ${formatFechaCorta(sesion.fecha)}`}
                      >
                        <Pencil size={11} strokeWidth={2} aria-hidden />
                        Temas
                      </Link>
                    )}
                  </div>
                </div>

                {/* Temas & Notas */}
                {(sesion.temas || sesion.notas) ? (
                  <div className="space-y-2 mt-1">
                    {sesion.temas && (
                      <div className="flex items-start gap-2 text-sm text-muted-foreground">
                        <FileText
                          size={13}
                          strokeWidth={1.8}
                          className="mt-0.5 shrink-0 text-secondary-foreground"
                          aria-hidden
                        />
                        <div>
                          <span className="text-xs font-medium uppercase tracking-wide block mb-0.5 text-muted-foreground">
                            Temas
                          </span>
                          <p className="leading-relaxed">{sesion.temas}</p>
                        </div>
                      </div>
                    )}
                    {sesion.notas && (
                      <div className="flex items-start gap-2 text-sm text-muted-foreground">
                        <StickyNote
                          size={13}
                          strokeWidth={1.8}
                          className="mt-0.5 shrink-0 text-primary"
                          aria-hidden
                        />
                        <div>
                          <span className="text-xs font-medium uppercase tracking-wide block mb-0.5 text-muted-foreground">
                            Notas
                          </span>
                          <p className="leading-relaxed">{sesion.notas}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs italic mt-1 text-muted-foreground">
                    Sin temas ni notas registradas aún
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
