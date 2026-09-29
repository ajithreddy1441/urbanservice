import { useState } from 'react';
import api from '../../services/api';
import { useFetch } from '../../hooks/useFetch';
import SalesChart from '../../components/SalesChart';
import StatCard from '../../components/StatCard';
import Button from '../../components/Button';
import { PageSkeleton } from '../../components/Loading';
import { inr } from '../../utils/format';
import { downloadFile } from '../../utils/download';

const periods = [['daily', 'Daily'], ['weekly', 'Weekly'], ['monthly', 'Monthly'], ['yearly', 'Yearly']];

export default function TechReports() {
  const [period, setPeriod] = useState('daily');
  const { data, loading } = useFetch(async () => (await api.get('/api/technician/reports/sales', { params: { period } })).data.data, [period]);
  if (loading || !data) return <PageSkeleton />;
  const summary = data.summary || {};
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Sales reports</h1>
        <Button size="sm" variant="outline" onClick={() => downloadFile('/api/technician/reports/sales/export', `sales-${period}.csv`, { period })}>Export report</Button>
      </div>
      <div className="flex gap-2 overflow-auto">{periods.map(([value, label]) => <button key={value} className={`rounded-full px-4 py-2 text-sm font-bold ${period === value ? 'bg-slate-900 text-white' : 'bg-white'}`} onClick={() => setPeriod(value)}>{label}</button>)}</div>
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Jobs" value={summary.jobs || 0} />
        <StatCard label="Completed" value={summary.completed || 0} />
        <StatCard label="Total sales" value={inr(summary.sales)} />
        <StatCard label="Earnings" value={inr(summary.earnings)} />
        <StatCard label="Incentive" value={inr(summary.incentive)} />
        <StatCard label="Pending payments" value={summary.pendingPayments || 0} />
      </div>
      <div className="rounded-3xl bg-white p-4">
        <h2 className="mb-2 font-extrabold">Earnings trend</h2>
        <SalesChart data={data.trend || []} y="earnings" kind="line" />
      </div>
      <div className="rounded-3xl bg-white p-4">
        <h2 className="mb-2 font-extrabold">Jobs completed</h2>
        <SalesChart data={data.trend || []} y="jobs" />
      </div>
    </div>
  );
}
