import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import api, { currency, monthLabel } from '../lib/api';
import StampNumber from '../components/StampNumber';

const COLORS = ['#14213D', '#2F5233', '#B23A2E', '#C9A227', '#6B7280', '#8B5E34', '#4A6FA5', '#9C6644'];

const now = new Date();

export default function Reports() {
  const [year, setYear] = useState(now.getUTCFullYear());
  const [month, setMonth] = useState(now.getUTCMonth() + 1);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get(`/reports/monthly?year=${year}&month=${month}`).then((res) => {
      setReport(res.data);
      setLoading(false);
    });
  }, [year, month]);

  const shiftMonth = (delta) => {
    const total = year * 12 + (month - 1) + delta;
    setYear(Math.floor(total / 12));
    setMonth((total % 12) + 1);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-3xl font-medium text-ink">Monthly report</h1>
          <p className="text-slate mt-1">A statement of spending and net worth for the month.</p>
        </div>
        <div className="flex items-center gap-3 bg-card border border-line rounded-lg px-2 py-1.5">
          <button onClick={() => shiftMonth(-1)} className="px-2 py-1 text-ink hover:bg-paper-dim rounded-md">
            ←
          </button>
          <span className="font-display text-sm font-medium text-ink min-w-32 text-center">
            {monthLabel(year, month)}
          </span>
          <button onClick={() => shiftMonth(1)} className="px-2 py-1 text-ink hover:bg-paper-dim rounded-md">
            →
          </button>
        </div>
      </div>

      {loading || !report ? (
        <p className="text-slate">Loading report…</p>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-8">
            <StampNumber label="Net worth, month end" value={report.netWorth.current} size="lg" />
            <div>
              <p className="text-xs uppercase tracking-wider text-slate font-medium mb-2">Change this month</p>
              <p
                className={`font-mono mono-num text-xl font-semibold ${
                  report.netWorth.change >= 0 ? 'text-ledger' : 'text-clay'
                }`}
              >
                {report.netWorth.change >= 0 ? '+' : ''}
                {currency(report.netWorth.change)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-card border border-line rounded-lg p-4">
              <p className="text-xs uppercase tracking-wider text-slate font-medium mb-2">Daily spending</p>
              <p className="font-mono mono-num text-xl font-semibold text-ink">{currency(report.totals.daily)}</p>
            </div>
            <div className="bg-card border border-line rounded-lg p-4">
              <p className="text-xs uppercase tracking-wider text-slate font-medium mb-2">Fixed expenses</p>
              <p className="font-mono mono-num text-xl font-semibold text-ink">{currency(report.totals.fixed)}</p>
            </div>
            <div className="bg-card border border-line rounded-lg p-4">
              <p className="text-xs uppercase tracking-wider text-slate font-medium mb-2">Total spent</p>
              <p className="font-mono mono-num text-xl font-semibold text-clay">{currency(report.totals.combined)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h2 className="font-display text-lg font-medium text-ink mb-4">Spending by category</h2>
              {report.byCategory.length === 0 ? (
                <p className="text-slate text-sm bg-card border border-line rounded-lg p-6 text-center">
                  No spending recorded this month.
                </p>
              ) : (
                <div className="bg-card border border-line rounded-lg p-4 h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={report.byCategory}
                        dataKey="amount"
                        nameKey="category"
                        cx="50%"
                        cy="50%"
                        outerRadius={85}
                        paddingAngle={2}
                      >
                        {report.byCategory.map((entry, i) => (
                          <Cell key={entry.category} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => currency(v)} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div>
              <h2 className="font-display text-lg font-medium text-ink mb-4">Assets, month end</h2>
              <div className="bg-card border border-line rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <tbody>
                    {report.assetBreakdown.length === 0 ? (
                      <tr>
                        <td className="px-4 py-6 text-slate text-center">No assets recorded yet.</td>
                      </tr>
                    ) : (
                      report.assetBreakdown.map((a) => (
                        <tr key={a.id} className="border-t border-line/70 first:border-t-0">
                          <td className="px-4 py-2.5 text-ink">{a.name}</td>
                          <td className="px-4 py-2.5 text-slate text-xs">{a.type}</td>
                          <td
                            className={`px-4 py-2.5 text-right font-mono mono-num ${
                              a.value < 0 ? 'text-clay' : 'text-ink'
                            }`}
                          >
                            {currency(a.value)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div>
            <h2 className="font-display text-lg font-medium text-ink mb-4">Fixed expenses this month</h2>
            <div className="bg-card border border-line rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <tbody>
                  {report.fixedExpenses.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-slate text-center">No fixed expenses applied this month.</td>
                    </tr>
                  ) : (
                    report.fixedExpenses.map((f) => (
                      <tr key={f.id} className="border-t border-line/70 first:border-t-0">
                        <td className="px-4 py-2.5 text-ink font-medium">{f.name}</td>
                        <td className="px-4 py-2.5 text-slate text-xs">{f.category}</td>
                        <td className="px-4 py-2.5 text-right font-mono mono-num text-ink">{currency(f.amount)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h2 className="font-display text-lg font-medium text-ink mb-4">Daily expenses this month</h2>
            {report.dailyExpenses.length === 0 ? (
              <p className="text-slate text-sm bg-card border border-line rounded-lg p-6 text-center">
                No daily expenses logged this month.
              </p>
            ) : (
              <div className="bg-card border border-line rounded-lg overflow-hidden max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <tbody>
                    {report.dailyExpenses.map((e) => (
                      <tr key={e.id} className="border-t border-line/70 first:border-t-0">
                        <td className="px-4 py-2.5 text-ink">{e.date}</td>
                        <td className="px-4 py-2.5">
                          <span className="text-xs bg-paper-dim px-2 py-0.5 rounded-full text-ink">{e.category}</span>
                        </td>
                        <td className="px-4 py-2.5 text-slate">{e.description || '—'}</td>
                        <td className="px-4 py-2.5 text-right font-mono mono-num text-ink">{currency(e.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
