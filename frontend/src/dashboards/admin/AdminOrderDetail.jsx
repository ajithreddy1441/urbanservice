import { useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../services/api';
import { useFetch } from '../../hooks/useFetch';
import { useToast } from '../../context/ToastContext';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';
import Button from '../../components/Button';
import MapView from '../../components/MapView';
import { PageSkeleton } from '../../components/Loading';
import { errorMessage, formatDate, formatTime, inr } from '../../utils/format';
import { mapsDirectionUrl } from '../../utils/maps';

export default function AdminOrderDetail() {
  const { id } = useParams();
  const toast = useToast();
  const { data, loading, reload } = useFetch(async () => (await api.get(`/api/admin/orders/${id}`)).data.data, [id]);
  const [candidates, setCandidates] = useState(null);
  const [filters, setFilters] = useState({ available: '1', expertise: '0', withinLimit: '0' });
  const [busy, setBusy] = useState(false);
  const loadCandidates = async (next = filters) => {
    const res = await api.get(`/api/admin/orders/${id}/candidates`, { params: next });
    setCandidates(res.data.data.technicians);
  };
  if (loading || !data) return <PageSkeleton />;
  const assign = async (technicianId, override = false) => {
    setBusy(true);
    try {
      await api.post(`/api/admin/orders/${id}/assign-technician`, { technicianId, override });
      toast('Technician assigned', 'success');
      setCandidates(null);
      reload();
    } catch (error) {
      toast(errorMessage(error), 'error');
    } finally { setBusy(false); }
  };
  return (
    <div className="space-y-4">
      <PageHeader title={data.order_number} text={`${data.customer_name} · ${data.service_name}`} action={<StatusBadge status={data.order_status} />} />
      <section className="grid gap-3 rounded-3xl bg-white p-4 text-sm md:grid-cols-2">
        <p><span className="text-slate-500">When</span><br /><b>{formatDate(data.scheduled_date)} · {formatTime(data.scheduled_time)}</b></p>
        <p><span className="text-slate-500">Location</span><br /><b>{data.address_line}</b></p>
        <p><span className="text-slate-500">Coordinates</span><br /><b>{data.latitude}, {data.longitude}</b></p>
        <p><span className="text-slate-500">Technician</span><br /><b>{data.technician_name || 'Unassigned'} {data.technician_phone || ''}</b></p>
        <p>Customer payment {inr(data.total_amount)}</p>
        <p>Technician cost {inr(data.technician_cost)}</p>
        <p>Discount {inr(data.discount)}</p>
        <p>Admin gross margin {inr(data.admin_margin)}</p>
      </section>
      <MapView markers={[{ lat: data.latitude, lng: data.longitude, title: data.customer_name, tone: 'customer', info: data.address_line }]} />
      <a className="inline-flex h-12 items-center rounded-2xl bg-slate-900 px-4 font-bold text-white" href={mapsDirectionUrl(data.latitude, data.longitude)} target="_blank" rel="noreferrer">Open customer location</a>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => loadCandidates()}>{data.technician_id ? 'Reassign technician' : 'Assign technician'}</Button>
        {data.customer_phone && <a className="grid h-11 place-items-center rounded-2xl bg-slate-100 px-4 text-sm font-bold" href={`tel:${data.customer_phone}`}>Contact customer</a>}
        {data.technician_phone && <a className="grid h-11 place-items-center rounded-2xl bg-slate-100 px-4 text-sm font-bold" href={`tel:${data.technician_phone}`}>Contact technician</a>}
        {!['cancelled', 'refunded', 'payment_completed'].includes(data.order_status) && <Button variant="danger" onClick={async () => { await api.patch(`/api/admin/orders/${id}/cancel`, { reason: 'Cancelled by admin' }); toast('Order cancelled', 'success'); reload(); }}>Cancel</Button>}
        {data.payment_status === 'paid' && <Button variant="outline" onClick={async () => { await api.post(`/api/admin/orders/${id}/refund`, { reason: 'Refunded by admin' }); toast('Refund recorded', 'success'); reload(); }}>Refund</Button>}
      </div>
      {candidates && (
        <section className="space-y-3">
          <div className="flex flex-wrap gap-2 text-sm">
            <label className="font-semibold"><input type="checkbox" checked={filters.available === '1'} onChange={(e) => { const next = { ...filters, available: e.target.checked ? '1' : '0' }; setFilters(next); loadCandidates(next); }} /> Available</label>
            <label className="font-semibold"><input type="checkbox" checked={filters.expertise === '1'} onChange={(e) => { const next = { ...filters, expertise: e.target.checked ? '1' : '0' }; setFilters(next); loadCandidates(next); }} /> Service expertise</label>
            <label className="font-semibold"><input type="checkbox" checked={filters.withinLimit === '1'} onChange={(e) => { const next = { ...filters, withinLimit: e.target.checked ? '1' : '0' }; setFilters(next); loadCandidates(next); }} /> Within daily limit</label>
          </div>
          {!candidates.length && <p className="text-sm text-slate-500">No technicians match these filters.</p>}
          {candidates.map((tech) => (
            <article key={tech.id} className="rounded-3xl bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-extrabold">{tech.name}</h3>
                  <p className="text-sm text-slate-500">{tech.level_name} · {tech.rating_avg} rating · {tech.distance_km ?? '—'} km</p>
                  <p className="text-sm">Today's jobs {tech.jobs_today}/{tech.daily_limit} · Cost {inr(tech.technician_cost)} · {tech.availability}</p>
                  {tech.limit_reached && <p className="mt-1 text-sm font-bold text-rose-600">Daily limit reached</p>}
                  {!tech.has_expertise && <p className="text-xs text-amber-700">No listed expertise for this service</p>}
                </div>
                <div className="grid gap-2">
                  <Button loading={busy} disabled={tech.limit_reached || tech.availability !== 'available'} onClick={() => assign(tech.id, false)}>Assign technician</Button>
                  {(tech.limit_reached || tech.availability !== 'available') && <Button variant="outline" loading={busy} onClick={() => assign(tech.id, true)}>Override</Button>}
                </div>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
