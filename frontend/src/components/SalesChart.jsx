import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import EmptyState from './EmptyState';

export default function SalesChart({ data = [], x = 'label', y = 'total', kind = 'bar', color = '#2563eb' }) {
  if (!data.length) return <EmptyState title="No reports available" text="Sales will appear after payments are recorded." />;
  const Chart = kind === 'line' ? LineChart : BarChart;
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <Chart data={data}>
          <CartesianGrid stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey={x} tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} width={40} />
          <Tooltip />
          {kind === 'line'
            ? <Line type="monotone" dataKey={y} stroke={color} strokeWidth={2.5} dot={false} />
            : <Bar dataKey={y} fill={color} radius={[8, 8, 0, 0]} />}
        </Chart>
      </ResponsiveContainer>
    </div>
  );
}
