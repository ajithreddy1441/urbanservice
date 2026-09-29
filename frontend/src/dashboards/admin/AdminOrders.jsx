import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { useFetch } from '../../hooks/useFetch';
import PageHeader from '../../components/PageHeader';
import DataTable from '../../components/DataTable';
import StatusBadge from '../../components/StatusBadge';
import Pagination from '../../components/Pagination';
import { inputClass } from '../../components/Field';
import { inr } from '../../utils/format';

export default function AdminOrders() {
  const [filters, setFilters] = useState({ search: '', status: '', payment: '', from: '', to: '', page: 1 });
  const { data, loading } = useFetch(async () => (await api.get('/api/admin/orders', { params: { ...filters, limit: 10 } })).data.data, [JSON.stringify(filters)]);
  const set = (key) => (e) => setFilters({ ...filters, [key]: e.target.value, page: 1 });
  return (
    <div>
      <PageHeader title="Orders" text="Search, filter, and assign technicians." />
      <div className="mb-4 grid gap-2 md:grid-cols-5">
        <input className={inputClass} placeholder="Search" value={filters.search} onChange={set('search')} />
        <select className={inputClass} value={filters.status} onChange={set('status')}>
          <option value="">All statuses</option>
          {['confirmed','assigned','accepted','on_the_way','arrived','service_started','service_completed','payment_completed','cancelled'].map((status) => <option key={status}>{status}</option>)}
        </select>
        <select className={inputClass} value={filters.payment} onChange={set('payment')}><option value="">Payment</option><option>unpaid</option><option>paid</option><option>refunded</option></select>
        <input type="date" className={inputClass} value={filters.from} onChange={set('from')} />
        <input type="date" className={inputClass} value={filters.to} onChange={set('to')} />
      </div>
      <DataTable loading={loading} rows={data?.items || []} empty="No orders found" columns={[
        { key: 'order', header: 'Order', render: (row) => <Link className="font-bold text-[var(--brand)]" to={`/admin/orders/${row.id}`}>{row.order_number}</Link> },
        { key: 'customer', header: 'Customer', render: (row) => row.customer_name },
        { key: 'service', header: 'Service', render: (row) => row.service_name },
        { key: 'tech', header: 'Technician', render: (row) => row.technician_name || 'Unassigned' },
        { key: 'date', header: 'Date', render: (row) => String(row.scheduled_date).slice(0, 10) },
        { key: 'amount', header: 'Amount', render: (row) => inr(row.total_amount) },
        { key: 'cost', header: 'Technician cost', render: (row) => inr(row.technician_cost) },
        { key: 'margin', header: 'Admin revenue', render: (row) => inr(row.admin_margin) },
        { key: 'pay', header: 'Payment', render: (row) => <StatusBadge status={row.payment_status} /> },
        { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.order_status} /> },
      ]} />
      <Pagination page={data?.page || 1} total={data?.total || 0} limit={data?.limit || 10} onPage={(page) => setFilters({ ...filters, page })} />
    </div>
  );
}
