"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  ClipboardCheck,
  PartyPopper,
} from "lucide-react";

// Cinco entradas es el máximo que cabe a 390px con la etiqueta legible. Al
// entrar "Eventos" salió "Ediciones": es la que menos se toca desde el teléfono
// —se usa al abrir el año, no en campo— y sigue estando en la barra lateral y a
// un toque desde Inicio. Lo que se usa con el pulgar en el patio es participantes,
// sesiones, eventos y asistencia, y eso es lo que queda.
const items = [
  { href: "/",              label: "Inicio",        icon: LayoutDashboard },
  { href: "/participantes", label: "Participantes", icon: Users },
  { href: "/clases",        label: "Sesiones",      icon: BookOpen },
  { href: "/eventos",       label: "Eventos",       icon: PartyPopper },
  { href: "/asistencia",    label: "Asistencia",    icon: ClipboardCheck },
];

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-card border-t border-border flex items-stretch h-[4.5rem]">
      {items.map(({ href, label, icon: Icon }) => {
        const active =
          href === "/"
            ? pathname === "/"
            : pathname === href || pathname.startsWith(href + "/") || pathname.includes(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors min-h-[44px]",
              active ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon size={22} strokeWidth={active ? 2.2 : 1.8} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
