import { Skeleton } from "@/components/ui/skeleton";

export default function LoadingEstadisticas() {
  return (
    <div className="space-y-8 max-w-4xl">
      <div className="space-y-2">
        <Skeleton className="h-9 w-56 rounded-lg" />
        <Skeleton className="h-4 w-64 rounded" />
      </div>
      <div className="h-px bg-border rounded" />
      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <Skeleton className="h-4 w-40 rounded" />
        <Skeleton className="h-60 w-full rounded-lg" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="bg-card border border-border rounded-2xl p-6 space-y-3"
          >
            <Skeleton className="h-4 w-40 rounded" />
            {Array.from({ length: 5 }).map((_, j) => (
              <Skeleton key={j} className="h-5 w-full rounded" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
