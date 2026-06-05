import { Skeleton } from "@/components/ui/skeleton";

function SesionSkeleton() {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Skeleton className="w-6 h-6 rounded-full bg-muted" />
          <Skeleton className="h-4 w-48 rounded bg-muted" />
        </div>
        <Skeleton className="h-6 w-24 rounded-full bg-muted" />
      </div>

      {/* Content lines */}
      <div className="space-y-2 pl-8">
        <Skeleton className="h-3 w-12 rounded bg-muted" />
        <Skeleton className="h-4 w-full rounded bg-muted" />
        <Skeleton className="h-4 w-3/4 rounded bg-muted" />
      </div>
    </div>
  );
}

export default function ClaseDetalleLoading() {
  return (
    <div className="space-y-8 pb-16">
      {/* Breadcrumb skeleton */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-24 rounded bg-muted" />
          <Skeleton className="h-4 w-3 rounded bg-muted" />
          <Skeleton className="h-4 w-16 rounded bg-muted" />
          <Skeleton className="h-4 w-3 rounded bg-muted" />
          <Skeleton className="h-4 w-28 rounded bg-muted" />
        </div>

        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <Skeleton className="w-12 h-12 rounded-xl shrink-0 bg-muted" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-52 rounded bg-muted" />
              <Skeleton className="h-4 w-36 rounded bg-muted" />
              <Skeleton className="h-5 w-44 rounded-full bg-muted" />
            </div>
          </div>
          <Skeleton className="h-10 w-36 rounded-xl bg-muted" />
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-border" />

      {/* Stats skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-20 rounded bg-muted" />
              <Skeleton className="h-7 w-7 rounded-lg bg-muted" />
            </div>
            <Skeleton className="h-9 w-10 rounded bg-muted" />
          </div>
        ))}
      </div>

      {/* Section header */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-20 rounded bg-muted" />
        <Skeleton className="h-7 w-24 rounded-xl bg-muted" />
      </div>

      {/* Sesiones skeleton */}
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <SesionSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
