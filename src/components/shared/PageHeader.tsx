import { type ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="font-display text-3xl font-light"
          style={{ color: "oklch(0.96 0.01 80)" }}>
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-sm" style={{ color: "oklch(0.62 0.06 235)" }}>
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="ml-4 shrink-0">{action}</div>}
    </div>
  );
}
