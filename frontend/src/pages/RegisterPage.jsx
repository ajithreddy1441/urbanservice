import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Button from '../components/Button';
import Field, { inputClass } from '../components/Field';
import { errorMessage } from '../utils/format';

export default function RegisterPage() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', city: 'Guntur', state: 'Andhra Pradesh', pincode: '', address: '' });
  const [loading, setLoading] = useState(false);
  const { setSession } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/api/auth/register', form);
      setSession(res.data.data);
      toast('Account created', 'success');
      navigate('/customer');
    } catch (error) {
      toast(errorMessage(error), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-[var(--canvas)] px-4 py-10">
      <form onSubmit={submit} className="w-full max-w-md rounded-[28px] bg-white p-6">
        <h1 className="text-3xl font-extrabold">Create account</h1>
        <div className="mt-5 grid gap-3">
          <Field label="Name"><input className={inputClass} value={form.name} onChange={set('name')} required /></Field>
          <Field label="Email"><input className={inputClass} type="email" value={form.email} onChange={set('email')} required /></Field>
          <Field label="Phone"><input className={inputClass} value={form.phone} onChange={set('phone')} required /></Field>
          <Field label="Password" hint="At least 8 characters with letters and numbers"><input className={inputClass} type="password" value={form.password} onChange={set('password')} required /></Field>
          <Field label="Address"><input className={inputClass} value={form.address} onChange={set('address')} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="City"><input className={inputClass} value={form.city} onChange={set('city')} /></Field>
            <Field label="Pincode"><input className={inputClass} value={form.pincode} onChange={set('pincode')} /></Field>
          </div>
        </div>
        <Button className="mt-5 w-full" loading={loading}>Register</Button>
        <p className="mt-4 text-sm">Already registered? <Link to="/login" className="font-bold text-[var(--brand)]">Log in</Link></p>
      </form>
    </div>
  );
}
