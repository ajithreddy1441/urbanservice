import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import { useFetch } from '../../hooks/useFetch';
import OrderCard from '../../components/OrderCard';
import EmptyState from '../../components/EmptyState';
import { PageSkeleton } from '../../components/Loading';

const tabs = [['', 'All'], ['active', 'Active'], ['completed', 'Completed'], ['cancelled', 'Cancelled']];

export default function TechOrders() {
  const [params, setParams] = useSearchParams();
  const bucket = params.get('bucket') || '';
  const [page] = useState(1);
  const { data, loading } = useFetch(async () => (await api.get('/api/technician/orders', { params: { bucket, page, limit: 20 } })).data.data, [bucket, page]);
  return (
    <div>
      <h1 className="text-2xl font-extrabold">Jobs</h1>
      <div className="mt-3 flex gap-2 overflow-auto">
        {tabs.map(([value, label]) => <button key={label} className={`rounded-full px-4 py-2 text-sm font-bold ${bucket === value ? 'bg-slate-900 text-white' : 'bg-white'}`} onClick={() => setParams(value ? { bucket: value } : {})}>{label}</button>)}
      </div>
      {loading ? <PageSkeleton /> : !data?.items?.length ? <div className="mt-4"><EmptyState title="No jobs in this list" /></div> : <div className="mt-4 space-y-3">{data.items.map((order) => <OrderCard key={order.id} order={order} href={`/technician/orders/${order.id}`} showTechnicianCost />)}</div>}
    </div>
  );
}
