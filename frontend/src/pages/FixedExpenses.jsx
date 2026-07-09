import { useEffect, useState } from 'react';
import api, { currency, EXPENSE_CATEGORIES } from '../lib/api';

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function FixedExpenses() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    category: EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 2], // Bills & Utilities
    amount: '',
    dayOfMonth: 1,
    startDate: todayISO(),
  });
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    setLoading(true);
    api.get('/fixed-expenses').then((res) => {
      setItems(res.data);
      setLoading(false);
    });
  };

  useEffect(load, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name || !form.amount || Number(form.amount) < 0) {
      setError('Enter a name and a valid amount.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/fixed-expenses', { ...form, amount: Number(form.amount) });
      setForm({ ...form, name: '', amount: '' });
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not save.');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (item) => {
    await api.put(`/fixed-expenses/${item.id}`, { active: !item.active });
    load();
  };

  const onDelete = async (id) => {
    await api.delete(`/fixed-expenses/${id}`);
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const activeTotal = items.filter((i) => i.active).reduce((s, i) => s + i.amount, 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-medium text-ink">Fixed monthly expenses</h1>
        <p className="text-slate mt-1">Rent, subscriptions, insurance — the recurring line items that repeat every month.</p>
      </div>

      <form onSubmit={onSubmit} className="bg-card border border-line rounded-2xl shadow-sm p-5 grid grid-cols-1 sm:grid-cols-6 gap-3 items-end">
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-ink mb-1">Name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Rent"
            className="w-full border border-line rounded-xl px-2.5 py-2 bg-paper text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="sm:col-span-1">
          <label className="block text-xs font-medium text-ink mb-1">Category</label>
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="w-full border border-line rounded-xl px-2.5 py-2 bg-paper text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-1">
          <label className="block text-xs font-medium text-ink mb-1">Amount</label>
          <input
            type="number"
            step="1000"
            min="0"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            placeholder="0"
            className="w-full border border-line rounded-xl px-2.5 py-2 bg-paper text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="sm:col-span-1">
          <label className="block text-xs font-medium text-ink mb-1">Billing day</label>
          <input
            type="number"
            min="1"
            max="28"
            value={form.dayOfMonth}
            onChange={(e) => setForm({ ...form, dayOfMonth: e.target.value })}
            className="w-full border border-line rounded-xl px-2.5 py-2 bg-paper text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="sm:col-span-1">
          <label className="block text-xs font-medium text-ink mb-1">Starts</label>
          <input
            type="date"
            value={form.startDate}
            onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            className="w-full border border-line rounded-xl px-2.5 py-2 bg-paper text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="sm:col-span-6">
          {error && <p className="text-clay text-sm mb-2">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="bg-primary text-white font-semibold rounded-xl px-4 py-2 text-sm shadow-md shadow-primary/25 hover:bg-primary-dark transition-colors disabled:opacity-60"
          >
            Add fixed expense
          </button>
        </div>
      </form>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg font-medium text-ink">Recurring items</h2>
          <p className="text-sm text-slate">
            Active total / month:{' '}
            <span className="font-mono mono-num text-ink font-semibold">{currency(activeTotal)}</span>
          </p>
        </div>

        {loading ? (
          <p className="text-slate text-sm">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-slate text-sm bg-card border border-line rounded-2xl shadow-sm p-6 text-center">
            No fixed expenses yet. Add rent, subscriptions, or bills above.
          </p>
        ) : (
          <div className="bg-card border border-line rounded-2xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="ledger-rule-single text-left text-xs uppercase tracking-wider text-slate">
                  <th className="px-4 py-2.5 font-medium">Name</th>
                  <th className="px-4 py-2.5 font-medium">Category</th>
                  <th className="px-4 py-2.5 font-medium">Day</th>
                  <th className="px-4 py-2.5 font-medium text-right">Amount</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id} className={`border-t border-line/70 hover:bg-paper-dim/50 ${!i.active ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-2.5 text-ink font-medium">{i.name}</td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs bg-paper-dim px-2 py-0.5 rounded-full text-ink">{i.category}</span>
                    </td>
                    <td className="px-4 py-2.5 text-slate">Day {i.day_of_month}</td>
                    <td className="px-4 py-2.5 text-right font-mono mono-num text-ink">{currency(i.amount)}</td>
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => toggleActive(i)}
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          i.active ? 'bg-ledger-light text-ledger' : 'bg-paper-dim text-slate'
                        }`}
                      >
                        {i.active ? 'Active' : 'Paused'}
                      </button>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button onClick={() => onDelete(i.id)} className="text-clay text-xs font-medium hover:underline">
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
