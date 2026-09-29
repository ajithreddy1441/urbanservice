import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import LocationPicker from '../components/LocationPicker';
import Button from '../components/Button';
import { errorMessage, formatTime, inr } from '../utils/format';

function slots(settings) {
  const start = Number((settings.slot_start || '08:00').slice(0, 2));
  const end = Number((settings.slot_end || '20:00').slice(0, 2));
  const step = Number(settings.slot_interval || 60) / 60;
  const list = [];
  for (let hour = start; hour < end; hour += step) {
    const h = Math.floor(hour);
    const m = Math.round((hour - h) * 60);
    list.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  }
  return list;
}

export default function BookingPage() {
  const { slug } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [service, setService] = useState(null);
  const [settings, setSettings] = useState({});
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const saved = JSON.parse(sessionStorage.getItem('urban_booking') || '{}');
  const [form, setForm] = useState({
    date: saved.date || '',
    time: saved.time || '',
    method: 'upi',
    payNow: true,
    notes: '',
    address: saved.address || { city: localStorage.getItem('urban_city') || 'Guntur', state: 'Andhra Pradesh', label: 'Home' },
  });

  useEffect(() => {
    Promise.all([api.get(`/api/services/${slug}`), api.get('/api/settings/public')]).then(([serviceRes, settingsRes]) => {
      setService(serviceRes.data.data);
      setSettings(settingsRes.data.data);
    });
  }, [slug]);

  const times = useMemo(() => slots(settings), [settings]);
  const persist = (next) => {
    const value = { ...form, ...next, serviceSlug: slug };
    setForm(value);
    sessionStorage.setItem('urban_booking', JSON.stringify(value));
  };

  const submit = async () => {
    if (!user) {
      persist({});
      navigate(`/login?next=/book/${slug}`);
      return;
    }
    if (user.role !== 'CUSTOMER') {
      toast('Sign in with a customer account to book', 'error');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/api/customer/orders', {
        serviceId: service.id,
        scheduledDate: form.date,
        scheduledTime: form.time,
        address: form.address,
        saveAddress: true,
        paymentMethod: form.method,
        payNow: form.payNow && form.method !== 'cash',
        notes: form.notes,
      });
      sessionStorage.removeItem('urban_booking');
      toast('Booking confirmed', 'success');
      navigate(`/customer/orders/${res.data.data.id}`);
    } catch (error) {
      toast(errorMessage(error), 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!service) return <div className="bg-[var(--canvas)] p-8 text-sm font-semibold text-slate-500">Loading booking...</div>;

  return (
    <div className="min-h-screen bg-[var(--canvas)] px-4 py-6 text-slate-900">
      <div className="mx-auto max-w-xl">
        <p className="text-sm font-bold text-[var(--brand)]">{service.category_name}</p>
        <h1 className="text-3xl font-extrabold">{service.name}</h1>
        <p className="mt-1 text-sm text-slate-500">Step {step + 1} of 3 · {inr(service.final_price)}</p>
        <div className="mt-5 rounded-[28px] bg-white p-4">
          {step === 0 && (
            <div className="space-y-4">
              <label className="block text-sm font-bold">Date
                <input type="date" className="mt-1 h-12 w-full rounded-2xl border border-slate-200 px-3" value={form.date} min={new Date().toISOString().slice(0, 10)} onChange={(e) => persist({ date: e.target.value })} />
              </label>
              <div className="grid grid-cols-3 gap-2">
                {times.map((time) => (
                  <button key={time} type="button" className={`h-11 rounded-2xl text-sm font-bold ${form.time === time ? 'bg-[var(--brand)] text-white' : 'bg-slate-100'}`} onClick={() => persist({ time })}>{formatTime(time)}</button>
                ))}
              </div>
              <Button className="w-full" disabled={!form.date || !form.time} onClick={() => setStep(1)}>Continue</Button>
            </div>
          )}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-extrabold">Confirm exact location</h2>
              <LocationPicker value={form.address} onChange={(address) => persist({ address })} />
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(0)}>Back</Button>
                <Button className="flex-1" disabled={!form.address.latitude || !form.address.city || !form.address.pincode} onClick={() => setStep(2)}>Confirm location</Button>
              </div>
            </div>
          )}
          {step === 2 && (
            <div className="space-y-3 text-sm">
              <h2 className="text-lg font-extrabold">Order summary</h2>
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="font-bold">{service.name}</p>
                <p>{form.date} · {formatTime(form.time)}</p>
                <p className="mt-1">{[form.address.houseNo, form.address.street, form.address.area, form.address.city, form.address.pincode].filter(Boolean).join(', ')}</p>
                <p className="mt-1 text-xs text-slate-500">Lat {form.address.latitude}, Lng {form.address.longitude}</p>
              </div>
              <p className="text-2xl font-extrabold">{inr(service.final_price)}</p>
              <div className="grid grid-cols-2 gap-2">
                {['upi', 'cash', 'card', 'online'].map((method) => (
                  <button key={method} type="button" className={`h-11 rounded-2xl font-bold uppercase ${form.method === method ? 'bg-slate-900 text-white' : 'bg-slate-100'}`} onClick={() => persist({ method })}>{method}</button>
                ))}
              </div>
              {form.method !== 'cash' && (
                <label className="flex items-center gap-2 font-semibold"><input type="checkbox" checked={form.payNow} onChange={(e) => persist({ payNow: e.target.checked })} /> Pay now</label>
              )}
              <textarea className="min-h-20 w-full rounded-2xl border border-slate-200 p-3" placeholder="Notes for the technician" value={form.notes} onChange={(e) => persist({ notes: e.target.value })} />
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
                <Button className="flex-1" loading={loading} onClick={submit}>{user ? 'Confirm booking' : 'Login to book'}</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
