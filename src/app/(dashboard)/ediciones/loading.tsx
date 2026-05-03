import { Skeleton } from "@/components/ui/skeleton";

function EdicionCardSkeleton() {
  return (
    <div
      className="rounded-xl p-6 space-y-4"
      style={{
        background: "oklch(0.18 0.032 248)",
        border: "1px solid oklch(0.28 0.055 248)",
      }}
    >
      {/* Top row: year + badge */}
      <div className="flex items-start justify-between">
        <Skeleton
          className="h-14 w-24 rounded-md"
          style={{ background: "oklch(0.22 0.04 248)" }}
        />
        <Skeleton
          className="h-6 w-16 rounded-full"
          style={{ background: "oklch(0.22 0.04 248)" }}
        />
      </div>

      {/* Gold rule */}
      <Skeleton
        className="h-0.5 w-full rounded-full"
        style={{ background: "oklch(0.22 0.04 248)" }}
      />

      {/* Name */}
      <div className="space-y-2">
        <Skeleton
          className="h-5 w-3/4 rounded"
          style={{ background: "oklch(0.22 0.04 248)" }}
        />
        <Skeleton
          className="h-5 w-1/2 rounded"
          style={{ background: "oklch(0.22 0.04 248)" }}
        />
      </div>

      {/* Meta row */}
      <div className="flex gap-4">
        <Skeleton
          className="h-4 w-28 rounded"
          style={{ background: "oklch(0.22 0.04 248)" }}
        />
        <Skeleton
          className="h-4 w-20 rounded"
          style={{ background: "oklch(0.22 0.04 248)" }}
        />
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
          <Skeleton
            className="h-9 w-44 rounded"
            style={{ background: "oklch(0.22 0.04 248)" }}
          />
          <Skeleton
            className="h-4 w-72 rounded"
            style={{ background: "oklch(0.22 0.04 248)" }}
          />
        </div>
        <Skeleton
          className="h-10 w-36 rounded-lg"
          style={{ background: "oklch(0.22 0.04 248)" }}
        />
      </div>

      {/* Gold rule skeleton */}
      <Skeleton
        className="h-0.5 w-full rounded-full"
        style={{ background: "oklch(0.22 0.04 248)" }}
      />

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
