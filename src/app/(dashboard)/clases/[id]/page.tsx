import type { Metadata } from "next";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import {
  BookOpen,
  User,
  Calendar,
  FileText,
  StickyNote,
  Users,
  Pencil,
  FileDown,
  ClipboardCheck,
  ChevronRight,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { obtenerClasePorId, listarSesionesDeClase } from "@/server/queries/clases";
import { listarImagenesDeClaseConUrl } from "@/server/queries/imagenes-clase";
import { obtenerEdicionPorId } from "@/server/queries/ediciones";
import { EmptyState } from "@/components/shared/EmptyState";
import { FormTemasSesion } from "@/components/clases/FormTemasSesion";
import { ContenidoClase } from "@/components/clases/ContenidoClase";
import { formatearFecha, aISOFecha } from "@/lib/fechas";

// Ya no hay `export const dynamic = "force-dynamic"`. Existía porque las
// imágenes viajaban con URLs firmadas de caducidad corta y un HTML cacheado
// acabaría repartiendo URLs vencidas. Ahora las URLs apuntan al proxy
// autenticado y son estables, así que ese motivo desapareció. La página sigue
// renderizándose en cada petición sin necesidad de forzarlo: `auth()` lee la
// cookie de sesión, lo que ya la marca como dinámica, y de hecho tiene que
// serlo porque redirige a /login según la sesión y muestra asistencias en vivo.

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

  const [clase, sesiones, imagenes] = await Promise.all([
    obtenerClasePorId(id),
    listarSesionesDeClase(id),
    listarImagenesDeClaseConUrl(id),
  ]);

  if (!clase) notFound();

  // Fetch the edicion to get its nombre / anio for breadcrumb
  const edicion = await obtenerEdicionPorId(clase.edicionId);

  const totalAsistencias = sesiones.reduce(
    (acc, s) => acc + s._count.asistencias,
    0
  );

  // Una clase es una charla impartida en una fecha: las 12 clases reales tienen
  // exactamente una. El modelo admite varias, así que si las hay se muestran
  // todas — lo que no existe es crear fechas sueltas desde aquí.
  const fechaUnica = sesiones.length === 1 ? sesiones[0] : null;

  // Las métricas solo aportan cuando hay varias fechas. En el caso normal —una
  // clase, una charla— la fecha está en el encabezado y los asistentes en la
  // tarjeta de la fecha: repetirlos en tarjetas grandes sería ruido.
  const metricas =
    sesiones.length > 1
      ? [
          { label: "Fechas", value: sesiones.length,
            iconClass: "text-secondary-foreground", bgClass: "bg-secondary/10", icon: Calendar },
          { label: "Asistencias totales", value: totalAsistencias,
            iconClass: "text-success", bgClass: "bg-success/10", icon: Users },
          { label: "Promedio / fecha", value: Math.round(totalAsistencias / sesiones.length),
            iconClass: "text-primary", bgClass: "bg-primary/10", icon: Users },
        ]
      : [];

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
            href={edicion ? `/clases?edicion=${edicion.id}` : "/clases"}
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
              {fechaUnica && (
                <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
                  <Calendar size={13} strokeWidth={1.8} aria-hidden />
                  <time dateTime={aISOFecha(fechaUnica.fecha)}>
                    {formatearFecha(fechaUnica.fecha, "completa")}
                  </time>
                </div>
              )}
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

          {/* Actions — envuelven en pantalla chica para que no se corte "Editar" */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <a
              href={`/api/pdf/reporte-clase/${clase.id}`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-opacity hover:opacity-80 bg-muted border border-border text-primary"
            >
              <FileDown size={15} />
              Reporte PDF
            </a>
          {isBecarioOrAdmin && (
            <>
              {/* Pasar lista es sobre la clase: si tiene una sola fecha, se
                  entra directo; con varias, desde la tarjeta de cada fecha. */}
              {fechaUnica && (
                <Link
                  href={`/asistencia/${fechaUnica.id}`}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold btn-primary transition-all min-h-[44px]"
                >
                  <ClipboardCheck size={16} strokeWidth={2.2} aria-hidden />
                  Pasar lista
                </Link>
              )}
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

      </div>

      <div className="h-px bg-border animate-fade-up animate-fade-up-delay-1" />

      {/* Métricas de la clase — solo con varias fechas */}
      {metricas.length > 0 && (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 animate-fade-up animate-fade-up-delay-1">
        {metricas.map(({ label, value, iconClass, bgClass, icon: Icon }) => (
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
      )}

      {/* Contenido: descripción e imágenes de la clase */}
      <div className="animate-fade-up animate-fade-up-delay-2">
        <ContenidoClase
          claseId={clase.id}
          claseNombre={clase.nombre}
          descripcion={clase.descripcion}
          imagenes={imagenes.map((imagen) => ({
            id: imagen.id,
            url: imagen.url,
            titulo: imagen.titulo,
            mimeType: imagen.mimeType,
            tamano: imagen.tamano,
          }))}
          puedeEditarDescripcion={isAdmin}
          puedeEditarImagenes={isBecarioOrAdmin}
        />
      </div>

      {/* Fecha(s) en que se imparte la clase */}
      <div className="animate-fade-up animate-fade-up-delay-2">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {sesiones.length > 1 ? "Fechas de la clase" : "Fecha de la clase"}
          </h2>
        </div>

        {sesiones.length === 0 ? (
          <EmptyState
            message="Esta clase todavía no tiene fecha"
            detail={
              isAdmin
                ? "Sin fecha no se le puede pasar lista. Asígnasela desde Editar."
                : "Sin fecha no se le puede pasar lista. Pide al coordinador que la asigne."
            }
            action={
              isAdmin ? (
                <Link
                  href={`/clases/${clase.id}/editar`}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold btn-primary min-h-[44px]"
                >
                  <Pencil size={15} strokeWidth={2.2} aria-hidden />
                  Asignar fecha
                </Link>
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
                {/* Encabezado: fecha y acciones */}
                <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Calendar
                      size={16}
                      strokeWidth={1.8}
                      className="shrink-0 text-secondary-foreground"
                      aria-hidden
                    />
                    <div className="text-sm font-medium text-foreground">
                      <time dateTime={aISOFecha(sesion.fecha)}>
                        {formatearFecha(sesion.fecha, "completa")}
                      </time>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium bg-success/10 border border-success/30 text-success">
                      <Users size={11} strokeWidth={2} aria-hidden />
                      {sesion._count.asistencias}{" "}
                      {sesion._count.asistencias === 1 ? "asistente" : "asistentes"}
                    </span>

                    {/* Con varias fechas, cada una tiene su propio "Pasar lista":
                        arriba solo aparece cuando la clase tiene una sola. */}
                    {isBecarioOrAdmin && sesiones.length > 1 && (
                      <Link
                        href={`/asistencia/${sesion.id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors bg-primary/10 border border-primary/30 text-primary"
                      >
                        Pasar lista
                        <ChevronRight size={12} strokeWidth={2.4} aria-hidden />
                      </Link>
                    )}

                    {/* Corregir fecha, temas y notas */}
                    {isBecarioOrAdmin && (
                      <FormTemasSesion
                        sesionId={sesion.id}
                        fechaSesion={formatearFecha(sesion.fecha, "media")}
                        fechaISO={aISOFecha(sesion.fecha)}
                        temas={sesion.temas}
                        notas={sesion.notas}
                      />
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
