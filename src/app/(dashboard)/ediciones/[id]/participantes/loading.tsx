import { TableSkeleton } from "@/components/shared/LoadingSkeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function LoadingParticipantes() {
  return (
    <div className="space-y-6 pb-24">
      {/* Header skeleton */}
      <div className="flex items-start justify-between mb-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64 rounded-lg bg-muted" />
          <Skeleton className="h-4 w-40 rounded bg-muted" />
        </div>
        <Skeleton className="hidden sm:block h-11 w-40 rounded-xl bg-muted" />
      </div>

      {/* Rule skeleton */}
      <Skeleton className="h-px w-full bg-muted" />

      {/* Mini-stats skeleton */}
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="bg-card border border-border rounded-2xl p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-20 rounded bg-muted" />
              <Skeleton className="h-7 w-7 rounded-lg bg-muted" />
            </div>
            <Skeleton className="h-9 w-12 rounded bg-muted" />
          </div>
        ))}
      </div>

      {/* Search skeleton */}
      <Skeleton className="h-11 w-full rounded-lg bg-muted" />

      {/* List skeleton */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <TableSkeleton rows={6} />
      </div>
    </div>
  );
}
