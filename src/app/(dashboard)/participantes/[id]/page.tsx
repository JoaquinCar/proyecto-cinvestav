import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { obtenerHistorialParticipante } from "@/server/queries/participantes";
import { EstadoBadge } from "@/components/shared/EstadoBadge";
import { BotonConstancia } from "@/components/constancias/BotonConstancia";
import {
  GraduationCap,
  School,
  Calendar,
  ArrowLeft,
  CheckCircle2,
  Circle,
} from "lucide-react";


// ── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const participante = await obtenerHistorialParticipante(id);
  if (!participante) return { title: "Participante" };
  return {
    title: `${participante.nombre} ${participante.apellidos} · Historial`,
  };
}

// ── Componente: Item de timeline ──────────────────────────────────────────────

type InscripcionTimeline = {
  id: string;
  constanciaGenerada: boolean;
  constanciaUrl?: string | null;
  edicion: {
    id: string;
    anio: number;
    nombre: string;
    activa: boolean;
    minAsistencias: number;
    porcentajeMinimo: number | null;
  };
  asistencias: { id: string }[];
};

function TimelineItem({
  inscripcion,
  isLast,
}: {
  inscripcion: InscripcionTimeline;
  isLast: boolean;
}) {
  const asistencias = inscripcion.asistencias.length;

  return (
    <div className="relative flex gap-4">
      {/* Línea vertical + ícono */}
      <div className="flex flex-col items-center">
        <div
          className={[
            "w-9 h-9 rounded-full flex items-center justify-center shrink-0 z-10 border",
            inscripcion.constanciaGenerada
              ? "bg-success/15 border-success/50"
              : "bg-secondary/10 border-secondary/35",
          ].join(" ")}
        >
          {inscripcion.constanciaGenerada ? (
            <CheckCircle2 size={17} className="text-success" />
          ) : (
            <Circle size={17} className="text-secondary" />
          )}
        </div>
        {!isLast && (
          <div className="flex-1 w-0.5 my-1 bg-border" />
        )}
      </div>

      {/* Contenido */}
      <div className="flex-1 rounded-2xl p-4 mb-4 bg-card border border-border">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-display text-lg font-medium text-foreground">
                {inscripcion.edicion.nombre}
              </span>
              {inscripcion.edicion.activa && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-success/12 border border-success/35 text-success">
                  Actual
                </span>
              )}
            </div>
            <p className="text-xs mt-1 text-muted-foreground">
              <Calendar
                size={11}
                className="inline mr-1 -mt-0.5"
              />
              <span className="tabular">{inscripcion.edicion.anio}</span>
              {asistencias > 0 && (
                <>
                  <span className="mx-1.5">·</span>
                  <span className="tabular">{asistencias}</span> asistencia{asistencias !== 1 ? "s" : ""}
                </>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {inscripcion.constanciaGenerada ? (
              <EstadoBadge estado="constancia" />
            ) : (
              <EstadoBadge estado="en-progreso" />
            )}

            <BotonConstancia
              inscripcionId={inscripcion.id}
              elegible={
                inscripcion.asistencias.length >= inscripcion.edicion.minAsistencias
              }
              asistencias={inscripcion.asistencias.length}
              minimo={inscripcion.edicion.minAsistencias}
              constanciaUrl={inscripcion.constanciaUrl}
              constanciaGenerada={inscripcion.constanciaGenerada}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ParticipanteHistorialPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id } = await params;
  const participante = await obtenerHistorialParticipante(id);

  if (!participante) notFound();

  // Ordenar inscripciones del más reciente al más antiguo
  const inscripcionesOrdenadas = [...participante.inscripciones].sort(
    (a, b) => b.edicion.anio - a.edicion.anio
  );

  const edicionActual = inscripcionesOrdenadas.find(
    (i) => i.edicion.activa
  );

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Back link */}
      <Link
        href={edicionActual ? `/ediciones/${edicionActual.edicion.id}/participantes` : "/participantes"}
        className="inline-flex items-center gap-1.5 text-sm transition-opacity hover:opacity-70 text-muted-foreground"
      >
        <ArrowLeft size={15} />
        Volver a la lista
      </Link>

      {/* Cabecera del participante */}
      <div className="animate-fade-up">
        {/* Avatar grande */}
        <div className="flex items-start gap-5">
          <div
            className="shrink-0 w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-semibold bg-secondary/10 border border-secondary/30 text-secondary-foreground"
            aria-hidden="true"
          >
            {participante.nombre.charAt(0).toUpperCase()}
            {participante.apellidos.charAt(0).toUpperCase()}
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="font-display text-3xl font-light leading-tight text-foreground">
              {participante.nombre}{" "}
              <em className="text-primary not-italic font-semibold">
                {participante.apellidos}
              </em>
            </h1>

            {/* Metadatos */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <School size={14} />
                {participante.escuela}
              </span>
              <span className="flex items-center gap-1.5">
                <GraduationCap size={14} />
                {participante.grado}
              </span>
              <span
                className="flex items-center gap-1.5"
                aria-label={`${participante.edad} años`}
              >
                <Calendar size={14} />
                <span className="tabular">{participante.edad}</span> años
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="h-px bg-border animate-fade-up animate-fade-up-delay-1" />

      {/* Estadísticas rápidas */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 animate-fade-up animate-fade-up-delay-1">
        {[
          {
            label: "Ediciones",
            value: inscripcionesOrdenadas.length,
            colorClass: "text-secondary-foreground",
          },
          {
            label: "Constancias",
            value: inscripcionesOrdenadas.filter((i) => i.constanciaGenerada).length,
            colorClass: "text-success",
          },
          {
            label: "Asistencias totales",
            value: inscripcionesOrdenadas.reduce(
              (acc, i) => acc + (i.asistencias?.length ?? 0),
              0
            ),
            colorClass: "text-primary",
          },
        ].map(({ label, value, colorClass }) => (
          <div
            key={label}
            className="rounded-2xl p-4 bg-card border border-border"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground" style={{ letterSpacing: "0.07em" }}>
              {label}
            </p>
            <p className={["stat-number text-4xl mt-2", colorClass].join(" ")}>
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Timeline de ediciones */}
      <div className="animate-fade-up animate-fade-up-delay-2">
        <h2
          className="text-sm font-semibold mb-4 uppercase tracking-wide text-muted-foreground"
          style={{ letterSpacing: "0.07em" }}
        >
          Historial de participación
        </h2>

        {inscripcionesOrdenadas.length === 0 ? (
          <div className="rounded-2xl px-4 py-8 text-center text-sm bg-card border border-border text-muted-foreground">
            Sin inscripciones registradas
          </div>
        ) : (
          <div>
            {inscripcionesOrdenadas.map((inscripcion, idx) => (
              <TimelineItem
                key={inscripcion.id}
                inscripcion={inscripcion}
                isLast={idx === inscripcionesOrdenadas.length - 1}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
