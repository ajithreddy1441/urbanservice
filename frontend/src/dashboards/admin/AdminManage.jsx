import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../../services/api';
import { useFetch } from '../../hooks/useFetch';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import PageHeader from '../../components/PageHeader';
import DataTable from '../../components/DataTable';
import StatusBadge from '../../components/StatusBadge';
import Button from '../../components/Button';
import Modal from '../../components/Modal';
import Field, { areaClass, inputClass } from '../../components/Field';
import MapView from '../../components/MapView';
import SalesChart from '../../components/SalesChart';
import EmptyState from '../../components/EmptyState';
import { useToast } from '../../context/ToastContext';
import { errorMessage, inr } from '../../utils/format';
import { downloadFile } from '../../utils/download';

function useAdmin(path, deps = []) {
  return useFetch(async () => (await api.get(path)).data.data, deps);
}

export function AdminCustomers() {
  const [q, setQ] = useState('');
  const { data, loading, reload } = useAdmin(`/api/admin/customers?q=${encodeURIComponent(q)}`, [q]);
  const toast = useToast();
  return (
    <div>
      <PageHeader title="Customers" />
      <input className={`${inputClass} mb-3`} placeholder="Search customers" value={q} onChange={(e) => setQ(e.target.value)} />
      <DataTable loading={loading} rows={data || []} columns={[
        { key: 'name', header: 'Customer', render: (row) => <Link className="font-bold" to={`/admin/customers/${row.id}`}>{row.name}</Link> },
        { key: 'phone', header: 'Phone', render: (row) => row.phone },
        { key: 'orders', header: 'Orders', render: (row) => row.orders },
        { key: 'spent', header: 'Spent', render: (row) => inr(row.spent) },
        { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
        { key: 'actions', header: 'Actions', render: (row) => <Button size="sm" variant="outline" onClick={async () => { await api.patch(`/api/admin/customers/${row.id}/status`, { status: row.status === 'active' ? 'suspended' : 'active' }); toast('Updated', 'success'); reload(); }}>{row.status === 'active' ? 'Suspend' : 'Activate'}</Button> },
      ]} />
    </div>
  );
}

export function AdminCustomerDetail() {
  const { id } = useParams();
  const { data, loading } = useAdmin(`/api/admin/customers/${id}`, [id]);
  if (loading || !data) return null;
  return (
    <div className="space-y-3">
      <PageHeader title={data.name} text={`${data.email} · ${data.phone}`} />
      <div className="rounded-3xl bg-white p-4 text-sm">{data.address}, {data.city} {data.pincode}</div>
      {(data.orders || []).map((order) => <Link key={order.id} to={`/admin/orders/${order.id}`} className="block rounded-2xl bg-white p-3"><b>{order.order_number}</b> · {order.service_name} · {inr(order.total_amount)}</Link>)}
    </div>
  );
}

export function AdminTechnicians() {
  const [q, setQ] = useState('');
  const { data, loading, reload } = useAdmin(`/api/admin/technicians?q=${encodeURIComponent(q)}`, [q]);
  const toast = useToast();
  const act = async (id, status) => { await api.patch(`/api/admin/technicians/${id}/approval`, { status }); toast('Technician updated', 'success'); reload(); };
  return (
    <div>
      <PageHeader title="Technicians" />
      <input className={`${inputClass} mb-3`} placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
      <DataTable loading={loading} rows={data || []} columns={[
        { key: 'name', header: 'Technician', render: (row) => <Link className="font-bold" to={`/admin/technicians/${row.id}`}>{row.name}</Link> },
        { key: 'level', header: 'Experience', render: (row) => `${row.level_name || '—'} · ${row.experience_years}y` },
        { key: 'rating', header: 'Rating', render: (row) => row.rating_avg },
        { key: 'services', header: 'Services', render: (row) => row.service_names || '—' },
        { key: 'jobs', header: "Today's jobs", render: (row) => `${row.jobs_today}/${row.daily_job_limit || 'default'}` },
        { key: 'earn', header: "Today's earnings", render: (row) => inr(row.earnings_today) },
        { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.is_online ? 'online' : row.availability} /> },
        { key: 'approval', header: 'Approval', render: (row) => <StatusBadge status={row.approval_status} /> },
        { key: 'actions', header: 'Actions', render: (row) => <div className="flex gap-1"><Button size="sm" onClick={() => act(row.id, 'approved')}>Approve</Button><Button size="sm" variant="danger" onClick={() => act(row.id, 'suspended')}>Suspend</Button></div> },
      ]} />
    </div>
  );
}

