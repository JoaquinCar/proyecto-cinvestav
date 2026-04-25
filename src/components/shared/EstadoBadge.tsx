type Estado = "constancia" | "en-progreso" | "inactivo";

interface EstadoBadgeProps {
  estado: Estado;
}

const config: Record<Estado, { label: string; style: React.CSSProperties }> = {
  constancia: {
    label: "Con constancia",
    style: {
      background: "oklch(0.52 0.17 152 / 0.15)",
      border: "1px solid oklch(0.52 0.17 152 / 0.4)",
      color: "oklch(0.72 0.12 152)",
    },
  },
  "en-progreso": {
    label: "En progreso",
    style: {
      background: "oklch(0.72 0.165 72 / 0.12)",
      border: "1px solid oklch(0.72 0.165 72 / 0.35)",
      color: "oklch(0.72 0.165 72)",
    },
  },
  inactivo: {
    label: "Inactivo",
    style: {
      background: "oklch(0.21 0.035 248)",
      border: "1px solid oklch(0.28 0.055 248)",
      color: "oklch(0.55 0.05 240)",
    },
  },
};

export function EstadoBadge({ estado }: EstadoBadgeProps) {
  const { label, style } = config[estado];
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium"
      style={style}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}
