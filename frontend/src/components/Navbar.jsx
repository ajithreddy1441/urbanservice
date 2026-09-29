import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const links = [
  ['/services', 'Services'],
  ['/#how', 'How it works'],
  ['/#reviews', 'Reviews'],
  ['/#faq', 'FAQ'],
];

function homeFor(role) {
  if (role === 'ADMIN') return '/admin';
  if (role === 'TECHNICIAN') return '/technician';
  if (role === 'CUSTOMER') return '/customer';
  return '/login';
}

export default function Navbar() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/90 text-white backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="text-lg font-extrabold tracking-tight transition hover:opacity-80">Urban Services</Link>
        <nav className="hidden items-center gap-6 text-sm font-semibold text-slate-300 md:flex">
          {links.map(([to, label]) => <a key={to} href={to} className="transition hover:text-white">{label}</a>)}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          {user ? <Link to={homeFor(user.role)} className="rounded-full bg-white px-4 py-2 text-sm font-bold text-slate-900">Dashboard</Link> : (
            <>
              <Link to="/login" className="px-3 py-2 text-sm font-semibold">Log in</Link>
              <Link to="/services" className="rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-bold">Book now</Link>
            </>
          )}
        </div>
        <button className="grid h-10 w-10 place-items-center rounded-full bg-white/10 md:hidden" onClick={() => setOpen((v) => !v)} aria-label="Menu">
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>
      {open && (
        <div className="space-y-2 border-t border-white/10 px-4 py-4 md:hidden">
          {links.map(([to, label]) => <a key={to} href={to} onClick={() => setOpen(false)} className="block py-2 font-semibold">{label}</a>)}
          {user ? <NavLink to={homeFor(user.role)} onClick={() => setOpen(false)} className="block py-2 font-semibold">Dashboard</NavLink> : <NavLink to="/login" onClick={() => setOpen(false)} className="block py-2 font-semibold">Log in</NavLink>}
        </div>
      )}
    </header>
  );
}
