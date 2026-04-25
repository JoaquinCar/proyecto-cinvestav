"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  ClipboardCheck,
  BarChart3,
  Layers,
  LogOut,
} from "lucide-react";

const navItems = [
  { href: "/",                    label: "Dashboard",     icon: LayoutDashboard },
  { href: "/ediciones",           label: "Ediciones",     icon: Layers },
  { href: "/participantes",       label: "Participantes", icon: Users },
  { href: "/clases",              label: "Clases",        icon: BookOpen },
  { href: "/asistencia",          label: "Asistencia",    icon: ClipboardCheck },
  { href: "/estadisticas",        label: "Estadísticas",  icon: BarChart3 },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="hidden lg:flex flex-col w-60 shrink-0 dot-grid"
      style={{
        background: "oklch(0.11 0.025 248)",
        borderRight: "1px solid oklch(0.20 0.04 248)",
      }}
    >
      {/* Logo area */}
      <div className="px-6 py-7"
        style={{ borderBottom: "1px solid oklch(0.17 0.035 248)" }}>
        <div className="flex items-center gap-3">
          {/* Atom icon */}
          <div className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: "oklch(0.72 0.165 72 / 0.15)" }}>
            <svg width="20" height="20" viewBox="0 0 32 32" fill="none" aria-hidden>
              <ellipse cx="16" cy="16" rx="12" ry="5" stroke="oklch(0.72 0.165 72)" strokeWidth="1.8" fill="none"/>
              <ellipse cx="16" cy="16" rx="12" ry="5" stroke="oklch(0.72 0.165 72)" strokeWidth="1.8" fill="none"
                transform="rotate(60 16 16)"/>
              <ellipse cx="16" cy="16" rx="12" ry="5" stroke="oklch(0.72 0.165 72)" strokeWidth="1.8" fill="none"
                transform="rotate(120 16 16)"/>
              <circle cx="16" cy="16" r="2.5" fill="oklch(0.72 0.165 72)"/>
            </svg>
          </div>
          <div>
            <div className="font-display text-base font-medium leading-tight"
              style={{ color: "oklch(0.96 0.01 80)" }}>
              Pasaporte
            </div>
            <div className="text-xs leading-tight"
              style={{ color: "oklch(0.62 0.06 235)" }}>
              Científico
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-5 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                active
                  ? "sidebar-active-item"
                  : "hover:bg-white/5"
              )}
              style={{
                color: active
                  ? "oklch(0.72 0.165 72)"
                  : "oklch(0.68 0.05 240)",
                background: active ? "oklch(0.72 0.165 72 / 0.1)" : undefined,
              }}
            >
              <Icon size={17} strokeWidth={active ? 2.2 : 1.8} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4"
        style={{ borderTop: "1px solid oklch(0.17 0.035 248)" }}>
        <button
          className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors hover:bg-white/5"
          style={{ color: "oklch(0.55 0.05 240)" }}
        >
          <LogOut size={16} strokeWidth={1.8} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