export function AdminTechnicianDetail() {
  const { id } = useParams();
  const { data, loading, reload } = useAdmin(`/api/admin/technicians/${id}`, [id]);
  const { data: levels } = useAdmin('/api/admin/levels', []);
  const { data: services } = useAdmin('/api/admin/services', []);
  const toast = useToast();
  const [form, setForm] = useState(null);
  useEffect(() => {
    if (!data) return;
    setForm({ name: data.name, phone: data.phone, email: data.email, levelId: data.level_id || '', dailyJobLimit: data.daily_job_limit || '', experienceYears: data.experience_years, serviceIds: (data.services || []).map((s) => s.id) });
  }, [data?.id]);
  if (loading || !data || !form) return null;
  return (
    <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); try { await api.patch(`/api/admin/technicians/${id}`, form); toast('Saved', 'success'); reload(); } catch (error) { toast(errorMessage(error), 'error'); } }}>
      <PageHeader title={data.name} text={`${data.approval_status} · rating ${data.rating_avg}`} />
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Name"><input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="Phone"><input className={inputClass} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
        <Field label="Level"><select className={inputClass} value={form.levelId} onChange={(e) => setForm({ ...form, levelId: e.target.value })}>{(levels || []).map((level) => <option key={level.id} value={level.id}>{level.name}</option>)}</select></Field>
        <Field label="Daily limit"><input className={inputClass} value={form.dailyJobLimit} onChange={(e) => setForm({ ...form, dailyJobLimit: e.target.value })} /></Field>
      </div>
      <div className="grid gap-2 rounded-3xl bg-white p-4">
        {(services || []).map((service) => <label key={service.id} className="text-sm font-semibold"><input type="checkbox" className="mr-2" checked={form.serviceIds.includes(service.id)} onChange={(e) => setForm({ ...form, serviceIds: e.target.checked ? [...form.serviceIds, service.id] : form.serviceIds.filter((sid) => sid !== service.id) })} />{service.name}</label>)}
      </div>
      <Button>Save technician</Button>
      <Link className="block text-sm font-bold text-[var(--brand)]" to="/admin/map">View location</Link>
    </form>
  );
}

export function AdminServices() {
  const { data, loading, reload } = useAdmin('/api/admin/services', []);
  const { data: categories } = useAdmin('/api/admin/categories', []);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', categoryId: '', description: '', basePrice: '', durationMinutes: 60, taxPercent: 0, discountAmount: 0, technicianCost: '', status: 'active', featured: false, isAvailable: true });
  const toast = useToast();
  const save = async (e) => {
    e.preventDefault();
    const body = new FormData();
    Object.entries(form).forEach(([key, value]) => body.append(key, value));
    const file = e.target.image.files[0];
    if (file) body.append('image', file);
    try {
      if (form.id) await api.patch(`/api/admin/services/${form.id}`, body);
      else await api.post('/api/admin/services', body);
      toast('Service saved', 'success');
      setOpen(false);
      reload();
    } catch (error) { toast(errorMessage(error), 'error'); }
  };
  return (
    <div>
      <PageHeader title="Services" action={<Button onClick={() => { setForm({ name: '', categoryId: categories?.[0]?.id || '', description: '', basePrice: '', durationMinutes: 60, taxPercent: 0, discountAmount: 0, discountPercent: 0, technicianCost: '', status: 'active', featured: false, isAvailable: true }); setOpen(true); }}>Add service</Button>} />
      <DataTable loading={loading} rows={data || []} columns={[
        { key: 'name', header: 'Service', render: (row) => row.name },
        { key: 'cat', header: 'Category', render: (row) => row.category_name },
        { key: 'price', header: 'Final price', render: (row) => inr(row.final_price) },
        { key: 'cost', header: 'Technician cost', render: (row) => inr(row.technician_cost) },
        { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.is_available ? 'active' : 'inactive'} /> },
        { key: 'actions', header: 'Actions', render: (row) => <div className="flex gap-1"><Button size="sm" variant="outline" onClick={() => { setForm({ id: row.id, name: row.name, categoryId: row.category_id, description: row.description || '', basePrice: row.base_price, durationMinutes: row.duration_minutes, taxPercent: row.tax_percent, discountAmount: row.discount_amount, discountPercent: row.discount_percent, technicianCost: row.technician_cost, status: row.status, featured: Boolean(row.featured), isAvailable: Boolean(row.is_available) }); setOpen(true); }}>Edit</Button><Button size="sm" variant="danger" onClick={async () => { await api.delete(`/api/admin/services/${row.id}`); reload(); }}>Delete</Button></div> },
      ]} />
      <Modal open={open} title={form.id ? 'Edit service' : 'Add service'} onClose={() => setOpen(false)} wide>
        <form onSubmit={save} className="grid gap-3 md:grid-cols-2">
          <Field label="Service name"><input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
          <Field label="Category"><select className={inputClass} value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} required>{(categories || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
          <Field label="Description"><textarea className={areaClass} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <Field label="Service image"><input name="image" type="file" accept="image/*" /></Field>
          <Field label="Base price"><input className={inputClass} type="number" value={form.basePrice} onChange={(e) => setForm({ ...form, basePrice: e.target.value })} required /></Field>
          <Field label="Duration (minutes)"><input className={inputClass} type="number" value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} /></Field>
          <Field label="GST / tax %"><input className={inputClass} type="number" value={form.taxPercent} onChange={(e) => setForm({ ...form, taxPercent: e.target.value })} /></Field>
          <Field label="Discount"><input className={inputClass} type="number" value={form.discountAmount} onChange={(e) => setForm({ ...form, discountAmount: e.target.value })} /></Field>
          <Field label="Technician cost"><input className={inputClass} type="number" value={form.technicianCost} onChange={(e) => setForm({ ...form, technicianCost: e.target.value })} /></Field>
          <Field label="Status"><select className={inputClass} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="active">Active</option><option value="inactive">Inactive</option></select></Field>
          <label className="text-sm font-semibold"><input type="checkbox" checked={!!form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} /> Featured</label>
          <label className="text-sm font-semibold"><input type="checkbox" checked={form.isAvailable !== false} onChange={(e) => setForm({ ...form, isAvailable: e.target.checked })} /> Available</label>
          <Button className="md:col-span-2">Save service</Button>
        </form>
      </Modal>
    </div>
  );
}

