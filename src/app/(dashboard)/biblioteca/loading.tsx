import { Skeleton } from "@/components/ui/skeleton";

function GrupoSkeleton() {
  return (
    <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-5 w-48 rounded bg-muted" />
          <Skeleton className="h-3 w-36 rounded bg-muted" />
        </div>
        <Skeleton className="h-10 w-24 rounded-xl bg-muted" />
      </div>

      <div
        className="grid gap-3"
        style={{
          gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 6.5rem), 1fr))",
        }}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="w-full aspect-square rounded-xl bg-muted" />
        ))}
      </div>
    </div>
  );
}

export default function BibliotecaLoading() {
  return (
    <div className="space-y-8 pb-16">
      <div className="flex items-start gap-4">
        <Skeleton className="w-12 h-12 rounded-xl shrink-0 bg-muted" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-44 rounded bg-muted" />
          <Skeleton className="h-4 w-60 rounded bg-muted" />
        </div>
      </div>

      <div className="h-px bg-border" />

      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <GrupoSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
