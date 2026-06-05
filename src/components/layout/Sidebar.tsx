"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { signOut } from "next-auth/react";
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
  { href: "/",             label: "Dashboard",     icon: LayoutDashboard, match: (p: string) => p === "/" },
  { href: "/ediciones",    label: "Ediciones",     icon: Layers,          match: (p: string) => p === "/ediciones" || p.startsWith("/ediciones/") && !p.includes("/clases") && !p.includes("/participantes") },
  { href: "/participantes",label: "Participantes", icon: Users,           match: (p: string) => p.startsWith("/participantes") || p.includes("/participantes") },
  { href: "/clases",       label: "Clases",        icon: BookOpen,        match: (p: string) => p.startsWith("/clases") || p.includes("/clases") },
  { href: "/asistencia",   label: "Asistencia",    icon: ClipboardCheck,  match: (p: string) => p.startsWith("/asistencia") || p.includes("/asistencia") },
  { href: "/estadisticas", label: "Estadísticas",  icon: BarChart3,       match: (p: string) => p.startsWith("/estadisticas") },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex flex-col w-60 shrink-0 bg-[var(--color-sidebar)] border-r border-sidebar-border">
      {/* Logo area */}
      <div className="px-6 py-7 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          {/* Atom icon */}
          <div className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center bg-primary/10">
            <svg width="20" height="20" viewBox="0 0 32 32" fill="none" aria-hidden className="text-primary">
              <ellipse cx="16" cy="16" rx="12" ry="5" stroke="currentColor" strokeWidth="1.8" fill="none"/>
              <ellipse cx="16" cy="16" rx="12" ry="5" stroke="currentColor" strokeWidth="1.8" fill="none"
                transform="rotate(60 16 16)"/>
              <ellipse cx="16" cy="16" rx="12" ry="5" stroke="currentColor" strokeWidth="1.8" fill="none"
                transform="rotate(120 16 16)"/>
              <circle cx="16" cy="16" r="2.5" fill="currentColor"/>
            </svg>
          </div>
          <div>
            <div className="font-display text-base font-medium leading-tight text-sidebar-foreground">
              Pasaporte
            </div>
            <div className="text-xs leading-tight text-muted-foreground">
              Científico
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-5 space-y-1">
        {navItems.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                active
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              {/* Left accent bar for active item */}
              {active && (
                <span
                  aria-hidden
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-primary"
                />
              )}
              <Icon size={17} strokeWidth={active ? 2.2 : 1.8} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-sidebar-border">
        <button
          className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut size={16} strokeWidth={1.8} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
