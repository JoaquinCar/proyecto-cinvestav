import { Skeleton } from "@/components/ui/skeleton";

// ── Loading skeleton for the attendance page ──────────────────────────────────

function AsistenciaItemSkeleton() {
  return (
    <div className="flex items-center gap-4 px-4 py-4 rounded-xl bg-card border border-border">
      {/* Checkbox placeholder */}
      <Skeleton className="w-12 h-12 rounded-xl shrink-0 bg-muted" />
      {/* Text block */}
      <div className="flex-1 space-y-2 min-w-0">
        <Skeleton className="h-4 w-40 rounded bg-muted" />
        <Skeleton className="h-3 w-28 rounded bg-muted" />
      </div>
      {/* Status indicator */}
      <Skeleton className="h-6 w-20 rounded-full shrink-0 bg-muted" />
    </div>
  );
}

export default function AsistenciaLoading() {
  return (
    <div className="space-y-6 pb-20">
      {/* Breadcrumb skeleton */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-24 rounded bg-muted" />
        <Skeleton className="h-4 w-3 rounded bg-muted" />
        <Skeleton className="h-4 w-16 rounded bg-muted" />
        <Skeleton className="h-4 w-3 rounded bg-muted" />
        <Skeleton className="h-4 w-28 rounded bg-muted" />
      </div>

      {/* Header skeleton */}
      <div className="flex items-start gap-3">
        <Skeleton className="w-9 h-9 rounded-xl shrink-0 bg-muted" />
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="w-8 h-8 rounded-lg bg-muted" />
            <Skeleton className="h-8 w-52 rounded bg-muted" />
          </div>
          <Skeleton className="h-4 w-64 rounded bg-muted" />
          <Skeleton className="h-5 w-44 rounded-full bg-muted" />
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-border" />

      {/* Counter skeleton */}
      <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-card border border-border">
        <Skeleton className="h-5 w-32 rounded bg-muted" />
        <Skeleton className="h-7 w-24 rounded-full bg-muted" />
      </div>

      {/* Search skeleton */}
      <Skeleton className="h-10 w-full rounded-lg bg-muted" />

      {/* List items skeleton */}
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <AsistenciaItemSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
