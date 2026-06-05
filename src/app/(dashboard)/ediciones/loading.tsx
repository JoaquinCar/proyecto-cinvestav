import { Skeleton } from "@/components/ui/skeleton";

function EdicionCardSkeleton() {
  return (
    <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
      {/* Top row: year + badge */}
      <div className="flex items-start justify-between">
        <Skeleton className="h-14 w-24 rounded-md bg-muted" />
        <Skeleton className="h-6 w-16 rounded-full bg-muted" />
      </div>

      {/* Rule */}
      <Skeleton className="h-px w-full bg-muted" />

      {/* Name */}
      <div className="space-y-2">
        <Skeleton className="h-5 w-3/4 rounded bg-muted" />
        <Skeleton className="h-5 w-1/2 rounded bg-muted" />
      </div>

      {/* Meta row */}
      <div className="flex gap-4">
        <Skeleton className="h-4 w-28 rounded bg-muted" />
        <Skeleton className="h-4 w-20 rounded bg-muted" />
      </div>
    </div>
  );
}

export default function EdicionesLoading() {
  return (
    <div className="space-y-8">
      {/* Header skeleton */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-9 w-44 rounded bg-muted" />
          <Skeleton className="h-4 w-72 rounded bg-muted" />
        </div>
        <Skeleton className="h-11 w-36 rounded-xl bg-muted" />
      </div>

      {/* Rule skeleton */}
      <Skeleton className="h-px w-full bg-muted" />

      {/* Cards grid */}
      <div
        className="grid gap-4"
        style={{
          gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 22rem), 1fr))",
        }}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <EdicionCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
