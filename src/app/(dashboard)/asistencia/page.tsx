import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ClipboardCheck, BookOpen, User, Calendar, ChevronRight, Users } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/server/db";
import { listarClasesConSesiones } from "@/server/queries/clases";
import { EmptyState } from "@/components/shared/EmptyState";

export const metadata: Metadata = { title: "Asistencia" };

function formatFecha(date: Date | string): string {
  return new Date(date).toLocaleDateString("es-MX", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

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
  const totalSesiones = clases.reduce((acc, c) => acc + c.sesiones.length, 0);

  return (
    <div className="space-y-8">
      <Header subtitle={`${edicion.nombre} · elige una sesión para pasar lista`} />

      {clases.length === 0 || totalSesiones === 0 ? (
        <EmptyState
          message="Sin sesiones registradas"
          detail="Crea clases y sesiones en la edición para poder pasar lista."
          action={
            <Link
              href={`/ediciones/${edicion.id}/clases`}
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl text-sm font-semibold btn-primary min-h-[44px]"
            >
              Ver clases
            </Link>
          }
        />
      ) : (
        <div className="space-y-6 animate-fade-up animate-fade-up-delay-1">
          {clases.map((clase) => (
            <section
              key={clase.id}
              className="bg-card border border-border rounded-2xl overflow-hidden"
            >
              {/* Cabecera de clase */}
              <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-primary/10">
                  <BookOpen size={17} strokeWidth={1.8} className="text-primary" aria-hidden />
                </div>
                <div className="min-w-0">
                  <h2 className="font-display text-base font-semibold text-foreground truncate">
                    {clase.nombre}
                  </h2>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground truncate">
                    <User size={11} strokeWidth={1.8} aria-hidden />
                    {clase.investigador}
                  </p>
                </div>
              </div>

              {/* Sesiones */}
              {clase.sesiones.length === 0 ? (
                <p className="px-5 py-4 text-sm text-muted-foreground italic">
                  Sin sesiones aún
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {clase.sesiones.map((s) => (
                    <li key={s.id}>
                      <Link
                        href={`/asistencia/${s.id}`}
                        className="flex items-center gap-3 px-5 py-4 min-h-[60px] transition-colors hover:bg-muted active:bg-muted"
                      >
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-secondary/15">
                          <Calendar size={16} strokeWidth={1.8} className="text-secondary-foreground" aria-hidden />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground capitalize">
                            {formatFecha(s.fecha)}
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
                        <ChevronRight size={16} strokeWidth={2} className="sm:hidden text-primary shrink-0" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
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
          {subtitle ?? "Registro de asistencias por sesión"}
        </p>
      </div>
    </div>
  );
}
