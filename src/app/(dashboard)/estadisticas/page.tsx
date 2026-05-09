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
        <h1
          className="font-display text-3xl font-light"
          style={{ color: "oklch(0.96 0.01 80)" }}
        >
          Estadísticas{" "}
          <em style={{ color: "oklch(0.72 0.165 72)" }}>históricas</em>
        </h1>
        <p className="mt-1 text-sm" style={{ color: "oklch(0.62 0.06 235)" }}>
          Comparativo año con año · todas las ediciones del programa
        </p>
      </div>

      <div className="gold-rule animate-fade-up animate-fade-up-delay-1" />

      <div
        className="rounded-xl p-6 animate-fade-up animate-fade-up-delay-1"
        style={{
          background: "oklch(0.18 0.032 248)",
          border: "1px solid oklch(0.28 0.055 248)",
        }}
      >
        <h2
          className="text-sm font-semibold mb-1"
          style={{ color: "oklch(0.82 0.04 240)" }}
        >
          Crecimiento histórico
        </h2>
        <p className="text-xs mb-6" style={{ color: "oklch(0.55 0.04 240)" }}>
          Participantes y sesiones por edición
        </p>
        <GraficaHistorico data={ediciones} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-fade-up animate-fade-up-delay-2">
        <div
          className="rounded-xl p-6"
          style={{
            background: "oklch(0.18 0.032 248)",
            border: "1px solid oklch(0.28 0.055 248)",
          }}
        >
          <h2
            className="text-sm font-semibold mb-4"
            style={{ color: "oklch(0.82 0.04 240)" }}
          >
            Escuelas más constantes
          </h2>
          {escuelas.length === 0 ? (
            <p className="text-sm" style={{ color: "oklch(0.55 0.04 240)" }}>
              Sin datos — crea más de una edición
            </p>
          ) : (
            <div className="space-y-2">
              {escuelas.slice(0, 10).map((e, i) => (
                <div key={i} className="flex items-center justify-between gap-3">
                  <span
                    className="text-sm truncate"
                    style={{ color: "oklch(0.82 0.04 240)" }}
                  >
                    {e.escuela}
                  </span>
                  <span
                    className="text-xs shrink-0 px-2 py-0.5 rounded-full"
                    style={{
                      background: "oklch(0.72 0.165 72 / 0.1)",
                      color: "oklch(0.72 0.12 72)",
                    }}
                  >
                    {e.ediciones} edición{e.ediciones !== 1 ? "es" : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div
          className="rounded-xl p-6"
          style={{
            background: "oklch(0.18 0.032 248)",
            border: "1px solid oklch(0.28 0.055 248)",
          }}
        >
          <h2
            className="text-sm font-semibold mb-4"
            style={{ color: "oklch(0.82 0.04 240)" }}
          >
            Participantes recurrentes
          </h2>
          {participantes.length === 0 ? (
            <p className="text-sm" style={{ color: "oklch(0.55 0.04 240)" }}>
              Sin participantes en múltiples ediciones aún
            </p>
          ) : (
            <div className="space-y-3">
              {participantes.slice(0, 10).map((p, i) => (
                <div key={i} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p
                      className="text-sm truncate"
                      style={{ color: "oklch(0.82 0.04 240)" }}
                    >
                      {p.nombre} {p.apellidos}
                    </p>
                    <p
                      className="text-xs truncate"
                      style={{ color: "oklch(0.55 0.04 240)" }}
                    >
                      {p.escuela}
                    </p>
                  </div>
                  <span
                    className="text-xs shrink-0 px-2 py-0.5 rounded-full"
                    style={{
                      background: "oklch(0.52 0.17 152 / 0.1)",
                      color: "oklch(0.72 0.12 152)",
                    }}
                  >
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
