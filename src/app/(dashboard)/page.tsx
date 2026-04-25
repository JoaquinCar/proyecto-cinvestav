import type { Metadata } from "next";
import { Users, ClipboardCheck, Award, BookOpen } from "lucide-react";

export const metadata: Metadata = { title: "Dashboard" };

const stats = [
  { label: "Participantes inscritos", value: "—", icon: Users,          color: "oklch(0.72 0.165 72)",  bg: "oklch(0.72 0.165 72 / 0.1)" },
  { label: "Asistencia promedio",     value: "—", icon: ClipboardCheck, color: "oklch(0.52 0.17  152)", bg: "oklch(0.52 0.17  152 / 0.1)" },
  { label: "Constancias generadas",   value: "—", icon: Award,          color: "oklch(0.64 0.12  220)", bg: "oklch(0.64 0.12  220 / 0.1)" },
  { label: "Sesiones impartidas",     value: "—", icon: BookOpen,       color: "oklch(0.55 0.15  280)", bg: "oklch(0.55 0.15  280 / 0.1)" },
];

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div className="animate-fade-up">
        <h1 className="font-display text-3xl font-light"
          style={{ color: "oklch(0.96 0.01 80)" }}>
          Resumen de la{" "}
          <em style={{ color: "oklch(0.72 0.165 72)" }}>edición activa</em>
        </h1>
        <p className="mt-1 text-sm" style={{ color: "oklch(0.62 0.06 235)" }}>
          Pasaporte Científico 2026 · CINVESTAV Unidad Mérida
        </p>
      </div>

      <div className="gold-rule animate-fade-up animate-fade-up-delay-1" />

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color, bg }, i) => (
          <div
            key={label}
            className={`animate-fade-up animate-fade-up-delay-${i + 1} rounded-xl p-6`}
            style={{
              background: "oklch(0.18 0.032 248)",
              border: "1px solid oklch(0.28 0.055 248)",
            }}
          >
            <div className="flex items-start justify-between mb-4">
              <p className="text-xs font-medium tracking-wide uppercase"
                style={{ color: "oklch(0.55 0.05 240)", letterSpacing: "0.07em" }}>
                {label}
              </p>
              <div className="w-9 h-9 rounded-lg flex items-center justify-center"
                style={{ background: bg }}>
                <Icon size={18} strokeWidth={2} style={{ color }} />
              </div>
            </div>
            <div className="stat-number text-5xl">{value}</div>
          </div>
        ))}
      </div>

      {/* Chart placeholder row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-fade-up animate-fade-up-delay-4">
        {/* Bar chart */}
        <div className="lg:col-span-2 rounded-xl p-6"
          style={{
            background: "oklch(0.18 0.032 248)",
            border: "1px solid oklch(0.28 0.055 248)",
          }}>
          <h3 className="text-sm font-semibold mb-1"
            style={{ color: "oklch(0.82 0.04 240)" }}>
            Asistencia por clase
          </h3>
          <p className="text-xs mb-6" style={{ color: "oklch(0.55 0.04 240)" }}>
            Porcentaje de asistencia acumulada por materia
          </p>
          <div className="h-48 flex items-end justify-center"
            style={{ color: "oklch(0.35 0.04 248)" }}>
            <span className="text-sm">Gráfica disponible al registrar sesiones</span>
          </div>
        </div>

        {/* Pie chart */}
        <div className="rounded-xl p-6"
          style={{
            background: "oklch(0.18 0.032 248)",
            border: "1px solid oklch(0.28 0.055 248)",
          }}>
          <h3 className="text-sm font-semibold mb-1"
            style={{ color: "oklch(0.82 0.04 240)" }}>
            Participación por escuela
          </h3>
          <p className="text-xs mb-6" style={{ color: "oklch(0.55 0.04 240)" }}>
            Distribución de inscritos
          </p>
          <div className="h-48 flex items-center justify-center"
            style={{ color: "oklch(0.35 0.04 248)" }}>
            <span className="text-sm">Sin datos aún</span>
          </div>
        </div>
      </div>

      {/* Recent activity placeholder */}
      <div className="rounded-xl p-6 animate-fade-up animate-fade-up-delay-4"
        style={{
          background: "oklch(0.18 0.032 248)",
          border: "1px solid oklch(0.28 0.055 248)",
        }}>
        <h3 className="text-sm font-semibold mb-4"
          style={{ color: "oklch(0.82 0.04 240)" }}>
          Actividad reciente
        </h3>
        <div className="flex items-center justify-center h-20"
          style={{ color: "oklch(0.35 0.04 248)" }}>
          <span className="text-sm">No hay actividad registrada</span>
        </div>
      </div>
    </div>
  );
}
