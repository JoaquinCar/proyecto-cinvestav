import { Skeleton } from "@/components/ui/skeleton";

export function CardSkeleton() {
  return (
    <div className="rounded-xl p-6 space-y-3"
      style={{
        background: "oklch(0.18 0.032 248)",
        border: "1px solid oklch(0.28 0.055 248)",
      }}>
      <Skeleton className="h-3 w-24" style={{ background: "oklch(0.22 0.04 248)" }} />
      <Skeleton className="h-10 w-16" style={{ background: "oklch(0.22 0.04 248)" }} />
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-12 w-full rounded-lg"
          style={{ background: "oklch(0.18 0.032 248)" }}
        />
      ))}
    </div>
  );
}
