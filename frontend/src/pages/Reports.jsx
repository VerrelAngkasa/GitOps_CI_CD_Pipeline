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
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);

  useEffect(() => {
    api.get('/assets').then((res) => setAssets(res.data));
  }, []);

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

          <QuotaCard report={report} year={year} month={month} assets={assets} onSaved={(updated) => setReport(updated)} />

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
                      <FixedExpenseRow
                        key={f.id}
                        f={f}
                        year={year}
                        month={month}
                        assets={assets}
                        categoryColor={categoryColor}
                        onSaved={(updated) => setReport(updated)}
                      />
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

function QuotaCard({ report, year, month, assets, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [assetId, setAssetId] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const quota = report.quota;
  const spent = quota?.spent ?? 0;
  const spentPct = quota?.amount ? Math.min(100, (spent / quota.amount) * 100) : 0;
  const over = quota && quota.left < 0;

  const startEditing = () => {
    setValue(quota?.amount ? String(quota.amount) : '');
    setAssetId(quota?.assetId ? String(quota.assetId) : '');
    setError('');
    setEditing(true);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const amt = Number(value);
    if (!value || Number.isNaN(amt) || amt < 0) {
      setError('Enter a valid amount.');
      return;
    }
    setSubmitting(true);
    try {
      await api.put('/reports/quota', { year, month, amount: amt, assetId: assetId || null });
      const res = await api.get(`/reports/monthly?year=${year}&month=${month}`);
      onSaved(res.data);
      setEditing(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not save quota.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-card border border-line rounded-2xl shadow-sm p-5">
      <div className="flex items-start justify-between flex-wrap gap-3 mb-3">
        <div>
          <h2 className="font-display text-lg font-bold text-ink">Spending quota</h2>
          {quota?.amount != null && !quota.isExact && (
            <p className="text-xs text-slate mt-0.5">
              Carried forward from {monthLabel(quota.setFor.year, quota.setFor.month)} — set one for this month to
              override it.
            </p>
          )}
          {quota?.amount != null && (
            <p className="text-xs text-slate mt-0.5">
              Tracking: <span className="font-medium text-ink">{quota.assetName || 'all daily expenses'}</span>
            </p>
          )}
        </div>
        {!editing && (
          <button
            onClick={startEditing}
            className="text-primary text-xs font-semibold hover:underline"
          >
            {quota?.amount != null ? 'Edit quota' : 'Set a quota'}
          </button>
        )}
      </div>

      {editing ? (
        <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-ink mb-1">Monthly quota</label>
            <input
              type="number"
              step="1000"
              min="0"
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="e.g. 1500000"
              className="border border-line rounded-xl px-2.5 py-2 bg-paper text-sm font-mono w-48 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink mb-1">Track spending from</label>
            <select
              value={assetId}
              onChange={(e) => setAssetId(e.target.value)}
              className="border border-line rounded-xl px-2.5 py-2 bg-paper text-sm w-52 focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">All daily expenses</option>
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="bg-primary text-white font-semibold rounded-xl px-4 py-2 text-sm shadow-md shadow-primary/25 hover:bg-primary-dark transition-colors disabled:opacity-60"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="border border-line text-ink font-semibold rounded-xl px-4 py-2 text-sm hover:bg-paper-dim transition-colors"
          >
            Cancel
          </button>
          {error && <p className="text-clay text-sm w-full">{error}</p>}
          <p className="text-xs text-slate w-full">
            Pick a pocket to only count daily expenses drawn from that pocket (e.g. your everyday spending account),
            or leave it as "All daily expenses" to count every daily expense regardless of pocket.
          </p>
        </form>
      ) : quota?.amount == null ? (
        <p className="text-slate text-sm">
          No quota set yet for {monthLabel(year, month)}. Set one to track how much you have left to spend.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 mb-3">
            <div>
              <p className="text-xs uppercase tracking-wider text-slate font-semibold mb-1">
                {over ? 'Over by' : 'Left to spend'}
              </p>
              <p className={`font-mono mono-num text-2xl font-bold ${over ? 'text-clay' : 'text-ledger'}`}>
                {currency(Math.abs(quota.left))}
              </p>
            </div>
            <p className="text-sm text-slate">
              <span className="font-mono mono-num text-ink font-semibold">{currency(spent)}</span> of{' '}
              <span className="font-mono mono-num text-ink font-semibold">{currency(quota.amount)}</span>
              <span className="block text-xs text-slate/80 mt-0.5">
                {quota.assetName
                  ? `Daily expenses from ${quota.assetName} only.`
                  : "Daily spending only — fixed bills aren't counted."}
              </span>
            </p>
          </div>
          <div className="h-2.5 w-full bg-paper-dim rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${over ? 'bg-clay' : spentPct > 80 ? 'bg-gold' : 'bg-ledger'}`}
              style={{ width: `${Math.max(4, spentPct)}%` }}
            />
          </div>
        </>
      )}
    </div>
  );
}

function FixedExpenseRow({ f, year, month, assets, categoryColor, onSaved }) {
  const [markingPaid, setMarkingPaid] = useState(false);
  const [assetId, setAssetId] = useState(f.asset_id ? String(f.asset_id) : '');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const refresh = async () => {
    const res = await api.get(`/reports/monthly?year=${year}&month=${month}`);
    onSaved(res.data);
  };

  const onMarkPaid = async (e) => {
    e.preventDefault();
    setError('');
    if (!assetId) {
      setError('Choose a pocket.');
      return;
    }
    setSubmitting(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      await api.post(`/fixed-expenses/${f.id}/pay`, { year, month, date: today, assetId });
      setMarkingPaid(false);
      await refresh();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not mark as paid.');
    } finally {
      setSubmitting(false);
    }
  };

  const onUndo = async () => {
    setSubmitting(true);
    try {
      await api.delete(`/fixed-expenses/${f.id}/pay/${f.payment.id}`);
      await refresh();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <tr className="border-t border-line/70 first:border-t-0">
      <td className="px-4 py-2.5 text-ink font-semibold align-top">{f.name}</td>
      <td className="px-4 py-2.5 align-top">
        <span
          className="text-xs px-2 py-0.5 rounded-full text-white"
          style={{ backgroundColor: categoryColor[f.category] || '#6B7280' }}
        >
          {f.category}
        </span>
      </td>
      <td className="px-4 py-2.5 align-top">
        {f.payment ? (
          <div className="flex items-center gap-2">
            <span className="text-xs bg-ledger-light text-ledger px-2 py-0.5 rounded-full font-medium">
              Paid from {f.payment.assetName}
            </span>
            <button onClick={onUndo} disabled={submitting} className="text-clay text-xs font-medium hover:underline">
              Undo
            </button>
          </div>
        ) : markingPaid ? (
          <form onSubmit={onMarkPaid} className="flex flex-wrap items-center gap-2">
            <select
              value={assetId}
              onChange={(e) => setAssetId(e.target.value)}
              className="border border-line rounded-lg px-2 py-1 bg-paper text-xs focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Choose pocket…</option>
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={submitting}
              className="text-xs bg-primary text-white font-semibold px-2.5 py-1 rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-60"
            >
              Confirm
            </button>
            <button
              type="button"
              onClick={() => setMarkingPaid(false)}
              className="text-xs text-slate hover:underline"
            >
              Cancel
            </button>
            {error && <p className="text-clay text-xs w-full">{error}</p>}
          </form>
        ) : (
          <button
            onClick={() => setMarkingPaid(true)}
            className="text-xs text-primary font-semibold hover:underline"
          >
            Mark as paid
          </button>
        )}
      </td>
      <td className="px-4 py-2.5 text-right font-mono mono-num text-ink align-top">{currency(f.amount)}</td>
    </tr>
  );
}
