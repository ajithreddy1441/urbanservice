export default function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export const inputClass = 'h-12 w-full rounded-2xl border border-slate-200 bg-white px-3.5 text-sm outline-none transition focus:border-[var(--brand)] focus:ring-4 focus:ring-blue-100';
export const areaClass = 'min-h-28 w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none transition focus:border-[var(--brand)] focus:ring-4 focus:ring-blue-100';
