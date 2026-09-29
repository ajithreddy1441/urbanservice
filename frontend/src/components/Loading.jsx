export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-2xl bg-slate-200/80 ${className}`} />;
}

export function PageSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
      </div>
      <Skeleton className="h-56" />
    </div>
  );
}

export function FullScreenLoader({ label = 'Loading...' }) {
  return (
    <div className="grid min-h-[50dvh] place-items-center text-sm font-semibold text-slate-500">{label}</div>
  );
}
