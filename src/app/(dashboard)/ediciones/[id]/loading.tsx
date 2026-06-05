import { Skeleton } from "@/components/ui/skeleton";

export default function EdicionDetalleLoading() {
  return (
    <div className="space-y-8">
      {/* Back link */}
      <Skeleton className="h-4 w-24 rounded bg-muted" />

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          {/* Large year */}
          <Skeleton className="hidden sm:block h-20 w-32 rounded-md bg-muted" />
          <div className="space-y-3">
            {/* Badge */}
            <Skeleton className="h-6 w-16 rounded-full bg-muted" />
            {/* Name */}
            <Skeleton className="h-8 w-72 rounded bg-muted" />
            {/* Date */}
            <Skeleton className="h-4 w-56 rounded bg-muted" />
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          {[80, 72, 80].map((w, i) => (
            <Skeleton
              key={i}
              className="h-9 rounded-lg bg-muted"
              style={{ width: `${w}px` }}
            />
          ))}
        </div>
      </div>

      {/* Rule */}
      <Skeleton className="h-px w-full bg-muted" />

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="bg-card border border-border rounded-2xl p-5 space-y-3"
          >
            <div className="flex items-start justify-between">
              <Skeleton className="h-3 w-20 rounded bg-muted" />
              <Skeleton className="h-8 w-8 rounded-lg bg-muted" />
            </div>
            <Skeleton className="h-12 w-16 rounded bg-muted" />
          </div>
        ))}
      </div>

      {/* Config card */}
      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <Skeleton className="h-3 w-40 rounded bg-muted" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-28 rounded bg-muted" />
              <Skeleton className="h-9 w-16 rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>

      {/* Quick links */}
      <div className="space-y-3">
        <Skeleton className="h-3 w-28 rounded bg-muted" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 px-5 py-4 bg-card border border-border rounded-2xl"
            >
              <Skeleton className="h-9 w-9 rounded-lg shrink-0 bg-muted" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-32 rounded bg-muted" />
                <Skeleton className="h-3 w-20 rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
