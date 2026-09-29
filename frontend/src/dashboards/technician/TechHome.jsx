import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useFetch } from '../../hooks/useFetch';
import { useToast } from '../../context/ToastContext';
import StatCard from '../../components/StatCard';
import OrderCard from '../../components/OrderCard';
import Button from '../../components/Button';
import { PageSkeleton } from '../../components/Loading';
import { errorMessage, inr } from '../../utils/format';

export default function TechHome() {
  const { user, refreshUser } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload } = useFetch(async () => (await api.get('/api/technician/dashboard')).data.data, []);
  if (loading) return <PageSkeleton />;
  if (error) return <p className="text-sm text-rose-600">{error}</p>;
  const online = Boolean(data.technician?.is_online);
  const toggle = async () => {
    try {
      await api.patch('/api/technician/availability', { isOnline: !online, availability: !online ? 'available' : 'offline' });
      await refreshUser();
      toast(!online ? 'You are online' : 'You are offline', 'success');
      reload();
    } catch (err) { toast(errorMessage(err), 'error'); }
  };
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Today</h1>
        <Button variant={online ? 'success' : 'secondary'} onClick={toggle}>{online ? 'Online' : 'Go online'}</Button>
      </div>
      {user?.technician?.approval_status !== 'approved' && <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">Your account is {user?.technician?.approval_status}. Jobs unlock after admin approval.</p>}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Today's jobs" value={data.jobs?.todays_jobs || 0} />
        <StatCard label="Completed jobs" value={data.jobs?.completed_jobs || 0} />
        <StatCard label="Pending jobs" value={data.jobs?.pending_jobs || 0} />
        <StatCard label="Today's earnings" value={inr(data.earnings?.daily?.earnings)} />
        <StatCard label="Today's sales" value={inr(data.sales?.today_sales)} />
        <StatCard label="Weekly sales" value={inr(data.sales?.week_sales)} />
        <StatCard label="Monthly sales" value={inr(data.sales?.month_sales)} />
        <StatCard label="Yearly sales" value={inr(data.sales?.year_sales)} />
      </div>
      <div className="rounded-3xl bg-white p-4">
        <p className="text-sm text-slate-500">Today's services</p>
        <p className="text-3xl font-extrabold">{data.earnings?.daily?.jobs || 0}</p>
        <p className="mt-2 text-sm">Technician earnings {inr(data.earnings?.daily?.earnings)} · Incentive {inr(data.earnings?.daily?.incentives)} · Total {inr(data.earnings?.daily?.total)}</p>
      </div>
      <h2 className="font-extrabold">Upcoming</h2>
      {data.upcoming?.map((order) => <OrderCard key={order.id} order={order} href={`/technician/orders/${order.id}`} showTechnicianCost />)}
      {!data.upcoming?.length && <p className="text-sm text-slate-500">No upcoming jobs.</p>}
    </div>
  );
}
