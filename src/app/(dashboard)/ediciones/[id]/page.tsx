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

// ── Types ─────────────────────────────────────────────────────────────────────

interface EdicionDetalle {
  id: string;
  anio: number;
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
  minAsistencias: number;
  porcentajeMinimo: number | null;
  asistenciaGlobal: boolean;
  activa: boolean;
  createdAt: string;
  _count?: {
    inscripciones?: number;
    clases?: number;
    sesiones?: number;
  };
}

// ── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  return { title: `Edición · Pasaporte Científico` };
}

// ── Data fetching ─────────────────────────────────────────────────────────────

async function getEdicion(id: string): Promise<EdicionDetalle | null> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/ediciones/${id}`,
    { cache: "no-store" }
  );

  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Error al cargar la edición");

  const json = await res.json();
  if (json?.error) throw new Error(json.error);

  return json as EdicionDetalle;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function EdicionDetallePage({
  params,
}: {
  params: { id: string };
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const isAdmin = session.user.role === "ADMIN";

  const edicion = await getEdicion(params.id);
  if (!edicion) notFound();

  const inscripciones = edicion._count?.inscripciones ?? 0;
  const clases = edicion._count?.clases ?? 0;
  const sesiones = edicion._count?.sesiones ?? 0;

  const stats = [
    {
      label: "Participantes",
      value: inscripciones,
      icon: Users,
      color: "oklch(0.72 0.165 72)",
      bg: "oklch(0.72 0.165 72 / 0.1)",
    },
    {
      label: "Clases",
      value: clases,
      icon: BookOpen,
      color: "oklch(0.52 0.17 152)",
      bg: "oklch(0.52 0.17 152 / 0.1)",
    },
    {
      label: "Sesiones",
      value: sesiones,
      icon: ClipboardCheck,
      color: "oklch(0.64 0.12 220)",
      bg: "oklch(0.64 0.12 220 / 0.1)",
    },
  ];

  const quickLinks = [
    {
      href: `/participantes?edicion=${edicion.id}`,
      label: "Ver participantes",
      icon: Users,
      detail: `${inscripciones} inscritos`,
    },
    {
      href: `/clases?edicion=${edicion.id}`,
      label: "Ver clases",
      icon: BookOpen,
      detail: `${clases} clases`,
    },
    {
      href: `/estadisticas?edicion=${edicion.id}`,
      label: "Ver reportes",
      icon: BarChart3,
      detail: "Asistencia y constancias",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Back + Header */}
      <div className="animate-fade-up">
        <Link
          href="/ediciones"
          className="inline-flex items-center gap-1.5 text-sm mb-5 transition-colors"
          style={{ color: "oklch(0.62 0.06 235)" }}
          aria-label="Volver a Ediciones"
        >
          <ArrowLeft size={15} strokeWidth={2} aria-hidden />
          Ediciones
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          {/* Title block */}
          <div className="flex items-start gap-4 min-w-0">
            {/* Large year */}
            <div
              className="stat-number shrink-0 leading-none hidden sm:block"
              style={{ fontSize: "4.5rem" }}
              aria-label={`Año ${edicion.anio}`}
            >
              {edicion.anio}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span
                  className="sm:hidden font-display text-2xl font-light"
                  style={{ color: "oklch(0.72 0.165 72)" }}
                >
                  {edicion.anio}
                </span>
                {edicion.activa ? (
                  <span
                    className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium"
                    style={{
                      background: "oklch(0.72 0.165 72 / 0.12)",
                      border: "1px solid oklch(0.72 0.165 72 / 0.4)",
                      color: "oklch(0.72 0.165 72)",
                    }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                    Activa
                  </span>
                ) : (
                  <span
                    className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium"
                    style={{
                      background: "oklch(0.21 0.035 248)",
                      border: "1px solid oklch(0.28 0.055 248)",
                      color: "oklch(0.55 0.05 240)",
                    }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    Inactiva
                  </span>
                )}
              </div>

              <h1
                className="font-display text-2xl sm:text-3xl font-light leading-snug"
                style={{ color: "oklch(0.96 0.01 80)" }}
              >
                {edicion.nombre}
              </h1>

              <div
                className="flex items-center gap-1.5 mt-2 text-sm"
                style={{ color: "oklch(0.62 0.06 235)" }}
              >
                <Calendar size={14} strokeWidth={1.8} aria-hidden />
                <span>
                  {formatDate(edicion.fechaInicio)} — {formatDate(edicion.fechaFin)}
                </span>
              </div>
            </div>
          </div>

          {/* Admin actions */}
          {isAdmin && (
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {!edicion.activa && (
                <form action={`/api/ediciones/${edicion.id}/activar`} method="POST">
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors"
                    style={{
                      background: "oklch(0.52 0.17 152 / 0.12)",
                      border: "1px solid oklch(0.52 0.17 152 / 0.35)",
                      color: "oklch(0.72 0.12 152)",
                    }}
                    aria-label="Activar esta edición"
                  >
                    <Zap size={14} strokeWidth={2} aria-hidden />
                    Activar
                  </button>
                </form>
              )}

              <Link
                href={`/ediciones/${edicion.id}/editar`}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  background: "oklch(0.21 0.035 248)",
                  border: "1px solid oklch(0.28 0.055 248)",
                  color: "oklch(0.75 0.06 235)",
                }}
                aria-label="Editar esta edición"
              >
                <Pencil size={14} strokeWidth={2} aria-hidden />
                Editar
              </Link>

              <Link
                href={`/ediciones/${edicion.id}/eliminar`}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  background: "oklch(0.60 0.21 25 / 0.08)",
                  border: "1px solid oklch(0.60 0.21 25 / 0.3)",
                  color: "oklch(0.72 0.16 25)",
                }}
                aria-label="Eliminar esta edición"
              >
                <Trash2 size={14} strokeWidth={2} aria-hidden />
                Eliminar
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="gold-rule animate-fade-up animate-fade-up-delay-1" />

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fade-up animate-fade-up-delay-2">
        {stats.map(({ label, value, icon: Icon, color, bg }) => (
          <div
            key={label}
            className="rounded-xl p-5"
            style={{
              background: "oklch(0.18 0.032 248)",
              border: "1px solid oklch(0.28 0.055 248)",
            }}
          >
            <div className="flex items-start justify-between mb-3">
              <p
                className="text-xs font-medium uppercase tracking-wide"
                style={{ color: "oklch(0.55 0.05 240)", letterSpacing: "0.07em" }}
              >
                {label}
              </p>
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: bg }}
              >
                <Icon size={16} strokeWidth={2} style={{ color }} aria-hidden />
              </div>
            </div>
            <div className="stat-number text-5xl">{value}</div>
          </div>
        ))}
      </div>

      {/* Config info */}
      <div
        className="rounded-xl p-6 animate-fade-up animate-fade-up-delay-3"
        style={{
          background: "oklch(0.18 0.032 248)",
          border: "1px solid oklch(0.28 0.055 248)",
        }}
      >
        <h2
          className="text-sm font-semibold uppercase tracking-wide mb-4"
          style={{ color: "oklch(0.62 0.06 235)", letterSpacing: "0.07em" }}
        >
          Configuración de constancias
        </h2>
        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-y-4 gap-x-8">
          <div>
            <dt className="text-xs mb-1" style={{ color: "oklch(0.55 0.05 240)" }}>
              Mínimo de asistencias
            </dt>
            <dd
              className="font-display text-3xl font-light"
              style={{ color: "oklch(0.72 0.165 72)" }}
            >
              {edicion.minAsistencias}
            </dd>
          </div>
          <div>
            <dt className="text-xs mb-1" style={{ color: "oklch(0.55 0.05 240)" }}>
              Porcentaje mínimo
            </dt>
            <dd
              className="font-display text-3xl font-light"
              style={{ color: "oklch(0.64 0.12 220)" }}
            >
              {edicion.porcentajeMinimo != null
                ? `${edicion.porcentajeMinimo}%`
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs mb-1" style={{ color: "oklch(0.55 0.05 240)" }}>
              Tipo de asistencia
            </dt>
            <dd className="text-sm font-medium mt-1" style={{ color: "oklch(0.82 0.04 240)" }}>
              {edicion.asistenciaGlobal ? "Global (todas las sesiones)" : "Por clase"}
            </dd>
          </div>
        </dl>
      </div>

      {/* Quick links */}
      <div className="animate-fade-up animate-fade-up-delay-4">
        <h2
          className="text-sm font-semibold uppercase tracking-wide mb-3"
          style={{ color: "oklch(0.62 0.06 235)", letterSpacing: "0.07em" }}
        >
          Accesos rápidos
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {quickLinks.map(({ href, label, icon: Icon, detail }) => (
            <Link
              key={href}
              href={href}
              className="group flex items-center justify-between gap-3 px-5 py-4 rounded-xl transition-all duration-200"
              style={{
                background: "oklch(0.18 0.032 248)",
                border: "1px solid oklch(0.28 0.055 248)",
              }}
              aria-label={label}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: "oklch(0.72 0.165 72 / 0.1)" }}
                >
                  <Icon
                    size={17}
                    strokeWidth={1.8}
                    style={{ color: "oklch(0.72 0.165 72)" }}
                    aria-hidden
                  />
                </div>
                <div className="min-w-0">
                  <p
                    className="text-sm font-medium truncate"
                    style={{ color: "oklch(0.88 0.02 80)" }}
                  >
                    {label}
                  </p>
                  <p
                    className="text-xs truncate"
                    style={{ color: "oklch(0.55 0.05 240)" }}
                  >
                    {detail}
                  </p>
                </div>
              </div>
              <ChevronRight
                size={15}
                strokeWidth={2}
                className="shrink-0 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-200"
                style={{ color: "oklch(0.72 0.165 72)" }}
                aria-hidden
              />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
