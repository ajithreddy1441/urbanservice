import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../../services/api';
import { useFetch } from '../../hooks/useFetch';
import { useToast } from '../../context/ToastContext';
import StatusBadge from '../../components/StatusBadge';
import Button from '../../components/Button';
import { PageSkeleton } from '../../components/Loading';
import { TIMELINE } from '../../utils/status';
import { errorMessage, formatDate, formatTime, inr, mediaUrl } from '../../utils/format';
import { mapsDirectionUrl } from '../../utils/maps';

export default function CustomerOrderDetail() {
  const { id } = useParams();
  const toast = useToast();
  const { data, loading, reload } = useFetch(async () => (await api.get(`/api/customer/orders/${id}`)).data.data, [id]);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  if (loading || !data) return <PageSkeleton />;
  const maps = mapsDirectionUrl(data.latitude, data.longitude);
  const reached = new Set((data.history || []).map((item) => item.status));
  const act = async (fn, ok) => {
    setBusy(true);
    try { await fn(); toast(ok, 'success'); reload(); } catch (error) { toast(errorMessage(error), 'error'); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-[var(--brand)]">{data.order_number}</p>
          <h1 className="text-2xl font-extrabold">{data.service_name}</h1>
          <p className="text-sm text-slate-500">{data.category_name}</p>
        </div>
        <StatusBadge status={data.order_status} />
      </div>
      <section className="rounded-3xl bg-white p-4 text-sm">
        {[
          ['Booking date', formatDate(data.scheduled_date)],
          ['Booking time', formatTime(data.scheduled_time)],
          ['Address', data.address_line],
          ['Exact location', data.latitude ? `${data.latitude}, ${data.longitude}` : '—'],
          ['Technician', data.technician_name || 'Not assigned'],
          ['Technician phone', data.technician_phone || '—'],
          ['Technician status', data.technician_availability || '—'],
          ['Payment status', data.payment_status],
          ['Order amount', inr(data.total_amount)],
          ['Technician cost', inr(data.technician_cost)],
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3 border-b border-slate-100 py-2 last:border-0"><span className="text-slate-500">{label}</span><span className="text-right font-semibold">{value}</span></div>
        ))}
      </section>
      <section className="rounded-3xl bg-white p-4">
        <h2 className="font-extrabold">Order timeline</h2>
        <ol className="mt-3 space-y-3">
          {TIMELINE.map(([status, label], index) => (
            <li key={status} className="flex gap-3">
              <span className={`mt-1 h-3 w-3 rounded-full ${reached.has(status) ? 'bg-[var(--brand)]' : 'bg-slate-200'}`} />
              <div>
                <p className="text-sm font-bold">{label}</p>
                {index < TIMELINE.length - 1 && <span className="text-xs text-slate-400">↓</span>}
              </div>
            </li>
          ))}
        </ol>
      </section>
      {!!data.images?.length && (
        <div className="grid grid-cols-3 gap-2">{data.images.map((image) => <img key={image.id} src={mediaUrl(image.image_path)} alt="" className="h-24 w-full rounded-2xl object-cover" />)}</div>
      )}
      <div className="grid grid-cols-2 gap-2">
        {['on_the_way', 'arrived', 'accepted', 'assigned'].includes(data.order_status) && <Link to={`/customer/track/${data.id}`} className="grid h-12 place-items-center rounded-2xl bg-[var(--brand)] text-sm font-bold text-white">Track technician</Link>}
        {maps && <a href={maps} target="_blank" rel="noreferrer" className="grid h-12 place-items-center rounded-2xl bg-slate-900 text-sm font-bold text-white">Open location</a>}
        {data.payment_status !== 'paid' && !['cancelled', 'refunded'].includes(data.order_status) && <Button loading={busy} onClick={() => act(() => api.post(`/api/customer/orders/${id}/pay`, { method: data.payment_method || 'upi' }), 'Payment recorded')}>Pay now</Button>}
        {['pending', 'confirmed', 'assigned', 'accepted'].includes(data.order_status) && <Button variant="danger" loading={busy} onClick={() => act(() => api.patch(`/api/customer/orders/${id}/cancel`, { reason: 'Cancelled by customer' }), 'Order cancelled')}>Cancel</Button>}
      </div>
      {['service_completed', 'payment_completed'].includes(data.order_status) && !data.review && (
        <form className="rounded-3xl bg-white p-4" onSubmit={(e) => { e.preventDefault(); act(() => api.post(`/api/customer/orders/${id}/review`, { rating, comment }), 'Review saved'); }}>
          <h2 className="font-extrabold">Rate technician</h2>
          <div className="mt-2 flex gap-2">{[1, 2, 3, 4, 5].map((score) => <button type="button" key={score} className={`h-10 w-10 rounded-full font-bold ${rating === score ? 'bg-amber-400' : 'bg-slate-100'}`} onClick={() => setRating(score)}>{score}</button>)}</div>
          <textarea className="mt-3 min-h-20 w-full rounded-2xl border border-slate-200 p-3 text-sm" placeholder="How was the service?" value={comment} onChange={(e) => setComment(e.target.value)} />
          <Button className="mt-3" loading={busy}>Submit review</Button>
        </form>
      )}
    </div>
  );
}
