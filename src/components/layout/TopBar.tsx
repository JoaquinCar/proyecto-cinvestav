"use client";

import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

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
    <header className="flex items-center justify-between px-6 lg:px-8 h-14 shrink-0 bg-card border-b border-border">
      <h2 className="text-sm font-semibold tracking-widest uppercase text-muted-foreground">
        {title}
      </h2>

      <div className="flex items-center gap-3">
        {/* Edición activa badge */}
        <span className="hidden sm:inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-success/10 border border-success/40 text-success">
          <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
          Edición 2026
        </span>

        <button
          className="p-2 rounded-lg transition-colors text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Notificaciones"
        >
          <Bell size={18} strokeWidth={1.8} />
        </button>

        <ThemeToggle />

        {/* Avatar placeholder */}
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold bg-primary/20 border border-primary/40 text-primary">
          A
        </div>
      </div>
    </header>
  );
}
