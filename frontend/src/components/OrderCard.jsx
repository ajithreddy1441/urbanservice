import { Link } from 'react-router-dom';
import { MapPinned, Phone } from 'lucide-react';
import StatusBadge from './StatusBadge';
import { formatDate, formatTime, inr } from '../utils/format';
import { mapsDirectionUrl } from '../utils/maps';

export default function OrderCard({ order, href, showTechnicianCost = false, actions }) {
  const maps = mapsDirectionUrl(order.latitude, order.longitude);
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_12px_30px_-24px_rgba(15,23,42,.9)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-[var(--brand)]">{order.order_number}</p>
          <h3 className="mt-1 text-lg font-extrabold">{order.service_name}</h3>
        </div>
        <StatusBadge status={order.order_status} />
      </div>
      <dl className="mt-3 space-y-1.5 text-sm">
        <div className="flex justify-between gap-3"><dt className="text-slate-500">Customer</dt><dd className="font-semibold">{order.customer_name}</dd></div>
        {order.customer_phone && <div className="flex justify-between gap-3"><dt className="text-slate-500">Phone</dt><dd className="font-semibold">{order.customer_phone}</dd></div>}
        {order.technician_name && <div className="flex justify-between gap-3"><dt className="text-slate-500">Technician</dt><dd className="font-semibold">{order.technician_name}</dd></div>}
        <div className="flex justify-between gap-3"><dt className="text-slate-500">When</dt><dd className="text-right font-semibold">{formatDate(order.scheduled_date)} · {formatTime(order.scheduled_time)}</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-slate-500">Address</dt><dd className="max-w-[60%] text-right font-semibold">{order.city}, {order.state}</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-slate-500">Payment</dt><dd className="font-semibold">{inr(order.total_amount)}</dd></div>
        {showTechnicianCost && <div className="flex justify-between gap-3"><dt className="text-slate-500">Technician cost</dt><dd className="font-semibold">{inr(order.technician_cost)}</dd></div>}
      </dl>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {href && <Link to={href} className="grid h-11 place-items-center rounded-2xl bg-slate-100 text-sm font-bold">View details</Link>}
        {order.customer_phone && <a href={`tel:${order.customer_phone}`} className="grid h-11 place-items-center rounded-2xl bg-slate-100 text-sm font-bold"><span className="inline-flex items-center gap-1"><Phone size={15} /> Call</span></a>}
        {maps && <a href={maps} target="_blank" rel="noreferrer" className="col-span-2 grid h-12 place-items-center rounded-2xl bg-[var(--brand)] text-sm font-bold text-white"><span className="inline-flex items-center gap-2"><MapPinned size={18} /> Open in Google Maps</span></a>}
      </div>
      {actions && <div className="mt-2 grid gap-2">{actions}</div>}
    </article>
  );
}
