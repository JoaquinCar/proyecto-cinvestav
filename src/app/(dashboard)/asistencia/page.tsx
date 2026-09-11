import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ClipboardCheck, BookOpen, User, Calendar, ChevronRight, Users } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/server/db";
import { listarClasesConSesiones } from "@/server/queries/clases";
import { EmptyState } from "@/components/shared/EmptyState";
import { formatearFecha } from "@/lib/fechas";

export const metadata: Metadata = { title: "Asistencia" };

// Se pasa lista por CLASE, no por "sesión". Una clase es la charla que se
// imparte en una fecha: en producción las 12 tienen exactamente una. Por eso
// esta pantalla es una lista de clases y entrar en una lleva directo a pasar
// lista. El modelo sigue permitiendo varias fechas por clase; cuando las hay,
// se listan bajo la clase en vez de esconderlas.

export default async function AsistenciaHubPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const edicion = await prisma.edicion.findFirst({ where: { activa: true } });

  if (!edicion) {
    return (
      <div className="space-y-8">
        <Header />
        <EmptyState
          message="No hay edición activa"
          detail="Activa una edición para poder registrar asistencias."
          action={
            <Link
              href="/ediciones"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl text-sm font-semibold btn-primary min-h-[44px]"
            >
              Ir a ediciones
            </Link>
          }
        />
      </div>
    );
  }

  const clases = await listarClasesConSesiones(edicion.id);

  return (
    <div className="space-y-8">
      <Header subtitle={`${edicion.nombre} · elige una clase para pasar lista`} />

      {clases.length === 0 ? (
        <EmptyState
          message="Sin clases registradas"
          detail="Crea una clase en la edición para poder pasar lista."
          action={
            <Link
              href={`/clases?edicion=${edicion.id}`}
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl text-sm font-semibold btn-primary min-h-[44px]"
            >
              Ver clases
            </Link>
          }
        />
      ) : (
        <ul className="space-y-3 animate-fade-up animate-fade-up-delay-1">
          {clases.map((clase) => {
            const fechaUnica = clase.sesiones.length === 1 ? clase.sesiones[0] : null;

            // Caso normal: una clase, una fecha → toda la tarjeta es el enlace
            // para pasar lista, sin pasos intermedios.
            if (fechaUnica) {
              return (
                <li key={clase.id}>
                  <Link
                    href={`/asistencia/${fechaUnica.id}`}
                    className="flex items-center gap-3 bg-card border border-border rounded-2xl px-4 py-4 min-h-[72px] transition-colors hover:bg-muted active:bg-muted"
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-primary/10">
                      <BookOpen size={18} strokeWidth={1.8} className="text-primary" aria-hidden />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="font-display text-sm sm:text-base font-semibold text-foreground line-clamp-2">
                        {clase.nombre}
                      </p>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground truncate mt-0.5">
                        <User size={11} strokeWidth={1.8} aria-hidden />
                        {clase.investigador}
                      </p>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5 first-letter:uppercase">
                        <Calendar size={11} strokeWidth={1.8} aria-hidden />
                        {formatearFecha(fechaUnica.fecha, "diaSemana")}
                      </p>
                    </div>

                    <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium bg-success/10 text-success shrink-0 tabular">
                      <Users size={11} strokeWidth={2} aria-hidden />
                      {fechaUnica._count.asistencias}
                    </span>
                    <span className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold text-primary shrink-0">
                      Pasar lista
                      <ChevronRight size={14} strokeWidth={2.2} aria-hidden />
                    </span>
                    <ChevronRight
                      size={16}
                      strokeWidth={2}
                      className="sm:hidden text-primary shrink-0"
                      aria-hidden
                    />
                  </Link>
                </li>
              );
            }

            // Casos raros: la clase no tiene fecha, o tiene varias. No se
            // esconden — se muestran tal cual, con sus fechas.
            return (
              <li
                key={clase.id}
                className="bg-card border border-border rounded-2xl overflow-hidden"
              >
                <div className="flex items-center gap-3 px-4 py-4 border-b border-border">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-primary/10">
                    <BookOpen size={18} strokeWidth={1.8} className="text-primary" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-display text-sm sm:text-base font-semibold text-foreground line-clamp-2">
                      {clase.nombre}
                    </h2>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground truncate mt-0.5">
                      <User size={11} strokeWidth={1.8} aria-hidden />
                      {clase.investigador}
                    </p>
                  </div>
                </div>

                {clase.sesiones.length === 0 ? (
                  <p className="px-4 py-4 text-sm text-muted-foreground italic">
                    Sin fecha asignada: asígnala desde la clase para poder pasar lista
                  </p>
                ) : (
                  <ul className="divide-y divide-border">
                    {clase.sesiones.map((s) => (
                      <li key={s.id}>
                        <Link
                          href={`/asistencia/${s.id}`}
                          className="flex items-center gap-3 px-4 py-4 min-h-[60px] transition-colors hover:bg-muted active:bg-muted"
                        >
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-secondary/15">
                            <Calendar
                              size={16}
                              strokeWidth={1.8}
                              className="text-secondary-foreground"
                              aria-hidden
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground first-letter:uppercase">
                              {formatearFecha(s.fecha, "diaSemana")}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {s.temas || "Sin tema registrado"}
                            </p>
                          </div>
                          <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium bg-success/10 text-success shrink-0 tabular">
                            <Users size={11} strokeWidth={2} aria-hidden />
                            {s._count.asistencias}
                          </span>
                          <span className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold text-primary shrink-0">
                            Pasar lista
                            <ChevronRight size={14} strokeWidth={2.2} aria-hidden />
                          </span>
                          <ChevronRight
                            size={16}
                            strokeWidth={2}
                            className="sm:hidden text-primary shrink-0"
                            aria-hidden
                          />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Header({ subtitle }: { subtitle?: string }) {
  return (
    <div className="animate-fade-up flex items-center gap-3">
      <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-primary/10">
        <ClipboardCheck size={22} strokeWidth={1.8} className="text-primary" aria-hidden />
      </div>
      <div>
        <h1 className="font-display text-3xl font-semibold text-foreground">Asistencia</h1>
        <p className="text-sm text-muted-foreground">
          {subtitle ?? "Registro de asistencias por clase"}
        </p>
      </div>
    </div>
  );
}
