import { useState } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useFetch } from '../../hooks/useFetch';
import { useToast } from '../../context/ToastContext';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import Button from '../../components/Button';
import Field, { inputClass } from '../../components/Field';
import LocationPicker from '../../components/LocationPicker';
import { PageSkeleton } from '../../components/Loading';
import { errorMessage, formatDate, inr, mediaUrl } from '../../utils/format';

export function CustomerProfile() {
  const { user, refreshUser } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ name: user?.name || '', phone: user?.phone || '', address: user?.customer?.address || '', city: user?.customer?.city || '', state: user?.customer?.state || '', pincode: user?.customer?.pincode || '' });
  const save = async (e) => {
    e.preventDefault();
    try { await api.patch('/api/auth/profile', form); await refreshUser(); toast('Profile updated', 'success'); } catch (error) { toast(errorMessage(error), 'error'); }
  };
  return (
    <form onSubmit={save} className="mx-auto max-w-lg space-y-3">
      <PageHeader title="My profile" />
      {user?.avatar && <img src={mediaUrl(user.avatar)} alt="" className="h-20 w-20 rounded-full object-cover" />}
      <Field label="Name"><input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
      <Field label="Phone"><input className={inputClass} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
      <Field label="Email"><input className={inputClass} value={user?.email || ''} disabled /></Field>
      <Field label="Address"><input className={inputClass} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="City"><input className={inputClass} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
        <Field label="Pincode"><input className={inputClass} value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} /></Field>
      </div>
      <Button>Save profile</Button>
    </form>
  );
}

export function CustomerPayments() {
  const { data, loading } = useFetch(async () => (await api.get('/api/customer/payments')).data.data, []);
  if (loading) return <PageSkeleton />;
  return (
    <div>
      <PageHeader title="Payments" />
      {!data?.length ? <EmptyState title="No payments yet" /> : data.map((payment) => (
        <article key={payment.id} className="mb-3 rounded-3xl bg-white p-4">
          <div className="flex justify-between font-bold"><span>{payment.order_number}</span><span>{inr(payment.amount)}</span></div>
          <p className="mt-1 text-sm text-slate-500">{payment.method} · {payment.status} · {payment.transaction_id || '—'}</p>
          <p className="text-xs text-slate-400">{formatDate(payment.paid_at || payment.created_at)}</p>
        </article>
      ))}
    </div>
  );
}

export function CustomerAddresses() {
  const { data, loading, reload } = useFetch(async () => (await api.get('/api/customer/addresses')).data.data, []);
  const [address, setAddress] = useState({ city: 'Guntur', state: 'Andhra Pradesh' });
  const toast = useToast();
  if (loading) return <PageSkeleton />;
  return (
    <div className="space-y-4">
      <PageHeader title="Addresses" />
      {data?.map((item) => (
        <article key={item.id} className="rounded-3xl bg-white p-4 text-sm">
          <p className="font-bold">{item.label} {item.is_default ? '· Default' : ''}</p>
          <p>{[item.house_no, item.street, item.area, item.city, item.pincode].filter(Boolean).join(', ')}</p>
          <p className="text-slate-500">{item.latitude}, {item.longitude}</p>
        </article>
      ))}
      {!data?.length && <EmptyState title="No saved addresses" />}
      <div className="rounded-3xl bg-white p-4">
        <h2 className="mb-3 font-extrabold">Add address</h2>
        <LocationPicker value={address} onChange={setAddress} />
        <Button className="mt-3" onClick={async () => {
          try { await api.post('/api/customer/addresses', { ...address, isDefault: true }); toast('Address saved', 'success'); reload(); } catch (error) { toast(errorMessage(error), 'error'); }
        }}>Save address</Button>
      </div>
    </div>
  );
}

export function CustomerNotifications() {
  const { data, loading, reload } = useFetch(async () => (await api.get('/api/customer/notifications')).data.data, []);
  if (loading) return <PageSkeleton />;
  const items = data?.items || [];
  return (
    <div>
      <PageHeader title="Notifications" action={<Button size="sm" variant="outline" onClick={async () => { await api.patch('/api/customer/notifications/read-all'); reload(); }}>Mark all read</Button>} />
      {!items.length ? <EmptyState title="No notifications" /> : items.map((item) => (
        <article key={item.id} className={`mb-3 rounded-3xl bg-white p-4 ${item.is_read ? 'opacity-70' : ''}`}>
          <p className="font-bold">{item.title}</p>
          <p className="text-sm text-slate-600">{item.message}</p>
        </article>
      ))}
    </div>
  );
}

export function CustomerReviews() {
  const { data, loading } = useFetch(async () => (await api.get('/api/customer/reviews')).data.data, []);
  if (loading) return <PageSkeleton />;
  if (!data?.length) return <EmptyState title="No reviews yet" text="Reviews appear after a completed service." />;
  return (
    <div>
      <PageHeader title="Reviews" />
      {data.map((review) => (
        <article key={review.id} className="mb-3 rounded-3xl bg-white p-4">
          <p className="font-bold">{review.service_name} · {review.rating}/5</p>
          <p className="text-sm text-slate-600">{review.comment}</p>
          <p className="text-xs text-slate-400">{review.technician_name} · {review.order_number}</p>
        </article>
      ))}
    </div>
  );
}

export function CustomerSettings() {
  const toast = useToast();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '' });
  return (
    <form className="mx-auto max-w-lg space-y-3" onSubmit={async (e) => {
      e.preventDefault();
      try { await api.post('/api/auth/change-password', form); toast('Password updated', 'success'); } catch (error) { toast(errorMessage(error), 'error'); }
    }}>
      <PageHeader title="Settings" text="Update the password for this account." />
      <Field label="Current password"><input type="password" className={inputClass} value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} /></Field>
      <Field label="New password"><input type="password" className={inputClass} value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} /></Field>
      <Button>Update password</Button>
    </form>
  );
}

export function useBusy() { return useState(false); }
