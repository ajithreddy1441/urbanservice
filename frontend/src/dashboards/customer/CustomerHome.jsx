import { Link } from 'react-router-dom';
import { MapPinned, Phone } from 'lucide-react';
import api from '../../services/api';
import { useFetch } from '../../hooks/useFetch';
import StatCard from '../../components/StatCard';
import StatusBadge from '../../components/StatusBadge';
import { PageSkeleton } from '../../components/Loading';
import { formatDate, formatTime, inr } from '../../utils/format';
import { mapsDirectionUrl } from '../../utils/maps';

export default function CustomerHome() {
  const { data, loading, error } = useFetch(async () => (await api.get('/api/customer/dashboard')).data.data, []);
  if (loading) return <PageSkeleton />;
  if (error) return <p className="text-sm text-rose-600">{error}</p>;
  const stats = data.stats || {};
  const current = data.current;
  const maps = current ? mapsDirectionUrl(current.latitude, current.longitude) : '';
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">Your bookings</h1>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Total orders" value={stats.total_orders || 0} />
        <StatCard label="Active orders" value={stats.active_orders || 0} />
        <StatCard label="Completed" value={stats.completed_orders || 0} />
        <StatCard label="Cancelled" value={stats.cancelled_orders || 0} />
        <StatCard label="Total spent" value={inr(stats.total_spent)} />
      </div>
      {current ? (
        <article className="rounded-[28px] bg-slate-950 p-5 text-white">
          <p className="text-xs font-bold uppercase tracking-wide text-blue-200">Current booking</p>
          <div className="mt-3 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl font-extrabold">{current.service_name}</h2>
              <p className="mt-1 text-sm text-slate-300">{current.order_number}</p>
            </div>
            <StatusBadge status={current.order_status} />
          </div>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-slate-400">Technician</dt><dd>{current.technician_name || 'Waiting for assignment'}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-400">Phone</dt><dd>{current.technician_phone || '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-400">Date</dt><dd>{formatDate(current.scheduled_date)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-400">Time</dt><dd>{formatTime(current.scheduled_time)}</dd></div>
          </dl>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <Link to={`/customer/track/${current.id}`} className="grid h-12 place-items-center rounded-2xl bg-[var(--brand)] text-sm font-bold">Track technician</Link>
            {current.technician_phone && <a href={`tel:${current.technician_phone}`} className="grid h-12 place-items-center rounded-2xl bg-white/10 text-sm font-bold"><span className="inline-flex items-center gap-1"><Phone size={16} /> Call</span></a>}
            <Link to={`/customer/orders/${current.id}`} className="grid h-12 place-items-center rounded-2xl bg-white/10 text-sm font-bold">View order</Link>
            {maps && <a href={maps} target="_blank" rel="noreferrer" className="grid h-12 place-items-center rounded-2xl bg-white text-sm font-bold text-slate-900"><span className="inline-flex items-center gap-1"><MapPinned size={16} /> Open location</span></a>}
          </div>
        </article>
      ) : <div className="rounded-3xl bg-white p-6 text-sm text-slate-500">No active booking. <Link className="font-bold text-[var(--brand)]" to="/services">Book a service</Link></div>}
    </div>
  );
}
