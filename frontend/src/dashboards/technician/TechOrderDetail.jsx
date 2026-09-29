import { useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../services/api';
import { useFetch } from '../../hooks/useFetch';
import { useToast } from '../../context/ToastContext';
import StatusBadge from '../../components/StatusBadge';
import Button from '../../components/Button';
import MapView from '../../components/MapView';
import { PageSkeleton } from '../../components/Loading';
import { errorMessage, formatDate, formatTime, inr } from '../../utils/format';
import { mapsDirectionUrl } from '../../utils/maps';

const nextAction = {
  assigned: null,
  accepted: ['on_the_way', 'Start travel'],
  on_the_way: ['arrived', 'I have arrived'],
  arrived: ['service_started', 'Start service'],
  service_started: ['service_completed', 'Complete service'],
  service_completed: null,
};

export default function TechOrderDetail() {
  const { id } = useParams();
  const toast = useToast();
  const { data, loading, reload } = useFetch(async () => (await api.get(`/api/technician/orders/${id}`)).data.data, [id]);
  const [busy, setBusy] = useState(false);
  const [images, setImages] = useState([]);
  if (loading || !data) return <PageSkeleton />;
  const maps = mapsDirectionUrl(data.latitude, data.longitude);
  const action = nextAction[data.order_status];
  const run = async (status) => {
    setBusy(true);
    try {
      const body = new FormData();
      body.append('status', status);
      images.forEach((file) => body.append('images', file));
      await api.patch(`/api/technician/orders/${id}/status`, body);
      toast('Job updated', 'success');
      setImages([]);
      reload();
    } catch (error) { toast(errorMessage(error), 'error'); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-4 pb-28">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-bold text-[var(--brand)]">{data.order_number}</p>
          <h1 className="text-2xl font-extrabold">{data.service_name}</h1>
        </div>
        <StatusBadge status={data.order_status} />
      </div>
      <section className="rounded-3xl bg-white p-4 text-sm">
        <p className="text-lg font-extrabold">{data.customer_name}</p>
        <a className="font-bold text-[var(--brand)]" href={`tel:${data.customer_phone}`}>{data.customer_phone}</a>
        <p className="mt-3">{data.address_line}</p>
        <p className="text-slate-500">{data.landmark}</p>
        <p className="mt-2 font-semibold">Latitude {data.latitude}</p>
        <p className="font-semibold">Longitude {data.longitude}</p>
        <p className="mt-2">{formatDate(data.scheduled_date)} · {formatTime(data.scheduled_time)}</p>
        <p className="mt-2">Payment {inr(data.total_amount)} · {data.payment_status}</p>
        <p>Technician cost {inr(data.technician_cost)}</p>
      </section>
      <MapView markers={[{ lat: data.latitude, lng: data.longitude, title: data.customer_name, tone: 'customer', info: data.address_line }]} height={240} />
      {maps && <a href={maps} target="_blank" rel="noreferrer" className="grid h-14 place-items-center rounded-2xl bg-[var(--brand)] text-base font-extrabold text-white">Open in Google Maps</a>}
      {data.order_status === 'assigned' && (
        <div className="grid grid-cols-2 gap-2">
          <Button loading={busy} onClick={() => run('accepted')}>Accept</Button>
          <Button variant="danger" loading={busy} onClick={() => run('rejected')}>Reject</Button>
        </div>
      )}
      {data.order_status === 'service_started' && <input type="file" accept="image/*" multiple onChange={(e) => setImages(Array.from(e.target.files || []))} />}
      {action && <Button className="w-full" size="lg" loading={busy} onClick={() => run(action[0])}>{action[1]}</Button>}
      {data.order_status === 'service_completed' && data.payment_status !== 'paid' && (
        <Button className="w-full" variant="success" loading={busy} onClick={async () => {
          setBusy(true);
          try { await api.post(`/api/technician/orders/${id}/pay`, { method: 'cash' }); toast('Payment recorded', 'success'); reload(); } catch (error) { toast(errorMessage(error), 'error'); } finally { setBusy(false); }
        }}>Record cash payment</Button>
      )}
    </div>
  );
}
