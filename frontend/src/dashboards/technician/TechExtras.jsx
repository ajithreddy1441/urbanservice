import { useState } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useFetch } from '../../hooks/useFetch';
import { useToast } from '../../context/ToastContext';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import Button from '../../components/Button';
import Field, { areaClass, inputClass } from '../../components/Field';
import { PageSkeleton } from '../../components/Loading';
import { errorMessage, formatDate, inr } from '../../utils/format';
import { mapsDirectionUrl } from '../../utils/maps';

export function TechEarnings() {
  const { data, loading } = useFetch(async () => (await api.get('/api/technician/earnings')).data.data, []);
  if (loading) return <PageSkeleton />;
  if (!data?.length) return <EmptyState title="No earnings yet" />;
  return <div><PageHeader title="Earnings" />{data.map((row) => <article key={row.id} className="mb-3 rounded-3xl bg-white p-4"><div className="flex justify-between font-bold"><span>{row.order_number}</span><span>{inr(row.base_amount)}</span></div><p className="text-sm text-slate-500">{row.service_name} · {row.status} · {formatDate(row.earned_at)}</p></article>)}</div>;
}

export function TechIncentives() {
  const { data, loading } = useFetch(async () => (await api.get('/api/technician/incentives')).data.data, []);
  if (loading) return <PageSkeleton />;
  return (
    <div className="space-y-3">
      <PageHeader title="Incentives" text="The highest matching slab is applied for each period." />
      {(data?.rules || []).map((rule) => <article key={rule.id} className="rounded-3xl bg-white p-4 text-sm"><p className="font-bold">{rule.name}</p><p>{rule.min_services} services · {inr(rule.amount)} · {rule.period_type}</p></article>)}
      {(data?.incentives || []).map((row) => <article key={row.id} className="rounded-3xl bg-emerald-50 p-4"><p className="font-bold">{row.period_type} · {row.services_count} services</p><p>{inr(row.amount)} · {formatDate(row.period_start)}</p></article>)}
      {!data?.incentives?.length && <EmptyState title="No incentive calculated yet" />}
    </div>
  );
}

export function TechCustomers() {
  const { data, loading } = useFetch(async () => (await api.get('/api/technician/customers')).data.data, []);
  if (loading) return <PageSkeleton />;
  if (!data?.length) return <EmptyState title="No customers yet" />;
  return <div><PageHeader title="Customers" />{data.map((row, index) => <article key={index} className="mb-3 rounded-3xl bg-white p-4 text-sm"><p className="font-bold">{row.name}</p><a href={`tel:${row.phone}`}>{row.phone}</a><p className="mt-1">{row.address_line}</p><a className="mt-2 inline-block font-bold text-[var(--brand)]" href={mapsDirectionUrl(row.latitude, row.longitude)} target="_blank" rel="noreferrer">Open in Google Maps</a></article>)}</div>;
}

export function TechPayments() {
  const { data, loading } = useFetch(async () => (await api.get('/api/technician/payments')).data.data, []);
  if (loading) return <PageSkeleton />;
  if (!data?.length) return <EmptyState title="No payments yet" />;
  return <div><PageHeader title="Payments" />{data.map((row) => <article key={row.id} className="mb-3 rounded-3xl bg-white p-4"><div className="flex justify-between font-bold"><span>{row.order_number}</span><span>{inr(row.amount)}</span></div><p className="text-sm text-slate-500">{row.method} · {row.status}</p></article>)}</div>;
}

export function TechNotifications() {
  const { data, loading, reload } = useFetch(async () => (await api.get('/api/technician/notifications')).data.data, []);
  if (loading) return <PageSkeleton />;
  const items = data?.items || [];
  return <div><PageHeader title="Notifications" action={<Button size="sm" variant="outline" onClick={async () => { await api.patch('/api/technician/notifications/read-all'); reload(); }}>Mark read</Button>} />{!items.length ? <EmptyState title="No notifications" /> : items.map((item) => <article key={item.id} className="mb-3 rounded-3xl bg-white p-4"><p className="font-bold">{item.title}</p><p className="text-sm">{item.message}</p></article>)}</div>;
}

export function TechProfile() {
  const { user, refreshUser } = useAuth();
  const toast = useToast();
  const tech = user?.technician || {};
  const [bio, setBio] = useState(tech.bio || '');
  return (
    <div className="space-y-3">
      <PageHeader title="Profile" />
      <div className="rounded-3xl bg-white p-4 text-sm">
        <p className="text-xl font-extrabold">{user?.name}</p>
        <p>{user?.phone} · {user?.email}</p>
        <p className="mt-2">Experience {tech.experience_years} years · {tech.level_name}</p>
        <p>Rating {tech.rating_avg} ({tech.rating_count})</p>
        <p>Status {tech.approval_status} · {tech.availability}</p>
        <p className="mt-2">{(tech.services || []).map((s) => s.name).join(', ') || 'No services selected'}</p>
      </div>
      <Field label="Bio"><textarea className={areaClass} value={bio} onChange={(e) => setBio(e.target.value)} /></Field>
      <Button onClick={async () => { try { await api.patch('/api/auth/profile', { bio }); await refreshUser(); toast('Profile updated', 'success'); } catch (error) { toast(errorMessage(error), 'error'); } }}>Save</Button>
    </div>
  );
}

export function TechAvailability() {
  const { refreshUser } = useAuth();
  const toast = useToast();
  const options = ['available', 'busy', 'on_leave', 'offline'];
  return (
    <div>
      <PageHeader title="Availability" text="Admins avoid assigning jobs when you are offline, busy, or on leave." />
      <div className="grid gap-2">
        {options.map((status) => <Button key={status} variant="outline" onClick={async () => {
          try { await api.patch('/api/technician/availability', { availability: status, isOnline: status === 'available' }); await refreshUser(); toast('Availability updated', 'success'); } catch (error) { toast(errorMessage(error), 'error'); }
        }}>{status.replace('_', ' ')}</Button>)}
      </div>
    </div>
  );
}

export function TechSettings() {
  const toast = useToast();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '' });
  return <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); try { await api.post('/api/auth/change-password', form); toast('Password updated', 'success'); } catch (error) { toast(errorMessage(error), 'error'); } }}><PageHeader title="Settings" /><Field label="Current password"><input className={inputClass} type="password" value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} /></Field><Field label="New password"><input className={inputClass} type="password" value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} /></Field><Button>Update password</Button></form>;
}
