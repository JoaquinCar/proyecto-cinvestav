import { Skeleton } from "@/components/ui/skeleton";

// ── Loading skeleton for the attendance page ──────────────────────────────────

function AsistenciaItemSkeleton() {
  return (
    <div
      className="flex items-center gap-4 px-4 py-4 rounded-xl"
      style={{
        background: "oklch(0.18 0.032 248)",
        border: "1px solid oklch(0.28 0.055 248)",
      }}
    >
      {/* Checkbox placeholder */}
      <Skeleton
        className="w-12 h-12 rounded-xl shrink-0"
        style={{ background: "oklch(0.22 0.04 248)" }}
      />
      {/* Text block */}
      <div className="flex-1 space-y-2 min-w-0">
        <Skeleton
          className="h-4 w-40 rounded"
          style={{ background: "oklch(0.22 0.04 248)" }}
        />
        <Skeleton
          className="h-3 w-28 rounded"
          style={{ background: "oklch(0.20 0.035 248)" }}
        />
      </div>
      {/* Status indicator */}
      <Skeleton
        className="h-6 w-20 rounded-full shrink-0"
        style={{ background: "oklch(0.20 0.035 248)" }}
      />
    </div>
  );
}

export default function AsistenciaLoading() {
  return (
    <div className="space-y-6 pb-20">
      {/* Breadcrumb skeleton */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-24 rounded" style={{ background: "oklch(0.20 0.035 248)" }} />
        <Skeleton className="h-4 w-3 rounded"  style={{ background: "oklch(0.20 0.035 248)" }} />
        <Skeleton className="h-4 w-16 rounded" style={{ background: "oklch(0.20 0.035 248)" }} />
        <Skeleton className="h-4 w-3 rounded"  style={{ background: "oklch(0.20 0.035 248)" }} />
        <Skeleton className="h-4 w-28 rounded" style={{ background: "oklch(0.20 0.035 248)" }} />
      </div>

      {/* Header skeleton */}
      <div className="flex items-start gap-3">
        <Skeleton
          className="w-9 h-9 rounded-lg shrink-0"
          style={{ background: "oklch(0.20 0.035 248)" }}
        />
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="w-8 h-8 rounded-lg" style={{ background: "oklch(0.20 0.035 248)" }} />
            <Skeleton className="h-8 w-52 rounded"   style={{ background: "oklch(0.20 0.035 248)" }} />
          </div>
          <Skeleton className="h-4 w-64 rounded"   style={{ background: "oklch(0.20 0.035 248)" }} />
          <Skeleton className="h-5 w-44 rounded-full" style={{ background: "oklch(0.20 0.035 248)" }} />
        </div>
      </div>

      {/* Gold rule */}
      <div
        className="h-0.5 rounded"
        style={{ background: "oklch(0.22 0.038 248)" }}
      />

      {/* Counter skeleton */}
      <div
        className="flex items-center justify-between px-4 py-3 rounded-xl"
        style={{
          background: "oklch(0.18 0.032 248)",
          border: "1px solid oklch(0.28 0.055 248)",
        }}
      >
        <Skeleton className="h-5 w-32 rounded" style={{ background: "oklch(0.22 0.04 248)" }} />
        <Skeleton className="h-7 w-24 rounded-full" style={{ background: "oklch(0.22 0.04 248)" }} />
      </div>

      {/* Search skeleton */}
      <Skeleton
        className="h-10 w-full rounded-lg"
        style={{ background: "oklch(0.18 0.032 248)" }}
      />

      {/* List items skeleton */}
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <AsistenciaItemSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
