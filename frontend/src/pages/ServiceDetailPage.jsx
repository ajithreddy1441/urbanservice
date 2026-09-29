import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Star } from 'lucide-react';
import api from '../services/api';
import { inr } from '../utils/format';
import { serviceImage } from '../utils/images';
import { PageSkeleton } from '../components/Loading';

export default function ServiceDetailPage() {
  const { slug } = useParams();
  const [service, setService] = useState(null);
  useEffect(() => {
    api.get(`/api/services/${slug}`).then((res) => setService(res.data.data)).catch(() => setService(false));
  }, [slug]);
  if (service === null) return <div className="bg-[var(--canvas)]"><PageSkeleton /></div>;
  if (!service) return <div className="bg-[var(--canvas)] p-8">Service not found.</div>;
  return (
    <div className="min-h-screen bg-[var(--canvas)] px-4 py-8 text-slate-900">
      <article className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1.3fr_.7fr]">
        <div className="overflow-hidden rounded-[28px] bg-white">
          <img src={serviceImage(service)} alt="" className="h-72 w-full object-cover" />
          <div className="p-6">
          <p className="text-sm font-bold text-[var(--brand)]">{service.category_name}</p>
          <h1 className="mt-2 text-4xl font-extrabold tracking-tight">{service.name}</h1>
          <p className="mt-4 text-base leading-7 text-slate-600">{service.description}</p>
          <dl className="mt-6 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl bg-slate-50 p-3"><dt className="text-slate-500">Duration</dt><dd className="font-bold">{service.duration_minutes} minutes</dd></div>
            <div className="rounded-2xl bg-slate-50 p-3"><dt className="text-slate-500">Base price</dt><dd className="font-bold">{inr(service.base_price)}</dd></div>
            <div className="rounded-2xl bg-slate-50 p-3"><dt className="text-slate-500">Discount</dt><dd className="font-bold">{inr(service.discount_amount)}</dd></div>
            <div className="rounded-2xl bg-slate-50 p-3"><dt className="text-slate-500">Tax</dt><dd className="font-bold">{service.tax_percent}%</dd></div>
          </dl>
          <div className="mt-8">
            <h2 className="font-extrabold">Recent reviews</h2>
            <div className="mt-3 space-y-3">
              {(service.reviews || []).map((review, index) => (
                <div key={index} className="rounded-2xl bg-slate-50 p-3 text-sm">
                  <div className="flex text-amber-500">{Array.from({ length: review.rating }).map((_, i) => <Star key={i} size={14} fill="currentColor" />)}</div>
                  <p className="mt-1">{review.comment}</p>
                  <p className="mt-1 font-bold">{review.customer_name}</p>
                </div>
              ))}
              {!service.reviews?.length && <p className="text-sm text-slate-500">No reviews for this service yet.</p>}
            </div>
          </div>
          </div>
        </div>
        <aside className="h-fit rounded-[28px] bg-slate-950 p-6 text-white lg:sticky lg:top-24">
          <p className="text-sm text-slate-300">Payable amount</p>
          <p className="mt-1 text-4xl font-extrabold">{inr(service.final_price)}</p>
          <Link to={`/book/${service.slug}`} className="mt-6 grid h-12 place-items-center rounded-2xl bg-[var(--brand)] font-extrabold">Book now</Link>
        </aside>
      </article>
    </div>
  );
}
