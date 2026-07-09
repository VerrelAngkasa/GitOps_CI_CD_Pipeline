import { useEffect, useMemo, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Sector } from 'recharts';
import api, { currency, percent, monthLabel } from '../lib/api';
import StampNumber from '../components/StampNumber';

const COLORS = ['#7C5CFC', '#0FA968', '#F0446B', '#F5A524', '#3AB0FF', '#B37CFF', '#FF8A5C', '#41C9B4'];

const now = new Date();

function ActiveSlice(props) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  return (
    <Sector
      cx={cx}
      cy={cy}
      innerRadius={innerRadius}
      outerRadius={outerRadius + 8}
      startAngle={startAngle}
      endAngle={endAngle}
      fill={fill}
    />
  );
}

export default function Reports() {
  const [year, setYear] = useState(now.getUTCFullYear());
  const [month, setMonth] = useState(now.getUTCMonth() + 1);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);

  useEffect(() => {
    setLoading(true);
    setSelectedCategory(null);
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

  const categoryColor = useMemo(() => {
    if (!report) return {};
    const map = {};
    report.byCategory.forEach((c, i) => (map[c.category] = COLORS[i % COLORS.length]));
    return map;
  }, [report]);

  const visibleDaily = useMemo(() => {
    if (!report) return [];
    return selectedCategory ? report.dailyExpenses.filter((e) => e.category === selectedCategory) : report.dailyExpenses;
  }, [report, selectedCategory]);

  const visibleFixed = useMemo(() => {
    if (!report) return [];
    return selectedCategory ? report.fixedExpenses.filter((f) => f.category === selectedCategory) : report.fixedExpenses;
  }, [report, selectedCategory]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink">Monthly report</h1>
          <p className="text-slate mt-1">A statement of spending and net worth for the month.</p>
        </div>
        <div className="flex items-center gap-3 bg-card border border-line rounded-2xl shadow-sm px-2 py-1.5">
          <button onClick={() => shiftMonth(-1)} className="px-2.5 py-1.5 text-ink hover:bg-paper-dim rounded-xl transition-colors">
            ←
          </button>
          <span className="font-display text-sm font-bold text-ink min-w-32 text-center">
            {monthLabel(year, month)}
          </span>
          <button onClick={() => shiftMonth(1)} className="px-2.5 py-1.5 text-ink hover:bg-paper-dim rounded-xl transition-colors">
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
            <div className={`px-3 py-1.5 rounded-full ${report.netWorth.change >= 0 ? 'bg-ledger-light' : 'bg-clay-light'}`}>
              <p className="text-xs uppercase tracking-wider text-slate font-semibold mb-0.5">Change this month</p>
              <p
                className={`font-mono mono-num text-lg font-bold ${
                  report.netWorth.change >= 0 ? 'text-ledger' : 'text-clay'
                }`}
              >
                {report.netWorth.change >= 0 ? '↑ +' : '↓ '}
                {currency(report.netWorth.change)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="card-pop bg-card border border-line rounded-2xl shadow-sm p-4">
              <p className="text-xs uppercase tracking-wider text-slate font-semibold mb-2">Income</p>
              <p className="font-mono mono-num text-xl font-bold text-ledger">{currency(report.totals.income)}</p>
            </div>
            <div className="card-pop bg-card border border-line rounded-2xl shadow-sm p-4">
              <p className="text-xs uppercase tracking-wider text-slate font-semibold mb-2">Daily spending</p>
              <p className="font-mono mono-num text-xl font-bold text-ink">{currency(report.totals.daily)}</p>
            </div>
            <div className="card-pop bg-card border border-line rounded-2xl shadow-sm p-4">
              <p className="text-xs uppercase tracking-wider text-slate font-semibold mb-2">Fixed expenses</p>
              <p className="font-mono mono-num text-xl font-bold text-ink">{currency(report.totals.fixed)}</p>
            </div>
            <div className="card-pop bg-card border border-line rounded-2xl shadow-sm p-4">
              <p className="text-xs uppercase tracking-wider text-slate font-semibold mb-2">Net this month</p>
              <p className={`font-mono mono-num text-xl font-bold ${report.totals.net >= 0 ? 'text-ledger' : 'text-clay'}`}>
                {report.totals.net >= 0 ? '+' : ''}
                {currency(report.totals.net)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h2 className="font-display text-lg font-bold text-ink mb-4">Spending by category</h2>
              {report.byCategory.length === 0 ? (
                <p className="text-slate text-sm bg-card border border-line rounded-2xl shadow-sm p-6 text-center">
                  No spending recorded this month.
                </p>
              ) : (
                <div className="bg-card border border-line rounded-2xl shadow-sm p-4">
                  <div className="relative h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={report.byCategory}
                          dataKey="amount"
                          nameKey="category"
                          cx="50%"
                          cy="50%"
                          innerRadius={62}
                          outerRadius={90}
                          paddingAngle={3}
                          cornerRadius={6}
                          activeIndex={activeIndex}
                          activeShape={ActiveSlice}
                          onMouseEnter={(_, i) => setActiveIndex(i)}
                          onMouseLeave={() => setActiveIndex(null)}
                          onClick={(entry) =>
                            setSelectedCategory((prev) => (prev === entry.category ? null : entry.category))
                          }
                          style={{ cursor: 'pointer' }}
                        >
                          {report.byCategory.map((entry, i) => (
                            <Cell
                              key={entry.category}
                              fill={COLORS[i % COLORS.length]}
                              opacity={selectedCategory && selectedCategory !== entry.category ? 0.35 : 1}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(v) => currency(v)}
                          contentStyle={{
                            fontFamily: 'JetBrains Mono, monospace',
                            fontSize: 13,
                            borderColor: '#E6E1F5',
                            borderRadius: 12,
                            boxShadow: '0 8px 20px -8px rgba(33,31,61,0.25)',
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    {/* Center label sits inside the donut hole */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <p className="text-xs text-slate font-semibold uppercase tracking-wide">
                        {activeIndex !== null ? report.byCategory[activeIndex].category : 'Total'}
                      </p>
                      <p className="font-mono mono-num text-base font-bold text-ink">
                        {currency(activeIndex !== null ? report.byCategory[activeIndex].amount : report.totals.combined)}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mt-4 justify-center">
                    {report.byCategory.map((c, i) => (
                      <button
                        key={c.category}
                        onClick={() => setSelectedCategory((prev) => (prev === c.category ? null : c.category))}
                        className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border transition-all ${
                          selectedCategory === c.category
                            ? 'border-transparent text-white'
                            : 'border-line text-ink hover:bg-paper-dim'
                        }`}
                        style={selectedCategory === c.category ? { backgroundColor: COLORS[i % COLORS.length] } : {}}
                      >
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: COLORS[i % COLORS.length] }}
                        />
                        {c.category}
                      </button>
                    ))}
                  </div>
                  {selectedCategory && (
                    <p className="text-xs text-slate text-center mt-3">
                      Showing entries for <span className="font-semibold text-ink">{selectedCategory}</span> below —
                      tap it again to clear.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div>
              <h2 className="font-display text-lg font-bold text-ink mb-4">Assets, month end</h2>
              <div className="bg-card border border-line rounded-2xl shadow-sm overflow-hidden">
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
                          <td className="px-4 py-2.5 text-right text-xs text-slate font-mono mono-num">
                            {a.value >= 0 ? percent(a.percentage) : ''}
                          </td>
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
            <h2 className="font-display text-lg font-bold text-ink mb-4">Fixed expenses this month</h2>
            <div className="bg-card border border-line rounded-2xl shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <tbody>
                  {visibleFixed.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-slate text-center">
                        {selectedCategory ? `No fixed expenses in ${selectedCategory}.` : 'No fixed expenses applied this month.'}
                      </td>
                    </tr>
                  ) : (
                    visibleFixed.map((f) => (
                      <tr key={f.id} className="border-t border-line/70 first:border-t-0">
                        <td className="px-4 py-2.5 text-ink font-semibold">{f.name}</td>
                        <td className="px-4 py-2.5">
                          <span
                            className="text-xs px-2 py-0.5 rounded-full text-white"
                            style={{ backgroundColor: categoryColor[f.category] || '#6B7280' }}
                          >
                            {f.category}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono mono-num text-ink">{currency(f.amount)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h2 className="font-display text-lg font-bold text-ink mb-4">Daily expenses this month</h2>
            {visibleDaily.length === 0 ? (
              <p className="text-slate text-sm bg-card border border-line rounded-2xl shadow-sm p-6 text-center">
                {selectedCategory ? `No daily expenses in ${selectedCategory}.` : 'No daily expenses logged this month.'}
              </p>
            ) : (
              <div className="bg-card border border-line rounded-2xl shadow-sm overflow-hidden max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <tbody>
                    {visibleDaily.map((e) => (
                      <tr key={e.id} className="border-t border-line/70 first:border-t-0">
                        <td className="px-4 py-2.5 text-ink">{e.date}</td>
                        <td className="px-4 py-2.5">
                          <span
                            className="text-xs px-2 py-0.5 rounded-full text-white"
                            style={{ backgroundColor: categoryColor[e.category] || '#6B7280' }}
                          >
                            {e.category}
                          </span>
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
