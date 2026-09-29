export default function StatCard({ label, value, hint, icon }) {
  return (
    <article className="rounded-3xl border border-white/70 bg-white p-4 shadow-[0_12px_40px_-28px_rgba(15,23,42,.8)]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        {icon && <span className="grid h-9 w-9 place-items-center rounded-2xl bg-blue-50 text-[var(--brand)]">{icon}</span>}
      </div>
      <p className="mt-3 text-2xl font-extrabold tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </article>
  );
}
