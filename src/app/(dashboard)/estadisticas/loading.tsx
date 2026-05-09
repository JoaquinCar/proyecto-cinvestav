import { Skeleton } from "@/components/ui/skeleton";

export default function LoadingEstadisticas() {
  return (
    <div className="space-y-8 max-w-4xl">
      <div className="space-y-2">
        <Skeleton className="h-9 w-56 rounded-lg" style={{ background: "oklch(0.20 0.035 248)" }} />
        <Skeleton className="h-4 w-64 rounded" style={{ background: "oklch(0.20 0.035 248)" }} />
      </div>
      <div className="h-0.5 rounded" style={{ background: "oklch(0.22 0.038 248)" }} />
      <div
        className="rounded-xl p-6 space-y-4"
        style={{ background: "oklch(0.18 0.032 248)", border: "1px solid oklch(0.28 0.055 248)" }}
      >
        <Skeleton className="h-4 w-40 rounded" style={{ background: "oklch(0.22 0.04 248)" }} />
        <Skeleton className="h-60 w-full rounded-lg" style={{ background: "oklch(0.22 0.04 248)" }} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="rounded-xl p-6 space-y-3"
            style={{ background: "oklch(0.18 0.032 248)", border: "1px solid oklch(0.28 0.055 248)" }}
          >
            <Skeleton className="h-4 w-40 rounded" style={{ background: "oklch(0.22 0.04 248)" }} />
            {Array.from({ length: 5 }).map((_, j) => (
              <Skeleton key={j} className="h-5 w-full rounded" style={{ background: "oklch(0.22 0.04 248)" }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
