import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../../services/api';
import { useSocket } from '../../context/SocketContext';
import MapView from '../../components/MapView';
import StatusBadge from '../../components/StatusBadge';
import { PageSkeleton } from '../../components/Loading';
import EmptyState from '../../components/EmptyState';

export default function CustomerTrack() {
  const { id } = useParams();
  const socket = useSocket();
  const [data, setData] = useState(null);
  const [active, setActive] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    if (!id) {
      return api.get('/api/customer/orders', { params: { bucket: 'active', limit: 20 } })
        .then((res) => setActive(res.data.data.items || []))
        .finally(() => setLoading(false));
    }
    return api.get(`/api/customer/orders/${id}/tracking`).then((res) => setData(res.data.data)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); const timer = setInterval(load, 12000); return () => clearInterval(timer); }, [id]);
  useEffect(() => {
    if (!socket || !id) return undefined;
    socket.emit('track:join', Number(id));
    const onMove = (payload) => {
      if (Number(payload.orderId) !== Number(id)) return;
      setData((current) => current ? { ...current, technician_location: payload, trackable: true } : current);
    };
    socket.on('technician:location', onMove);
    socket.on('order:updated', load);
    return () => { socket.off('technician:location', onMove); socket.off('order:updated', load); };
  }, [socket, id]);

  if (loading) return <PageSkeleton />;
  if (!id) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-extrabold">Track technician</h1>
        {!active.length && <EmptyState title="No active trip" text="Tracking appears when a technician is travelling to you." />}
        {active.map((order) => (
          <Link key={order.id} to={`/customer/track/${order.id}`} className="block rounded-3xl bg-white p-4">
            <p className="font-extrabold">{order.service_name}</p>
            <p className="text-sm text-slate-500">{order.order_number} · {order.technician_name || 'Waiting for assignment'}</p>
          </Link>
        ))}
      </div>
    );
  }
  if (!data) return <PageSkeleton />;
  const order = data.order;
  const markers = [
    order.latitude ? { lat: order.latitude, lng: order.longitude, title: 'You', tone: 'customer', info: order.address_line } : null,
    data.technician_location ? { lat: data.technician_location.latitude, lng: data.technician_location.longitude, title: order.technician_name || 'Technician', info: 'Latest position' } : null,
  ].filter(Boolean);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">Track technician</h1>
          <p className="text-sm text-slate-500">{order.order_number} · {order.service_name}</p>
        </div>
        <StatusBadge status={order.order_status} />
      </div>
      {data.trackable ? <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">Technician is on the way</p> : <EmptyState title="Tracking opens when travel starts" text="You will see the live position after the technician taps Start travel." />}
      <MapView markers={markers} height={360} />
      <div className="rounded-3xl bg-white p-4 text-sm">
        <p className="font-bold">{order.technician_name || 'Technician not assigned'}</p>
        <p className="text-slate-500">{order.technician_phone}</p>
        {data.technician_location && <p className="mt-2">Updated {new Date(data.technician_location.created_at || data.technician_location.updatedAt).toLocaleTimeString('en-IN')}</p>}
        <Link to={`/customer/orders/${order.id}`} className="mt-3 inline-block font-bold text-[var(--brand)]">View order</Link>
      </div>
    </div>
  );
}
