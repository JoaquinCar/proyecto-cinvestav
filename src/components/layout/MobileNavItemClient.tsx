"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  ClipboardCheck,
  PartyPopper,
  Layers,
  Award,
} from "lucide-react";

// La barra scrollea en horizontal en vez de sacrificar entradas. A 390px caben
// cinco de 72px y asoma parte de la sexta: ese recorte es lo que delata que hay
// más a la derecha, así que las entradas llevan ancho fijo y NO `flex-1`, que
// las encogería para que cupieran todas y eliminaría la pista.
const items = [
  { href: "/",              label: "Inicio",        icon: LayoutDashboard },
  { href: "/participantes", label: "Participantes", icon: Users },
  { href: "/clases",        label: "Sesiones",      icon: BookOpen },
  { href: "/eventos",       label: "Eventos",       icon: PartyPopper },
  { href: "/asistencia",    label: "Asistencia",    icon: ClipboardCheck },
  { href: "/constancias",   label: "Constancias",   icon: Award },
  { href: "/ediciones",     label: "Ediciones",     icon: Layers },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  const activoRef = useRef<HTMLAnchorElement>(null);

  // Si la entrada activa quedó fuera de cuadro, la barra no mostraría ningún
  // resaltado y parecería que ninguna sección está abierta. Se trae a la vista
  // al cargar; `block: "nearest"` evita que la página entera salte.
  useEffect(() => {
    activoRef.current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [pathname]);

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-card border-t border-border flex items-stretch h-[4.5rem] overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      aria-label="Navegación principal"
    >
      {items.map(({ href, label, icon: Icon }) => {
        const active =
          href === "/"
            ? pathname === "/"
            : pathname === href || pathname.startsWith(href + "/") || pathname.includes(href);
        return (
          <Link
            key={href}
            href={href}
            ref={active ? activoRef : undefined}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex w-[4.5rem] shrink-0 flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors min-h-[44px]",
              active ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon size={20} strokeWidth={active ? 2.2 : 1.8} />
            <span className="w-full truncate px-0.5 text-center">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
