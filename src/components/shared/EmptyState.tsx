import { type ReactNode } from "react";

interface EmptyStateProps {
  message: string;
  detail?: string;
  action?: ReactNode;
}

export function EmptyState({ message, detail, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
        style={{ background: "oklch(0.21 0.035 248)" }}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
          <circle cx="10" cy="10" r="8" stroke="oklch(0.45 0.04 248)" strokeWidth="1.5"/>
          <path d="M10 6v4M10 13h.01" stroke="oklch(0.45 0.04 248)" strokeWidth="1.5"
            strokeLinecap="round"/>
        </svg>
      </div>
      <p className="text-sm font-medium" style={{ color: "oklch(0.68 0.05 240)" }}>
        {message}
      </p>
      {detail && (
        <p className="text-xs mt-1" style={{ color: "oklch(0.45 0.04 248)" }}>
          {detail}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
