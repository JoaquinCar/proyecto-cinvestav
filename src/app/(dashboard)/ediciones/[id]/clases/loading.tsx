import { Skeleton } from "@/components/ui/skeleton";

function ClaseCardSkeleton() {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
      {/* Top row: icon + title + arrow */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Skeleton className="w-9 h-9 rounded-lg shrink-0 bg-muted" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-36 rounded bg-muted" />
            <Skeleton className="h-3 w-24 rounded bg-muted" />
          </div>
        </div>
      </div>

      {/* Rule */}
      <Skeleton className="h-px w-full bg-muted" />

      {/* Badges */}
      <div className="flex gap-2">
        <Skeleton className="h-6 w-20 rounded-full bg-muted" />
        <Skeleton className="h-6 w-24 rounded-full bg-muted" />
      </div>
    </div>
  );
}

export default function ClasesLoading() {
  return (
    <div className="space-y-8 pb-16">
      {/* Header skeleton */}
      <div className="space-y-4">
        <Skeleton className="h-4 w-32 rounded bg-muted" />
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-24 rounded bg-muted" />
            <Skeleton className="h-4 w-56 rounded bg-muted" />
          </div>
          <Skeleton className="h-11 w-32 rounded-xl bg-muted" />
        </div>
      </div>

      {/* Rule */}
      <Skeleton className="h-px w-full bg-muted" />

      {/* Stats skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="bg-card border border-border rounded-2xl p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-20 rounded bg-muted" />
              <Skeleton className="h-7 w-7 rounded-lg bg-muted" />
            </div>
            <Skeleton className="h-9 w-10 rounded bg-muted" />
          </div>
        ))}
      </div>

      {/* Cards grid */}
      <div
        className="grid gap-4"
        style={{
          gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 20rem), 1fr))",
        }}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <ClaseCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
