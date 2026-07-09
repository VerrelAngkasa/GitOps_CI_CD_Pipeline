import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import api, { currency, monthLabel } from '../lib/api';
import StampNumber from '../components/StampNumber';

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    Promise.all([api.get('/reports/summary'), api.get('/reports/networth-history?months=12')]).then(
      ([s, h]) => {
        if (!mounted) return;
        setSummary(s.data);
        setHistory(h.data.map((p) => ({ ...p, label: monthLabel(p.year, p.month).slice(0, 3) })));
        setLoading(false);
      }
    );
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return <p className="text-slate">Loading your ledger…</p>;
  }

  const changePositive = summary.netWorthChange >= 0;

  return (
    <div className="space-y-10">
      <div>
        <p className="text-xs uppercase tracking-wider text-slate font-medium mb-1">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
        <h1 className="font-display text-3xl font-medium text-ink">Your net worth</h1>
      </div>

      <div className="flex flex-wrap items-end gap-8">
        <StampNumber label="Total net worth" value={summary.netWorth} size="lg" />
        <div>
          <p className="text-xs uppercase tracking-wider text-slate font-medium mb-2">Since last month</p>
          <p className={`font-mono mono-num text-xl font-semibold ${changePositive ? 'text-ledger' : 'text-clay'}`}>
            {changePositive ? '+' : ''}
            {currency(summary.netWorthChange)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Assets" value={summary.totalAssets} tone="ledger" />
        <StatCard label="Liabilities" value={summary.totalLiabilities} tone="clay" />
        <StatCard label="Spent this month" value={summary.monthToDateExpenses + summary.monthFixedExpenses} tone="ink" />
      </div>

      <div>
        <h2 className="font-display text-lg font-medium text-ink mb-4">12-month trend</h2>
        <div className="bg-card border border-line rounded-lg p-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={history} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#DCD5C4" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" stroke="#6B7280" fontSize={12} tickLine={false} axisLine={{ stroke: '#DCD5C4' }} />
              <YAxis
                stroke="#6B7280"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `IDR${Math.round(v / 1000)}k`}
                width={60}
              />
              <Tooltip
                formatter={(v) => currency(v)}
                contentStyle={{
                  fontFamily: 'IBM Plex Mono, monospace',
                  fontSize: 13,
                  borderColor: '#DCD5C4',
                  borderRadius: 6,
                }}
              />
              <Line type="monotone" dataKey="netWorth" stroke="#14213D" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, tone }) {
  const toneClass = { ledger: 'text-ledger', clay: 'text-clay', ink: 'text-ink' }[tone];
  return (
    <div className="bg-card border border-line rounded-lg p-4">
      <p className="text-xs uppercase tracking-wider text-slate font-medium mb-2">{label}</p>
      <p className={`font-mono mono-num text-2xl font-semibold ${toneClass}`}>{currency(value)}</p>
    </div>
  );
}
