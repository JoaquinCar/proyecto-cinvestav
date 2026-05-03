import { TableSkeleton, CardSkeleton } from "@/components/shared/LoadingSkeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function LoadingParticipantes() {
  return (
    <div className="space-y-6 pb-24">
      {/* Header skeleton */}
      <div className="flex items-start justify-between mb-6">
        <div className="space-y-2">
          <Skeleton
            className="h-8 w-64 rounded-lg"
            style={{ background: "oklch(0.20 0.035 248)" }}
          />
          <Skeleton
            className="h-4 w-40 rounded"
            style={{ background: "oklch(0.20 0.035 248)" }}
          />
        </div>
        <Skeleton
          className="hidden sm:block h-9 w-40 rounded-lg"
          style={{ background: "oklch(0.20 0.035 248)" }}
        />
      </div>

      {/* Gold rule skeleton */}
      <div
        className="h-0.5 rounded"
        style={{ background: "oklch(0.22 0.038 248)" }}
      />

      {/* Mini-stats skeleton */}
      <div className="grid grid-cols-3 gap-3">
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
              className="h-9 w-12 rounded"
              style={{ background: "oklch(0.22 0.04 248)" }}
            />
          </div>
        ))}
      </div>

      {/* Search skeleton */}
      <Skeleton
        className="h-11 w-full rounded-lg"
        style={{ background: "oklch(0.18 0.032 248)" }}
      />

      {/* List skeleton */}
      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: "oklch(0.18 0.032 248)",
          border: "1px solid oklch(0.28 0.055 248)",
        }}
      >
        <TableSkeleton rows={6} />
      </div>
    </div>
  );
}