export function AdminCategories() {
  const { data, loading, reload } = useAdmin('/api/admin/categories', []);
  const [name, setName] = useState('');
  const toast = useToast();
  return (
    <div>
      <PageHeader title="Categories" />
      <form className="mb-4 flex gap-2" onSubmit={async (e) => { e.preventDefault(); await api.post('/api/admin/categories', { name, status: 'active' }); setName(''); toast('Category added', 'success'); reload(); }}>
        <input className={inputClass} placeholder="New category" value={name} onChange={(e) => setName(e.target.value)} required />
        <Button>Add</Button>
      </form>
      <DataTable loading={loading} rows={data || []} columns={[
        { key: 'name', header: 'Category', render: (row) => row.name },
        { key: 'count', header: 'Services', render: (row) => row.service_count },
        { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
        { key: 'actions', header: 'Actions', render: (row) => <Button size="sm" variant="danger" onClick={async () => { try { await api.delete(`/api/admin/categories/${row.id}`); reload(); } catch (error) { toast(errorMessage(error), 'error'); } }}>Delete</Button> },
      ]} />
    </div>
  );
}

export function AdminPricing() {
  const { data, loading, reload } = useAdmin('/api/admin/pricing', []);
  const { data: techs } = useAdmin('/api/admin/technicians', []);
  const { data: services } = useAdmin('/api/admin/services', []);
  const { data: levels } = useAdmin('/api/admin/levels', []);
  const [form, setForm] = useState({ technicianId: '', serviceId: '', levelId: '', cost: '', effectiveDate: new Date().toISOString().slice(0, 10), status: 'active' });
  const [levelName, setLevelName] = useState('');
  const toast = useToast();
  return (
    <div className="space-y-4">
      <PageHeader title="Technician pricing" text="Costs are chosen per technician, service, and experience level." />
      <form className="grid gap-3 rounded-3xl bg-white p-4 md:grid-cols-3" onSubmit={async (e) => { e.preventDefault(); await api.post('/api/admin/pricing', form); toast('Cost saved', 'success'); reload(); }}>
        <Field label="Technician"><select className={inputClass} value={form.technicianId} onChange={(e) => setForm({ ...form, technicianId: e.target.value })}><option value="">Any technician at this level</option>{(techs || []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
        <Field label="Service"><select className={inputClass} value={form.serviceId} onChange={(e) => setForm({ ...form, serviceId: e.target.value })} required><option value="">Select</option>{(services || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
        <Field label="Technician level"><select className={inputClass} value={form.levelId} onChange={(e) => setForm({ ...form, levelId: e.target.value })}><option value="">Specific technician only</option>{(levels || []).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></Field>
        <Field label="Cost"><input className={inputClass} type="number" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} required /></Field>
        <Field label="Effective date"><input className={inputClass} type="date" value={form.effectiveDate} onChange={(e) => setForm({ ...form, effectiveDate: e.target.value })} /></Field>
        <div className="flex items-end"><Button>Save cost</Button></div>
      </form>
      <form className="flex gap-2" onSubmit={async (e) => { e.preventDefault(); await api.post('/api/admin/levels', { name: levelName, status: 'active' }); setLevelName(''); reload(); }}>
        <input className={inputClass} placeholder="New experience level" value={levelName} onChange={(e) => setLevelName(e.target.value)} />
        <Button variant="outline">Add level</Button>
      </form>
      <DataTable loading={loading} rows={data || []} columns={[
        { key: 'tech', header: 'Technician', render: (row) => row.technician_name || 'Level default' },
        { key: 'service', header: 'Service', render: (row) => row.service_name },
        { key: 'level', header: 'Level', render: (row) => row.level_name || '—' },
        { key: 'cost', header: 'Cost', render: (row) => inr(row.cost) },
        { key: 'date', header: 'Effective', render: (row) => String(row.effective_date).slice(0, 10) },
        { key: 'status', header: 'Status', render: (row) => row.status },
        { key: 'actions', header: 'Actions', render: (row) => <Button size="sm" variant="danger" onClick={async () => { await api.delete(`/api/admin/pricing/${row.id}`); reload(); }}>Delete</Button> },
      ]} />
    </div>
  );
}

export function AdminIncentives() {
  const { data, loading, reload } = useAdmin('/api/admin/incentives', []);
  const [form, setForm] = useState({ name: '', periodType: 'daily', minServices: 5, amount: 300, startDate: '', status: 'active' });
  const toast = useToast();
  return (
    <div>
      <PageHeader title="Incentives" text="Example: 5 services = ₹300, 8 services = ₹500. The highest slab the technician reaches is applied." />
      <form className="mb-4 grid gap-3 rounded-3xl bg-white p-4 md:grid-cols-3" onSubmit={async (e) => { e.preventDefault(); await api.post('/api/admin/incentives', form); toast('Incentive saved', 'success'); reload(); }}>
        <Field label="Name"><input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
        <Field label="Type"><select className={inputClass} value={form.periodType} onChange={(e) => setForm({ ...form, periodType: e.target.value })}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></Field>
        <Field label="Required services"><input className={inputClass} type="number" value={form.minServices} onChange={(e) => setForm({ ...form, minServices: e.target.value })} /></Field>
        <Field label="Incentive amount"><input className={inputClass} type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
        <Field label="Start date"><input className={inputClass} type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></Field>
        <div className="flex items-end"><Button>Save slab</Button></div>
      </form>
      <DataTable loading={loading} rows={data || []} columns={[
        { key: 'name', header: 'Rule', render: (row) => row.name },
        { key: 'type', header: 'Type', render: (row) => row.period_type },
        { key: 'min', header: 'Services', render: (row) => row.min_services },
        { key: 'amount', header: 'Amount', render: (row) => inr(row.amount) },
        { key: 'status', header: 'Status', render: (row) => row.status },
        { key: 'actions', header: 'Actions', render: (row) => <Button size="sm" variant={row.status === 'active' ? 'outline' : 'primary'} onClick={async () => { await api.patch(`/api/admin/incentives/${row.id}`, { name: row.name, periodType: row.period_type, minServices: row.min_services, amount: row.amount, startDate: row.start_date, endDate: row.end_date, status: row.status === 'active' ? 'inactive' : 'active' }); reload(); }}>{row.status === 'active' ? 'Disable' : 'Enable'}</Button> },
      ]} />
    </div>
  );
}

export function AdminPayments() {
  const { data, loading } = useAdmin('/api/admin/payments', []);
  return <div><PageHeader title="Payments" /><DataTable loading={loading} rows={data || []} columns={[
    { key: 'order', header: 'Order', render: (row) => row.order_number },
    { key: 'customer', header: 'Customer', render: (row) => row.customer_name },
    { key: 'amount', header: 'Amount', render: (row) => inr(row.amount) },
    { key: 'method', header: 'Method', render: (row) => row.method },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'txn', header: 'Transaction', render: (row) => row.transaction_id || '—' },
  ]} /></div>;
}

export function AdminSales() {
  const [period, setPeriod] = useState('month');
  const { data, loading } = useAdmin(`/api/admin/reports/sales?period=${period}&group=${period === 'year' ? 'month' : 'day'}`, [period]);
  return <div><PageHeader title="Sales" /><div className="mb-3 flex gap-2">{['today','week','month','year'].map((item) => <button key={item} className={`rounded-full px-3 py-1 text-sm font-bold ${period === item ? 'bg-slate-900 text-white' : 'bg-white'}`} onClick={() => setPeriod(item)}>{item}</button>)}</div>{loading ? null : <div className="rounded-3xl bg-white p-4"><p className="mb-2 text-2xl font-extrabold">{inr(data?.totals?.total)}</p><SalesChart data={data?.series || []} kind="line" /></div>}</div>;
}

const reportTabs = ['sales', 'orders', 'customers', 'technicians', 'services', 'payments', 'profit', 'incentives'];

export function AdminReports() {
  const [tab, setTab] = useState('profit');
  const [period, setPeriod] = useState('month');
  const { data, loading } = useAdmin(`/api/admin/reports/${tab}?period=${period}`, [tab, period]);
  const rows = data?.rows || data?.series || (data ? [data] : []);
  return (
    <div>
      <PageHeader title="Reports" action={<div className="flex gap-2">{['csv','xlsx','pdf'].map((format) => <Button key={format} size="sm" variant="outline" onClick={() => downloadFile(`/api/admin/reports/${tab}/export`, `${tab}-report.${format === 'xlsx' ? 'xlsx' : format}`, { format, period })}>Export {format.toUpperCase()}</Button>)}</div>} />
      <div className="mb-3 flex gap-2 overflow-auto">{reportTabs.map((item) => <button key={item} className={`rounded-full px-3 py-1 text-sm font-bold capitalize ${tab === item ? 'bg-slate-900 text-white' : 'bg-white'}`} onClick={() => setTab(item)}>{item}</button>)}</div>
      <select className={`${inputClass} mb-3 max-w-xs`} value={period} onChange={(e) => setPeriod(e.target.value)}>
        {['today','yesterday','week','last_week','month','last_month','year'].map((item) => <option key={item} value={item}>{item.replace('_', ' ')}</option>)}
      </select>
      {tab === 'profit' && data && (
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          {['gross_sales','collected','technician_costs','incentives','discounts','refunds','net_revenue','estimated_margin'].map((key) => <div key={key} className="rounded-3xl bg-white p-4"><p className="text-xs uppercase text-slate-500">{key.replaceAll('_', ' ')}</p><p className="text-xl font-extrabold">{inr(data[key])}</p></div>)}
        </div>
      )}
      <DataTable loading={loading} rows={Array.isArray(rows) ? rows : []} empty="No reports available" columns={rows[0] ? Object.keys(rows[0]).filter((key) => typeof rows[0][key] !== 'object').slice(0, 7).map((key) => ({ key, header: key, render: (row) => String(row[key] ?? '') })) : []} />
    </div>
  );
}

export function AdminMap() {
  const socket = useSocket();
  const { data, loading, reload } = useAdmin('/api/admin/map', []);
  useEffect(() => {
    if (!socket) return undefined;
    socket.on('technician:location', reload);
    return () => socket.off('technician:location', reload);
  }, [socket]);
  if (loading || !data) return null;
  const markers = [
    ...(data.technicians || []).filter((t) => t.latitude).map((t) => ({ lat: t.latitude, lng: t.longitude, title: t.name, info: `${t.availability} · ${t.current_job || 'No active job'} · ${t.last_updated || ''}` })),
    ...(data.jobs || []).map((job) => ({ lat: job.latitude, lng: job.longitude, title: job.customer_name, tone: 'customer', info: `${job.order_number} · ${job.order_status}` })),
  ];
  return (
    <div className="space-y-4">
      <PageHeader title="Live map" text="Active technicians, their latest position, and open customer locations." />
      <MapView markers={markers} height={420} />
      <div className="grid gap-3 md:grid-cols-2">
        {(data.technicians || []).map((tech) => (
          <article key={tech.id} className="rounded-3xl bg-white p-4 text-sm">
            <p className="font-extrabold">{tech.name}</p>
            <p>{tech.is_online ? 'Online' : 'Offline'} · {tech.availability}</p>
            <p>Current job: {tech.current_job || 'None'}</p>
            <p>Last updated: {tech.last_updated || 'No live ping'}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

export function AdminNotifications() {
  const [form, setForm] = useState({ title: '', message: '', audience: 'all' });
  const toast = useToast();
  return (
    <form className="max-w-xl space-y-3" onSubmit={async (e) => { e.preventDefault(); const res = await api.post('/api/admin/notifications/broadcast', form); toast(`Sent to ${res.data.data.sent} people`, 'success'); }}>
      <PageHeader title="Notifications" />
      <Field label="Audience"><select className={inputClass} value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })}><option value="all">Customers and technicians</option><option value="customers">Customers</option><option value="technicians">Technicians</option></select></Field>
      <Field label="Title"><input className={inputClass} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></Field>
      <Field label="Message"><textarea className={areaClass} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} required /></Field>
      <Button>Send announcement</Button>
    </form>
  );
}

export function AdminReviews() {
  const { data, loading, reload } = useAdmin('/api/admin/reviews', []);
  return <div><PageHeader title="Reviews" /><DataTable loading={loading} rows={data || []} empty="No reviews" columns={[
    { key: 'customer', header: 'Customer', render: (row) => row.customer_name },
    { key: 'tech', header: 'Technician', render: (row) => row.technician_name },
    { key: 'rating', header: 'Rating', render: (row) => row.rating },
    { key: 'comment', header: 'Review', render: (row) => row.comment },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'actions', header: 'Actions', render: (row) => <Button size="sm" variant="outline" onClick={async () => { await api.patch(`/api/admin/reviews/${row.id}`, { status: row.status === 'published' ? 'hidden' : 'published' }); reload(); }}>{row.status === 'published' ? 'Hide' : 'Publish'}</Button> },
  ]} /></div>;
}

export function AdminLocations() {
  const { data, loading, reload } = useAdmin('/api/admin/locations', []);
  const [form, setForm] = useState({ name: '', city: '', state: '', pincode: '' });
  return <div><PageHeader title="Locations" /><form className="mb-4 grid gap-2 md:grid-cols-5" onSubmit={async (e) => { e.preventDefault(); await api.post('/api/admin/locations', form); setForm({ name: '', city: '', state: '', pincode: '' }); reload(); }}>{['name','city','state','pincode'].map((key) => <input key={key} className={inputClass} placeholder={key} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} required={key !== 'pincode'} />)}<Button>Add</Button></form><DataTable loading={loading} rows={data || []} columns={[{ key: 'name', header: 'Area', render: (row) => row.name }, { key: 'city', header: 'City', render: (row) => row.city }, { key: 'state', header: 'State', render: (row) => row.state }, { key: 'actions', header: 'Actions', render: (row) => <Button size="sm" variant="danger" onClick={async () => { await api.delete(`/api/admin/locations/${row.id}`); reload(); }}>Delete</Button> }]} /></div>;
}

export function AdminSettings() {
  const { data, loading, reload } = useAdmin('/api/admin/settings', []);
  const [draft, setDraft] = useState({});
  const toast = useToast();
  if (loading) return null;
  const rows = data || [];
  const groups = [...new Set(rows.map((row) => row.group_name))];
  return (
    <form className="space-y-6" onSubmit={async (e) => {
      e.preventDefault();
      const entries = rows.map((row) => ({ key: row.setting_key, value: draft[row.setting_key] ?? row.setting_value, group: row.group_name }));
      await api.put('/api/admin/settings', { entries });
      toast('Settings saved', 'success');
      reload();
    }}>
      <PageHeader title="Settings" />
      {groups.map((group) => (
        <section key={group} className="rounded-3xl bg-white p-4">
          <h2 className="mb-3 font-extrabold capitalize">{group}</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {rows.filter((row) => row.group_name === group).map((row) => (
              <Field key={row.setting_key} label={row.setting_key.replaceAll('_', ' ')}>
                {row.setting_key === 'faqs' ? <textarea className={areaClass} defaultValue={row.setting_value} onChange={(e) => setDraft({ ...draft, [row.setting_key]: e.target.value })} /> : <input className={inputClass} defaultValue={row.setting_value || ''} onChange={(e) => setDraft({ ...draft, [row.setting_key]: e.target.value })} />}
              </Field>
            ))}
          </div>
        </section>
      ))}
      <Button>Save settings</Button>
    </form>
  );
}

export function AdminProfile() {
  const { user } = useAuth();
  return <div className="rounded-3xl bg-white p-6"><PageHeader title="Admin profile" /><p className="font-bold">{user?.name}</p><p>{user?.email}</p><p>{user?.phone}</p></div>;
}

export function AdminEmpty() { return <EmptyState title="Nothing here yet" />; }
