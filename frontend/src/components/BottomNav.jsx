import { NavLink } from 'react-router-dom';

export default function BottomNav({ items }) {
  if (!items?.length) return null;
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-2 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 backdrop-blur lg:hidden">
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((item) => (
          <li key={item.label}>
            <NavLink key={item.label} to={item.to} end={item.end} className={({ isActive }) => `flex flex-col items-center gap-1 rounded-2xl py-1 text-[11px] font-bold ${isActive ? 'text-[var(--brand)]' : 'text-slate-500'}`}>
              <item.icon size={20} />
              {item.short || item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
