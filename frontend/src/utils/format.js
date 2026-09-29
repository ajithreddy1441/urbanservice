export function inr(value) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

export function formatDate(value) {
  if (!value) return '';
  const text = String(value).slice(0, 10);
  const [y, m, d] = text.split('-').map(Number);
  if (!y || !m || !d) return text;
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function formatTime(value) {
  if (!value) return '';
  const [h, m] = String(value).slice(0, 5).split(':').map(Number);
  if (Number.isNaN(h)) return String(value);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m || 0).padStart(2, '0')} ${suffix}`;
}

export function mediaUrl(file) {
  if (!file) return '';
  if (String(file).startsWith('http')) return file;
  const base = import.meta.env.VITE_API_URL || '';
  return `${base}${String(file).startsWith('/') ? '' : '/'}${file}`;
}

export function errorMessage(error, fallback = 'Something went wrong. Please try again.') {
  return error?.response?.data?.message || error?.message || fallback;
}

export function todayInput() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
