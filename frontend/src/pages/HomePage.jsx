import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Clock3, MapPin, Search, ShieldCheck, Star } from 'lucide-react';
import api from '../services/api';
import { inr } from '../utils/format';
import { categoryImage, heroImage, safetyImage, serviceImage, technicianImage } from '../utils/images';

export default function HomePage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [city, setCity] = useState(localStorage.getItem('urban_city') || 'Guntur');
  const [data, setData] = useState({ services: [], categories: [], reviews: [], stats: {}, settings: {}, locations: [] });

  useEffect(() => {
    Promise.all([
      api.get('/api/services'),
      api.get('/api/categories'),
      api.get('/api/reviews/public'),
      api.get('/api/stats'),
      api.get('/api/settings/public'),
      api.get('/api/locations'),
    ]).then(([services, categories, reviews, stats, settings, locations]) => {
      const next = {
        services: services.data.data,
        categories: categories.data.data,
        reviews: reviews.data.data,
        stats: stats.data.data,
        settings: settings.data.data,
        locations: locations.data.data,
      };
      setData(next);
      if (next.settings.primary_color) document.documentElement.style.setProperty('--brand', next.settings.primary_color);
    }).catch(() => {});
  }, []);

  const featured = data.services.filter((service) => service.featured);
  const offers = data.services.filter((service) => Number(service.discount_amount) > 0 || Number(service.discount_percent) > 0);
  const faqs = Array.isArray(data.settings.faqs) ? data.settings.faqs : [];
  const popular = data.services.slice(0, 6);

  return (
    <div className="bg-[var(--canvas)] text-slate-900">
      <section className="relative overflow-hidden bg-slate-950 text-white">
        <img src={heroImage} alt="" className="ken absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/75 to-slate-950/25" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 lg:grid-cols-[1.15fr_.85fr] lg:py-24">
          <div className="fade-up">
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-blue-200">Home services, done properly</p>
            <h1 className="mt-4 max-w-xl text-4xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">Professional Services at Your Doorstep</h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-slate-200">{data.settings.hero_subtitle || 'Book verified technicians for repairs, cleaning, and maintenance.'}</p>
            <form className="floaty mt-8 rounded-[28px] bg-white p-3 text-slate-900 shadow-2xl" onSubmit={(e) => { e.preventDefault(); localStorage.setItem('urban_city', city); navigate(`/services?q=${encodeURIComponent(query)}&city=${encodeURIComponent(city)}`); }}>
              <div className="grid gap-2 md:grid-cols-[180px_1fr_auto]">
                <label className="flex items-center gap-2 rounded-2xl bg-slate-100 px-3 transition focus-within:ring-4 focus-within:ring-blue-100">
                  <MapPin size={16} />
                  <select className="h-12 w-full bg-transparent text-sm font-semibold outline-none" value={city} onChange={(e) => setCity(e.target.value)}>
                    {(data.locations.length ? data.locations : [{ city: 'Guntur' }]).map((loc) => <option key={loc.city}>{loc.city}</option>)}
                  </select>
                </label>
                <label className="flex items-center gap-2 rounded-2xl bg-slate-100 px-3 transition focus-within:ring-4 focus-within:ring-blue-100">
                  <Search size={16} />
                  <input className="h-12 w-full bg-transparent text-sm outline-none" placeholder="Search AC repair, cleaning..." value={query} onChange={(e) => setQuery(e.target.value)} />
                </label>
                <button className="h-12 rounded-2xl bg-[var(--brand)] px-5 text-sm font-bold text-white transition hover:scale-[1.03] hover:brightness-110">Book now</button>
              </div>
            </form>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              [data.stats.services || '—', 'Services'],
              [data.stats.technicians || '—', 'Technicians'],
              [data.stats.customers || '—', 'Customers'],
              [data.stats.rating ? `${data.stats.rating}★` : '—', 'Avg rating'],
            ].map(([value, label], index) => (
              <div key={label} className="fade-up hover-lift rounded-3xl border border-white/15 bg-white/10 p-5 backdrop-blur" style={{ animationDelay: `${index * 90}ms` }}>
                <p className="text-3xl font-extrabold">{value}</p>
                <p className="mt-1 text-sm text-slate-200">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="flex items-end justify-between">
          <h2 className="text-3xl font-extrabold tracking-tight">Service categories</h2>
          <Link to="/services" className="text-sm font-bold text-[var(--brand)] transition hover:translate-x-1">View all</Link>
        </div>
        <div className="mt-5 flex gap-4 overflow-auto pb-3 no-scrollbar">
          {data.categories.map((category) => (
            <Link key={category.id} to={`/services?category=${category.slug}`} className="img-zoom hover-lift group relative min-w-52 overflow-hidden rounded-[28px]">
              <img src={category.image || categoryImage(category.slug)} alt="" className="h-64 w-52 object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                <p className="text-lg font-extrabold">{category.name}</p>
                <p className="text-xs text-slate-200">{category.service_count} services</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-6">
        <h2 className="text-3xl font-extrabold tracking-tight">Popular services</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {popular.map((service, index) => (
            <Link key={service.id} to={`/services/${service.slug}`} className="img-zoom hover-lift fade-up overflow-hidden rounded-[28px] bg-white" style={{ animationDelay: `${index * 70}ms` }}>
              <img src={serviceImage(service)} alt="" className="h-48 w-full object-cover" />
              <div className="p-5">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{service.category_name}</p>
                <h3 className="mt-1 text-lg font-extrabold">{service.name}</h3>
                <p className="mt-2 line-clamp-2 text-sm text-slate-500">{service.description}</p>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-lg font-extrabold">{inr(service.final_price)}</span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500 transition group-hover:bg-blue-50">{service.duration_minutes} min</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section id="how" className="mx-auto grid max-w-6xl gap-4 px-4 py-10 md:grid-cols-4">
        {['Choose a service', 'Share your exact location', 'We assign a technician', 'Track, pay, and review'].map((step, index) => (
          <article key={step} className="hover-lift rounded-[28px] bg-white p-5">
            <p className="text-sm font-extrabold text-[var(--brand)]">0{index + 1}</p>
            <h3 className="mt-3 text-lg font-extrabold">{step}</h3>
          </article>
        ))}
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-4 py-4 md:grid-cols-3">
        {[
          [ShieldCheck, 'Verified people', 'Technicians are approved before they can accept work.'],
          [MapPin, 'Exact arrival', 'Bookings store latitude and longitude, not just a street name.'],
          [Clock3, 'Clear timing', 'Pick a slot and follow every status from assignment to payment.'],
        ].map(([Icon, title, text]) => (
          <article key={title} className="hover-lift rounded-[28px] bg-slate-950 p-6 text-white">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10"><Icon size={18} /></span>
            <h3 className="mt-4 text-lg font-extrabold">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">{text}</p>
          </article>
        ))}
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        <h2 className="text-3xl font-extrabold tracking-tight">Featured services</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {(featured.length ? featured : data.services).slice(0, 3).map((service) => (
            <Link key={service.id} to={`/services/${service.slug}`} className="img-zoom hover-lift overflow-hidden rounded-[28px] bg-white">
              <img src={serviceImage(service)} alt="" className="h-56 w-full object-cover" />
              <div className="p-5">
                <h3 className="text-xl font-extrabold">{service.name}</h3>
                <p className="mt-2 line-clamp-2 text-sm text-slate-500">{service.description}</p>
                <p className="mt-4 text-lg font-extrabold">{inr(service.final_price)}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section id="reviews" className="mx-auto max-w-6xl px-4 py-6">
        <h2 className="text-3xl font-extrabold tracking-tight">Customer reviews</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {data.reviews.slice(0, 6).map((review, index) => (
            <article key={index} className="hover-lift rounded-[28px] bg-white p-5">
              <div className="flex items-center gap-1 text-amber-500">{Array.from({ length: review.rating }).map((_, i) => <Star key={i} size={14} fill="currentColor" />)}</div>
              <p className="mt-3 text-sm leading-6">{review.comment}</p>
              <p className="mt-4 text-sm font-bold">{review.customer_name}</p>
              <p className="text-xs text-slate-500">{review.service_name}</p>
            </article>
          ))}
          {!data.reviews.length && <p className="text-sm text-slate-500">Reviews appear after completed jobs.</p>}
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-4 py-8 md:grid-cols-2">
        <article className="img-zoom hover-lift relative min-h-72 overflow-hidden rounded-[28px]">
          <img src={safetyImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-slate-950/65" />
          <div className="relative p-7 text-white">
            <h2 className="text-3xl font-extrabold">Safety first</h2>
            <p className="mt-3 max-w-md text-sm leading-6 text-slate-200">Government ID, approval status, and job history stay with the admin team. Customers see the technician name and phone only after assignment.</p>
          </div>
        </article>
        <article className="img-zoom hover-lift relative min-h-72 overflow-hidden rounded-[28px]">
          <img src={technicianImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-slate-950/60" />
          <div className="relative p-7 text-white">
            <h2 className="text-3xl font-extrabold">Technician network</h2>
            <p className="mt-3 max-w-md text-sm leading-6 text-slate-200">{data.stats.technicians || 0} approved professionals. Experience levels and service costs are configured by admin.</p>
          </div>
        </article>
      </section>

      {!!offers.length && (
        <section className="mx-auto max-w-6xl px-4 py-6">
          <h2 className="text-3xl font-extrabold tracking-tight">Offers</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {offers.slice(0, 3).map((service) => (
              <Link key={service.id} to={`/services/${service.slug}`} className="img-zoom hover-lift overflow-hidden rounded-[28px] bg-white">
                <img src={serviceImage(service)} alt="" className="h-44 w-full object-cover" />
                <div className="p-5">
                  <p className="text-xs font-bold uppercase text-amber-700">Save {inr(service.discount_amount)}</p>
                  <h3 className="mt-2 text-lg font-extrabold">{service.name}</h3>
                  <p className="mt-2 font-bold">{inr(service.final_price)}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section id="faq" className="mx-auto max-w-3xl px-4 py-10">
        <h2 className="text-3xl font-extrabold tracking-tight">FAQ</h2>
        <div className="mt-5 space-y-3">
          {faqs.map((faq) => (
            <details key={faq.q} className="group rounded-[24px] bg-white p-4 transition hover:shadow-lg">
              <summary className="cursor-pointer font-bold">{faq.q}</summary>
              <p className="mt-2 text-sm leading-6 text-slate-600">{faq.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="px-4 pb-16">
        <div className="relative mx-auto overflow-hidden rounded-[32px] bg-slate-950 px-6 py-10 text-white md:px-10">
          <img src={heroImage} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />
          <div className="relative flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
            <div>
              <h2 className="text-3xl font-extrabold">Need something fixed today?</h2>
              <p className="mt-2 text-slate-200">Choose a service and confirm the exact spot on the map.</p>
            </div>
            <Link to="/services" className="rounded-2xl bg-white px-5 py-3 font-extrabold text-slate-900 transition hover:scale-105">Book a service</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
