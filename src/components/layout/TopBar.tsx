"use client";

import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";

const routeLabels: Record<string, string> = {
  "/":              "Dashboard",
  "/ediciones":     "Ediciones",
  "/participantes": "Participantes",
  "/clases":        "Clases",
  "/asistencia":    "Control de Asistencia",
  "/estadisticas":  "Estadísticas Históricas",
};

export default function TopBar() {
  const pathname = usePathname();
  const base = "/" + pathname.split("/")[1];
  const title = routeLabels[base] ?? "Pasaporte Científico";

  return (
    <header
      className="flex items-center justify-between px-6 lg:px-8 h-14 shrink-0"
      style={{
        background: "oklch(0.14 0.028 248)",
        borderBottom: "1px solid oklch(0.20 0.04 248)",
      }}
    >
      <h2 className="text-sm font-semibold tracking-wide uppercase"
        style={{ color: "oklch(0.62 0.06 235)", letterSpacing: "0.08em" }}>
        {title}
      </h2>

      <div className="flex items-center gap-3">
        {/* Edición activa badge */}
        <span className="hidden sm:inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full"
          style={{
            background: "oklch(0.52 0.17 152 / 0.15)",
            border: "1px solid oklch(0.52 0.17 152 / 0.35)",
            color: "oklch(0.75 0.12 152)",
          }}>
          <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
          Edición 2026
        </span>

        <button
          className="p-2 rounded-lg transition-colors hover:bg-white/5"
          style={{ color: "oklch(0.62 0.06 235)" }}
          aria-label="Notificaciones"
        >
          <Bell size={18} strokeWidth={1.8} />
        </button>

        {/* Avatar placeholder */}
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold"
          style={{
            background: "oklch(0.72 0.165 72 / 0.2)",
            border: "1px solid oklch(0.72 0.165 72 / 0.4)",
            color: "oklch(0.72 0.165 72)",
          }}>
          A
        </div>
      </div>
    </header>
  );
}
