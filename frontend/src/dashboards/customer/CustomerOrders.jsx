import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import { useFetch } from '../../hooks/useFetch';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import { PageSkeleton } from '../../components/Loading';
import Pagination from '../../components/Pagination';
import { formatDate, formatTime, inr } from '../../utils/format';

const tabs = [['', 'All'], ['active', 'Active'], ['completed', 'Completed'], ['cancelled', 'Cancelled']];

export default function CustomerOrders() {
  const [params, setParams] = useSearchParams();
  const bucket = params.get('bucket') || '';
  const [page, setPage] = useState(1);
  const { data, loading } = useFetch(async () => (await api.get('/api/customer/orders', { params: { bucket, page, limit: 8 } })).data.data, [bucket, page]);
  return (
    <div>
      <h1 className="text-2xl font-extrabold">My orders</h1>
      <div className="mt-3 flex gap-2 overflow-auto">
        {tabs.map(([value, label]) => (
          <button key={label} className={`rounded-full px-4 py-2 text-sm font-bold ${bucket === value ? 'bg-slate-900 text-white' : 'bg-white'}`} onClick={() => { setPage(1); setParams(value ? { bucket: value } : {}); }}>{label}</button>
        ))}
      </div>
      {loading ? <PageSkeleton /> : !data?.items?.length ? <div className="mt-4"><EmptyState title="No orders yet" action={<Link to="/services" className="font-bold text-[var(--brand)]">Browse services</Link>} /></div> : (
        <div className="mt-4 space-y-3">
          {data.items.map((order) => (
            <Link key={order.id} to={`/customer/orders/${order.id}`} className="hover-lift block rounded-3xl bg-white p-4">
              <div className="flex items-start justify-between"><div><p className="text-xs font-bold text-[var(--brand)]">{order.order_number}</p><h2 className="text-lg font-extrabold">{order.service_name}</h2></div><StatusBadge status={order.order_status} /></div>
              <p className="mt-2 text-sm text-slate-500">{formatDate(order.scheduled_date)} · {formatTime(order.scheduled_time)} · {inr(order.total_amount)}</p>
            </Link>
          ))}
          <Pagination page={data.page} total={data.total} limit={data.limit} onPage={setPage} />
        </div>
      )}
    </div>
  );
}
