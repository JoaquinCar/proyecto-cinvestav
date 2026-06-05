import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  obtenerHistoricoEdiciones,
  obtenerEscuelasRecurrentes,
  obtenerParticipantesRecurrentes,
} from "@/server/queries/historico";
import { GraficaHistorico } from "@/components/dashboard/GraficaHistorico";

export const metadata: Metadata = {
  title: "Estadísticas históricas · Pasaporte Científico",
};

export default async function EstadisticasPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const [ediciones, escuelas, participantes] = await Promise.all([
    obtenerHistoricoEdiciones(),
    obtenerEscuelasRecurrentes(),
    obtenerParticipantesRecurrentes(),
  ]);

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="animate-fade-up">
        <h1 className="font-display text-3xl font-semibold text-foreground">
          Estadísticas{" "}
          <em className="text-primary not-italic font-semibold">históricas</em>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Comparativo año con año · todas las ediciones del programa
        </p>
      </div>

      <div className="h-px bg-border animate-fade-up animate-fade-up-delay-1" />

      <div className="bg-card border border-border rounded-2xl p-6 animate-fade-up animate-fade-up-delay-1">
        <h2 className="text-sm font-semibold mb-1 text-foreground">
          Crecimiento histórico
        </h2>
        <p className="text-xs mb-6 text-muted-foreground">
          Participantes y sesiones por edición
        </p>
        <GraficaHistorico data={ediciones} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-fade-up animate-fade-up-delay-2">
        <div className="bg-card border border-border rounded-2xl p-6">
          <h2 className="text-sm font-semibold mb-4 text-foreground">
            Escuelas más constantes
          </h2>
          {escuelas.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sin datos — crea más de una edición
            </p>
          ) : (
            <div className="space-y-2">
              {escuelas.slice(0, 10).map((e, i) => (
                <div key={i} className="flex items-center justify-between gap-3">
                  <span className="text-sm truncate text-foreground">
                    {e.escuela}
                  </span>
                  <span className="text-xs shrink-0 px-2 py-0.5 rounded-full bg-secondary/10 text-secondary-foreground tabular">
                    {e.ediciones} edición{e.ediciones !== 1 ? "es" : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-2xl p-6">
          <h2 className="text-sm font-semibold mb-4 text-foreground">
            Participantes recurrentes
          </h2>
          {participantes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sin participantes en múltiples ediciones aún
            </p>
          ) : (
            <div className="space-y-3">
              {participantes.slice(0, 10).map((p, i) => (
                <div key={i} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm truncate text-foreground">
                      {p.nombre} {p.apellidos}
                    </p>
                    <p className="text-xs truncate text-muted-foreground">
                      {p.escuela}
                    </p>
                  </div>
                  <span className="text-xs shrink-0 px-2 py-0.5 rounded-full bg-success/10 text-success tabular">
                    {p.ediciones} ediciones
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
