import { Skeleton } from "@/components/ui/skeleton";

function ClaseCardSkeleton() {
  return (
    <div
      className="rounded-xl p-5 space-y-4"
      style={{
        background: "oklch(0.18 0.032 248)",
        border: "1px solid oklch(0.28 0.055 248)",
      }}
    >
      {/* Top row: icon + title + arrow */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Skeleton
            className="w-9 h-9 rounded-lg shrink-0"
            style={{ background: "oklch(0.22 0.04 248)" }}
          />
          <div className="space-y-2">
            <Skeleton
              className="h-4 w-36 rounded"
              style={{ background: "oklch(0.22 0.04 248)" }}
            />
            <Skeleton
              className="h-3 w-24 rounded"
              style={{ background: "oklch(0.22 0.04 248)" }}
            />
          </div>
        </div>
      </div>

      {/* Gold rule */}
      <Skeleton
        className="h-0.5 w-full rounded-full"
        style={{ background: "oklch(0.22 0.04 248)" }}
      />

      {/* Badges */}
      <div className="flex gap-2">
        <Skeleton
          className="h-6 w-20 rounded-full"
          style={{ background: "oklch(0.22 0.04 248)" }}
        />
        <Skeleton
          className="h-6 w-24 rounded-full"
          style={{ background: "oklch(0.22 0.04 248)" }}
        />
      </div>
    </div>
  );
}

export default function ClasesLoading() {
  return (
    <div className="space-y-8 pb-16">
      {/* Header skeleton */}
      <div className="space-y-4">
        <Skeleton
          className="h-4 w-32 rounded"
          style={{ background: "oklch(0.20 0.035 248)" }}
        />
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <Skeleton
              className="h-8 w-24 rounded"
              style={{ background: "oklch(0.20 0.035 248)" }}
            />
            <Skeleton
              className="h-4 w-56 rounded"
              style={{ background: "oklch(0.20 0.035 248)" }}
            />
          </div>
          <Skeleton
            className="h-10 w-32 rounded-lg"
            style={{ background: "oklch(0.20 0.035 248)" }}
          />
        </div>
      </div>

      {/* Gold rule */}
      <div
        className="h-0.5 rounded"
        style={{ background: "oklch(0.22 0.038 248)" }}
      />

      {/* Stats skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-xl p-4 space-y-3"
            style={{
              background: "oklch(0.18 0.032 248)",
              border: "1px solid oklch(0.28 0.055 248)",
            }}
          >
            <div className="flex items-center justify-between">
              <Skeleton
                className="h-3 w-20 rounded"
                style={{ background: "oklch(0.22 0.04 248)" }}
              />
              <Skeleton
                className="h-7 w-7 rounded-lg"
                style={{ background: "oklch(0.22 0.04 248)" }}
              />
            </div>
            <Skeleton
              className="h-9 w-10 rounded"
              style={{ background: "oklch(0.22 0.04 248)" }}
            />
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
