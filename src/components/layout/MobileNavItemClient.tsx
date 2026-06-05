"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Layers,
  Users,
  BookOpen,
  ClipboardCheck,
} from "lucide-react";

const items = [
  { href: "/",              label: "Inicio",        icon: LayoutDashboard },
  { href: "/ediciones",     label: "Ediciones",     icon: Layers },
  { href: "/participantes", label: "Participantes", icon: Users },
  { href: "/clases",        label: "Clases",        icon: BookOpen },
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
