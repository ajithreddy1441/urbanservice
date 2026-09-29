import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import api from '../../services/api';
import { useSocket } from '../../context/SocketContext';
import StatCard from '../../components/StatCard';
import SalesChart from '../../components/SalesChart';
import StatusBadge from '../../components/StatusBadge';
import { PageSkeleton } from '../../components/Loading';
import { inr } from '../../utils/format';

export default function AdminHome() {
  const socket = useSocket();
  const [data, setData] = useState(null);
  const load = () => api.get('/api/admin/dashboard').then((res) => setData(res.data.data));
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!socket) return undefined;
    socket.on('order:created', load);
    socket.on('order:updated', load);
    return () => { socket.off('order:created', load); socket.off('order:updated', load); };
  }, [socket]);
  if (!data) return <PageSkeleton />;
  const cards = data.cards || {};
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">Overview</h1>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="Today's sales" value={inr(cards.today_sales)} />
        <StatCard label="Weekly sales" value={inr(cards.week_sales)} />
        <StatCard label="Monthly sales" value={inr(cards.month_sales)} />
        <StatCard label="Yearly sales" value={inr(cards.year_sales)} />
        <StatCard label="Today's orders" value={cards.today_orders || 0} />
        <StatCard label="Pending orders" value={cards.pending_orders || 0} />
        <StatCard label="Completed orders" value={cards.completed_orders || 0} />
        <StatCard label="Cancelled orders" value={cards.cancelled_orders || 0} />
        <StatCard label="Total customers" value={cards.total_customers || 0} />
        <StatCard label="Active technicians" value={cards.active_technicians || 0} />
        <StatCard label="Total technicians" value={cards.total_technicians || 0} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-3xl bg-white p-4"><h2 className="mb-2 font-extrabold">Daily sales</h2><SalesChart data={data.daily || []} kind="line" /></section>
        <section className="rounded-3xl bg-white p-4"><h2 className="mb-2 font-extrabold">Monthly sales</h2><SalesChart data={data.monthly || []} /></section>
      </div>
      <section className="rounded-3xl bg-white p-4">
        <h2 className="mb-2 font-extrabold">Orders by status</h2>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data.byStatus || []} dataKey="count" nameKey="status" innerRadius={50} outerRadius={80}>
                {(data.byStatus || []).map((entry) => <Cell key={entry.status} fill={entry.status.includes('cancel') ? '#dc2626' : '#2563eb'} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </section>
      <section>
        <div className="mb-2 flex items-center justify-between"><h2 className="font-extrabold">Recent orders</h2><Link to="/admin/orders" className="text-sm font-bold text-[var(--brand)]">Manage</Link></div>
        <div className="space-y-2">
          {(data.recent || []).map((order) => (
            <Link key={order.id} to={`/admin/orders/${order.id}`} className="flex items-center justify-between rounded-2xl bg-white px-4 py-3">
              <div><p className="font-bold">{order.order_number}</p><p className="text-sm text-slate-500">{order.customer_name} · {order.service_name}</p></div>
              <StatusBadge status={order.order_status} />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
