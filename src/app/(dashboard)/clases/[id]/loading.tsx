import { Skeleton } from "@/components/ui/skeleton";

function SesionSkeleton() {
  return (
    <div
      className="rounded-xl p-5 space-y-4"
      style={{
        background: "oklch(0.18 0.032 248)",
        border: "1px solid oklch(0.28 0.055 248)",
      }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Skeleton
            className="w-6 h-6 rounded-full"
            style={{ background: "oklch(0.22 0.04 248)" }}
          />
          <Skeleton
            className="h-4 w-48 rounded"
            style={{ background: "oklch(0.22 0.04 248)" }}
          />
        </div>
        <Skeleton
          className="h-6 w-24 rounded-full"
          style={{ background: "oklch(0.22 0.04 248)" }}
        />
      </div>

      {/* Content lines */}
      <div className="space-y-2 pl-8">
        <Skeleton
          className="h-3 w-12 rounded"
          style={{ background: "oklch(0.22 0.04 248)" }}
        />
        <Skeleton
          className="h-4 w-full rounded"
          style={{ background: "oklch(0.22 0.04 248)" }}
        />
        <Skeleton
          className="h-4 w-3/4 rounded"
          style={{ background: "oklch(0.22 0.04 248)" }}
        />
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
          <Skeleton className="h-4 w-24 rounded" style={{ background: "oklch(0.20 0.035 248)" }} />
          <Skeleton className="h-4 w-3 rounded" style={{ background: "oklch(0.20 0.035 248)" }} />
          <Skeleton className="h-4 w-16 rounded" style={{ background: "oklch(0.20 0.035 248)" }} />
          <Skeleton className="h-4 w-3 rounded" style={{ background: "oklch(0.20 0.035 248)" }} />
          <Skeleton className="h-4 w-28 rounded" style={{ background: "oklch(0.20 0.035 248)" }} />
        </div>

        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <Skeleton
              className="w-12 h-12 rounded-xl shrink-0"
              style={{ background: "oklch(0.20 0.035 248)" }}
            />
            <div className="space-y-2">
              <Skeleton
                className="h-8 w-52 rounded"
                style={{ background: "oklch(0.20 0.035 248)" }}
              />
              <Skeleton
                className="h-4 w-36 rounded"
                style={{ background: "oklch(0.20 0.035 248)" }}
              />
              <Skeleton
                className="h-5 w-44 rounded-full"
                style={{ background: "oklch(0.20 0.035 248)" }}
              />
            </div>
          </div>
          <Skeleton
            className="h-10 w-36 rounded-lg"
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

      {/* Section header */}
      <div className="flex items-center justify-between">
        <Skeleton
          className="h-3 w-20 rounded"
          style={{ background: "oklch(0.20 0.035 248)" }}
        />
        <Skeleton
          className="h-7 w-24 rounded-lg"
          style={{ background: "oklch(0.20 0.035 248)" }}
        />
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
