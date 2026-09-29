import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Button from '../components/Button';
import Field, { inputClass } from '../components/Field';
import { errorMessage } from '../utils/format';

function destination(role, next) {
  if (next) return next;
  if (role === 'ADMIN') return '/admin';
  if (role === 'TECHNICIAN') return '/technician';
  return '/customer';
}

export default function LoginPage() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const { setSession } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/api/auth/login', form);
      setSession(res.data.data);
      navigate(destination(res.data.data.user.role, params.get('next')));
    } catch (error) {
      toast(errorMessage(error), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-[var(--canvas)] px-4 py-10">
      <form onSubmit={submit} className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-xl">
        <p className="text-sm font-bold text-[var(--brand)]">Welcome back</p>
        <h1 className="mt-1 text-3xl font-extrabold">Log in</h1>
        <div className="mt-5 space-y-3">
          <Field label="Email"><input className={inputClass} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></Field>
          <Field label="Password"><input className={inputClass} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></Field>
        </div>
        <Button className="mt-5 w-full" loading={loading}>Continue</Button>
        <p className="mt-4 text-sm text-slate-500">New customer? <Link className="font-bold text-[var(--brand)]" to="/register">Create an account</Link></p>
        <p className="mt-1 text-sm text-slate-500">Technician? <Link className="font-bold text-[var(--brand)]" to="/technician/register">Apply here</Link></p>
      </form>
    </div>
  );
}
