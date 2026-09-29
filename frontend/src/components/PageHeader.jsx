export default function PageHeader({ title, text, action }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        {text && <p className="mt-1 text-sm text-slate-500">{text}</p>}
      </div>
      {action}
    </div>
  );
}
