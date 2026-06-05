import { Skeleton } from "@/components/ui/skeleton";

export function CardSkeleton() {
  return (
    <div className="bg-card border border-border rounded-2xl p-6 space-y-3">
      <Skeleton className="h-3 w-24 bg-muted" />
      <Skeleton className="h-10 w-16 bg-muted" />
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-12 w-full rounded-lg bg-muted"
        />
      ))}
    </div>
  );
}
