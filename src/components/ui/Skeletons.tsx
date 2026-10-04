export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="glass overflow-hidden rounded-[var(--radius-glass)]">
          <div className="skeleton aspect-[16/10]" />
          <div className="space-y-3 p-4">
            <div className="skeleton h-5 w-2/3 rounded" />
            <div className="skeleton h-4 w-1/3 rounded" />
            <div className="skeleton h-4 w-full rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
