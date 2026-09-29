import { Link, NavLink } from 'react-router-dom';
import { X } from 'lucide-react';

export default function Sidebar({ items, open, onClose }) {
  return (
    <>
      {open && <button className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden" onClick={onClose} aria-label="Close menu" />}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-[var(--ink)] text-white transition lg:static lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between px-5 py-5">
          <Link to="/" className="transition hover:opacity-80" aria-label="Urban Services home">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-200">Urban</p>
            <p className="text-lg font-extrabold">Services</p>
          </Link>
          <button className="grid h-9 w-9 place-items-center rounded-full bg-white/10 lg:hidden" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <nav className="flex-1 space-y-1 overflow-auto px-3 pb-6">
          {items.map((item) => (
            <NavLink key={item.label} to={item.to} end={item.end} onClick={onClose} className={({ isActive }) => `flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold ${isActive ? 'bg-white text-slate-900' : 'text-slate-300 hover:bg-white/10'}`}>
              <item.icon size={18} /> {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
}
