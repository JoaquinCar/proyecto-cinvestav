import { cn } from "@/lib/utils";

type Estado = "constancia" | "en-progreso" | "inactivo";

interface EstadoBadgeProps {
  estado: Estado;
}

const config: Record<Estado, { label: string; colorClass: string }> = {
  constancia: {
    label: "Con constancia",
    colorClass: "bg-success/12 text-success",
  },
  "en-progreso": {
    label: "En progreso",
    colorClass: "bg-secondary/12 text-secondary-foreground",
  },
  inactivo: {
    label: "Inactivo",
    colorClass: "bg-muted text-muted-foreground",
  },
};

export function EstadoBadge({ estado }: EstadoBadgeProps) {
  const { label, colorClass } = config[estado];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        colorClass
      )}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}
