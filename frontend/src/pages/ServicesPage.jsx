import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { inr } from '../utils/format';
import { serviceImage } from '../utils/images';
import EmptyState from '../components/EmptyState';
import { PageSkeleton } from '../components/Loading';

export default function ServicesPage() {
  const [params, setParams] = useSearchParams();
  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get('/api/services', { params: { q: params.get('q') || '', category: params.get('category') || '' } }),
      api.get('/api/categories'),
    ]).then(([serviceRes, categoryRes]) => {
      setServices(serviceRes.data.data);
      setCategories(categoryRes.data.data);
    }).finally(() => setLoading(false));
  }, [params]);

  return (
    <div className="min-h-screen bg-[var(--canvas)] px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-3xl font-extrabold">Services</h1>
        <div className="mt-4 flex gap-2 overflow-auto pb-2 no-scrollbar">
          <button className={`rounded-full px-4 py-2 text-sm font-bold ${!params.get('category') ? 'bg-slate-900 text-white' : 'bg-white'}`} onClick={() => setParams({ q: params.get('q') || '' })}>All</button>
          {categories.map((category) => (
            <button key={category.id} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold ${params.get('category') === category.slug ? 'bg-slate-900 text-white' : 'bg-white'}`} onClick={() => setParams({ category: category.slug, q: params.get('q') || '' })}>{category.name}</button>
          ))}
        </div>
        {loading ? <PageSkeleton /> : services.length === 0 ? <EmptyState title="No services found" text="Try another category or search." /> : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((service) => (
              <Link key={service.id} to={`/services/${service.slug}`} className="img-zoom hover-lift overflow-hidden rounded-[28px] bg-white">
                <img src={serviceImage(service)} alt="" className="h-48 w-full object-cover" />
                <div className="p-5">
                  <p className="text-xs font-bold uppercase text-slate-400">{service.category_name}</p>
                  <h2 className="mt-1 text-xl font-extrabold">{service.name}</h2>
                  <p className="mt-2 line-clamp-3 text-sm text-slate-500">{service.description}</p>
                  <div className="mt-4 flex items-end justify-between">
                    <p className="text-lg font-extrabold">{inr(service.final_price)}</p>
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-[var(--brand)] transition hover:bg-[var(--brand)] hover:text-white">Book</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
