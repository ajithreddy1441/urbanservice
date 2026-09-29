import { useEffect, useState } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { Bell, Menu } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import BottomNav from '../components/BottomNav';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import api from '../services/api';

function useTechnicianTracking(enabled) {
  useEffect(() => {
    if (!enabled || !navigator.geolocation) return undefined;
    const send = () => navigator.geolocation.getCurrentPosition((pos) => {
      api.post('/api/technician/location', {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      }).catch(() => {});
    });
    send();
    const timer = setInterval(send, 15000);
    return () => clearInterval(timer);
  }, [enabled]);
}

export default function DashboardLayout({ items, mobileItems, accent = 'customer' }) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const { user, logout } = useAuth();
  useTechnicianTracking(accent === 'technician' && Boolean(user?.technician?.is_online));
  const socket = useSocket();
  const navigate = useNavigate();
  const notePath = accent === 'admin' ? '/admin/notifications' : accent === 'technician' ? '/technician/notifications' : '/customer/notifications';

  const loadNotes = () => {
    const path = accent === 'admin' ? '/api/customer/notifications' : accent === 'technician' ? '/api/technician/notifications' : '/api/customer/notifications';
    if (accent === 'admin') return;
    api.get(path).then((res) => setUnread(res.data.data.unread || 0)).catch(() => {});
  };

  useEffect(() => { loadNotes(); }, [accent]);
  useEffect(() => {
    if (!socket) return undefined;
    const onNote = () => setUnread((count) => count + 1);
    socket.on('notification:new', onNote);
    return () => socket.off('notification:new', onNote);
  }, [socket]);

  return (
    <div className="min-h-dvh bg-[var(--canvas)] lg:flex">
      <Sidebar items={[...items, { to: '/logout', label: 'Logout', icon: items[0].icon, end: false }].filter((item) => item.to !== '/logout')} open={open} onClose={() => setOpen(false)} />
      <div className="min-w-0 flex-1 pb-24 lg:pb-8">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 py-3 backdrop-blur">
          <button className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-100 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu size={18} /></button>
          <p className="hidden text-sm font-bold lg:block">Hello, {user?.name?.split(' ')[0]}</p>
          <div className="flex items-center gap-2">
            <Link to={notePath} className="relative grid h-10 w-10 place-items-center rounded-2xl bg-slate-100" aria-label="Notifications">
              <Bell size={18} />
              {unread > 0 && <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">{unread}</span>}
            </Link>
            <button className="rounded-2xl px-3 py-2 text-sm font-bold text-slate-600" onClick={async () => { await logout(); navigate('/login'); }}>Log out</button>
          </div>
        </header>
        <main className="px-4 py-4 md:px-8"><Outlet /></main>
      </div>
      <BottomNav items={mobileItems} />
    </div>
  );
}
