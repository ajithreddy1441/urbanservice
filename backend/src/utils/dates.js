export function pad(n) {
  return String(n).padStart(2, '0');
}

export function nowSql(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function todaySql(date = new Date()) {
  return nowSql(date).slice(0, 10);
}

export function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function parseSqlDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const [datePart, timePart = '00:00:00'] = String(value).replace('T', ' ').split(' ');
  const [y, m, d] = datePart.split('-').map(Number);
  const [hh = 0, mm = 0, ss = 0] = timePart.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm, ss);
}

export function startOfWeek(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function startOfYear(date = new Date()) {
  return new Date(date.getFullYear(), 0, 1);
}

export function rangeFor(period, from, to) {
  const now = new Date();
  if (from && to) return { from, to: `${to} 23:59:59` };
  if (period === 'yesterday') {
    const y = addDays(now, -1);
    return { from: todaySql(y), to: `${todaySql(y)} 23:59:59` };
  }
  if (period === 'week' || period === 'this_week') {
    return { from: todaySql(startOfWeek(now)), to: `${todaySql(now)} 23:59:59` };
  }
  if (period === 'last_week') {
    const start = addDays(startOfWeek(now), -7);
    const end = addDays(start, 6);
    return { from: todaySql(start), to: `${todaySql(end)} 23:59:59` };
  }
  if (period === 'month' || period === 'this_month') {
    return { from: todaySql(startOfMonth(now)), to: `${todaySql(now)} 23:59:59` };
  }
  if (period === 'last_month') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return { from: todaySql(start), to: `${todaySql(end)} 23:59:59` };
  }
  if (period === 'year' || period === 'this_year') {
    return { from: todaySql(startOfYear(now)), to: `${todaySql(now)} 23:59:59` };
  }
  if (period === 'today') return { from: todaySql(now), to: `${todaySql(now)} 23:59:59` };
  return { from: todaySql(addDays(now, -30)), to: `${todaySql(now)} 23:59:59` };
}
