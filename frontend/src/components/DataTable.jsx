import EmptyState from './EmptyState';
import { Skeleton } from './Loading';

export default function DataTable({ columns, rows, loading, empty = 'No records found' }) {
  if (loading) {
    return <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>;
  }
  if (!rows?.length) return <EmptyState title={empty} />;
  return (
    <>
      <div className="hidden overflow-hidden rounded-3xl border border-slate-200 bg-white md:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>{columns.map((column) => <th key={column.key} className="px-4 py-3 font-semibold">{column.header}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.id || index} className="border-t border-slate-100">
                {columns.map((column) => (
                  <td key={column.key} className="px-4 py-3 align-middle">{column.render ? column.render(row) : row[column.key]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-3 md:hidden">
        {rows.map((row, index) => (
          <article key={row.id || index} className="rounded-3xl border border-slate-200 bg-white p-4">
            {columns.map((column) => (
              <div key={column.key} className="flex items-start justify-between gap-3 border-b border-slate-100 py-2 text-sm last:border-0">
                <span className="text-slate-500">{column.header}</span>
                <span className="text-right font-semibold">{column.render ? column.render(row) : row[column.key]}</span>
              </div>
            ))}
          </article>
        ))}
      </div>
    </>
  );
}
