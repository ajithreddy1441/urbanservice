import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Button from '../components/Button';
import Field, { areaClass, inputClass } from '../components/Field';
import { errorMessage } from '../utils/format';

export default function TechnicianRegisterPage() {
  const [levels, setLevels] = useState([]);
  const [services, setServices] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState({});
  const { setSession } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/api/services').then((res) => setServices(res.data.data));
    api.get('/api/admin/levels').catch(() => setLevels([
      { id: '', name: 'Assigned after review' },
    ]));
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    const data = new FormData(event.target);
    selected.forEach((id) => data.append('serviceIds', id));
    ['photo', 'govId', 'license'].forEach((key) => { if (files[key]) data.append(key, files[key]); });
    Array.from(files.certificates || []).forEach((file) => data.append('certificates', file));
    try {
      const res = await api.post('/api/auth/register/technician', data);
      setSession(res.data.data);
      toast('Application submitted. An admin will approve your account.', 'success');
      navigate('/technician');
    } catch (error) {
      toast(errorMessage(error), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--canvas)] px-4 py-8">
      <form onSubmit={submit} className="mx-auto max-w-2xl space-y-3 rounded-[28px] bg-white p-5">
        <h1 className="text-3xl font-extrabold">Technician application</h1>
        <p className="text-sm text-slate-500">Admin approval is required before you can receive jobs.</p>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Full name"><input name="name" className={inputClass} required /></Field>
          <Field label="Email"><input name="email" type="email" className={inputClass} required /></Field>
          <Field label="Phone"><input name="phone" className={inputClass} required /></Field>
          <Field label="Password"><input name="password" type="password" className={inputClass} required /></Field>
          <Field label="Date of birth"><input name="dob" type="date" className={inputClass} /></Field>
          <Field label="Experience (years)"><input name="experienceYears" type="number" step="0.5" className={inputClass} /></Field>
          <Field label="Address"><input name="address" className={inputClass} /></Field>
          <Field label="City"><input name="city" className={inputClass} defaultValue="Guntur" /></Field>
          <Field label="State"><input name="state" className={inputClass} defaultValue="Andhra Pradesh" /></Field>
          <Field label="Pincode"><input name="pincode" className={inputClass} /></Field>
          <Field label="UPI ID"><input name="upiId" className={inputClass} /></Field>
          <Field label="Bank name"><input name="bankName" className={inputClass} /></Field>
          <Field label="Account number"><input name="bankAccount" className={inputClass} /></Field>
          <Field label="IFSC"><input name="bankIfsc" className={inputClass} /></Field>
        </div>
        <Field label="About you"><textarea name="bio" className={areaClass} /></Field>
        <Field label="Services you can do">
          <div className="grid max-h-48 gap-2 overflow-auto rounded-2xl border border-slate-200 p-3">
            {services.map((service) => (
              <label key={service.id} className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" checked={selected.includes(service.id)} onChange={(e) => setSelected((cur) => e.target.checked ? [...cur, service.id] : cur.filter((id) => id !== service.id))} />
                {service.name}
              </label>
            ))}
          </div>
        </Field>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Profile photo"><input type="file" accept="image/*" onChange={(e) => setFiles({ ...files, photo: e.target.files[0] })} /></Field>
          <Field label="Government ID"><input type="file" accept="image/*,.pdf" onChange={(e) => setFiles({ ...files, govId: e.target.files[0] })} /></Field>
          <Field label="Driving license"><input type="file" accept="image/*,.pdf" onChange={(e) => setFiles({ ...files, license: e.target.files[0] })} /></Field>
          <Field label="Certificates"><input type="file" accept="image/*,.pdf" multiple onChange={(e) => setFiles({ ...files, certificates: e.target.files })} /></Field>
        </div>
        {levels.length > 0 && <p className="text-xs text-slate-500">Experience level is assigned by admin after review.</p>}
        <Button loading={loading} className="w-full">Submit application</Button>
      </form>
    </div>
  );
}
