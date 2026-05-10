import { Skeleton } from "@/components/ui/skeleton";

export default function EdicionDetalleLoading() {
  return (
    <div className="space-y-8">
      {/* Back link */}
      <Skeleton
        className="h-4 w-24 rounded"
        style={{ background: "oklch(0.22 0.04 248)" }}
      />

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          {/* Large year */}
          <Skeleton
            className="hidden sm:block h-20 w-32 rounded-md"
            style={{ background: "oklch(0.22 0.04 248)" }}
          />
          <div className="space-y-3">
            {/* Badge */}
            <Skeleton
              className="h-6 w-16 rounded-full"
              style={{ background: "oklch(0.22 0.04 248)" }}
            />
            {/* Name */}
            <Skeleton
              className="h-8 w-72 rounded"
              style={{ background: "oklch(0.22 0.04 248)" }}
            />
            {/* Date */}
            <Skeleton
              className="h-4 w-56 rounded"
              style={{ background: "oklch(0.22 0.04 248)" }}
            />
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          {[80, 72, 80].map((w, i) => (
            <Skeleton
              key={i}
              className={`h-9 w-${w} rounded-lg`}
              style={{ background: "oklch(0.22 0.04 248)", width: `${w}px` }}
            />
          ))}
        </div>
      </div>

      {/* Gold rule */}
      <Skeleton
        className="h-0.5 w-full rounded-full"
        style={{ background: "oklch(0.22 0.04 248)" }}
      />

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl p-5 space-y-3"
            style={{
              background: "oklch(0.18 0.032 248)",
              border: "1px solid oklch(0.28 0.055 248)",
            }}
          >
            <div className="flex items-start justify-between">
              <Skeleton
                className="h-3 w-20 rounded"
                style={{ background: "oklch(0.22 0.04 248)" }}
              />
              <Skeleton
                className="h-8 w-8 rounded-lg"
                style={{ background: "oklch(0.22 0.04 248)" }}
              />
            </div>
            <Skeleton
              className="h-12 w-16 rounded"
              style={{ background: "oklch(0.22 0.04 248)" }}
            />
          </div>
        ))}
      </div>

      {/* Config card */}
      <div
        className="rounded-xl p-6 space-y-4"
        style={{
          background: "oklch(0.18 0.032 248)",
          border: "1px solid oklch(0.28 0.055 248)",
        }}
      >
        <Skeleton
          className="h-3 w-40 rounded"
          style={{ background: "oklch(0.22 0.04 248)" }}
        />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton
                className="h-3 w-28 rounded"
                style={{ background: "oklch(0.22 0.04 248)" }}
              />
              <Skeleton
                className="h-9 w-16 rounded"
                style={{ background: "oklch(0.22 0.04 248)" }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Quick links */}
      <div className="space-y-3">
        <Skeleton
          className="h-3 w-28 rounded"
          style={{ background: "oklch(0.22 0.04 248)" }}
        />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 px-5 py-4 rounded-xl"
              style={{
                background: "oklch(0.18 0.032 248)",
                border: "1px solid oklch(0.28 0.055 248)",
              }}
            >
              <Skeleton
                className="h-9 w-9 rounded-lg shrink-0"
                style={{ background: "oklch(0.22 0.04 248)" }}
              />
              <div className="space-y-2 flex-1">
                <Skeleton
                  className="h-4 w-32 rounded"
                  style={{ background: "oklch(0.22 0.04 248)" }}
                />
                <Skeleton
                  className="h-3 w-20 rounded"
                  style={{ background: "oklch(0.22 0.04 248)" }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
