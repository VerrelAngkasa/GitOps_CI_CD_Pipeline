import { useEffect, useState } from 'react';
import api, { currency, EXPENSE_CATEGORIES } from '../lib/api';

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function Expenses() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    date: todayISO(),
    category: EXPENSE_CATEGORIES[0],
    description: '',
    amount: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    setLoading(true);
    api.get('/expenses').then((res) => {
      setExpenses(res.data);
      setLoading(false);
    });
  };

  useEffect(load, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.amount || Number(form.amount) < 0) {
      setError('Enter a valid amount.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/expenses', { ...form, amount: Number(form.amount) });
      setForm({ date: todayISO(), category: EXPENSE_CATEGORIES[0], description: '', amount: '' });
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not save expense.');
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async (id) => {
    await api.delete(`/expenses/${id}`);
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  };

  const total = expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-medium text-ink">Daily expenses</h1>
        <p className="text-slate mt-1">Log the day-to-day spending — coffee, snacks, whatever comes up.</p>
      </div>

      <form onSubmit={onSubmit} className="bg-card border border-line rounded-lg p-5 grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
        <div className="sm:col-span-1">
          <label className="block text-xs font-medium text-ink mb-1">Date</label>
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            className="w-full border border-line rounded-md px-2.5 py-2 bg-paper text-sm focus:outline-none focus:ring-2 focus:ring-gold"
          />
        </div>
        <div className="sm:col-span-1">
          <label className="block text-xs font-medium text-ink mb-1">Category</label>
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="w-full border border-line rounded-md px-2.5 py-2 bg-paper text-sm focus:outline-none focus:ring-2 focus:ring-gold"
          >
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-ink mb-1">Name</label>
          <input
            type="text"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Description"
            className="w-full border border-line rounded-md px-2.5 py-2 bg-paper text-sm focus:outline-none focus:ring-2 focus:ring-gold"
          />
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
            className="w-full border border-line rounded-md px-2.5 py-2 bg-paper text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gold"
          />
        </div>
        <div className="sm:col-span-5">
          {error && <p className="text-clay text-sm mb-2">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="bg-ink text-paper font-medium rounded-md px-4 py-2 text-sm hover:bg-ink-light transition-colors disabled:opacity-60"
          >
            Add expense
          </button>
        </div>
      </form>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg font-medium text-ink">Entries</h2>
          <p className="text-sm text-slate">
            Total: <span className="font-mono mono-num text-ink font-semibold">{currency(total)}</span>
          </p>
        </div>

        {loading ? (
          <p className="text-slate text-sm">Loading…</p>
        ) : expenses.length === 0 ? (
          <p className="text-slate text-sm bg-card border border-line rounded-lg p-6 text-center">
            No expenses yet. Add your first one above.
          </p>
        ) : (
          <div className="bg-card border border-line rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="ledger-rule-single text-left text-xs uppercase tracking-wider text-slate">
                  <th className="px-4 py-2.5 font-medium">Date</th>
                  <th className="px-4 py-2.5 font-medium">Category</th>
                  <th className="px-4 py-2.5 font-medium">Description</th>
                  <th className="px-4 py-2.5 font-medium text-right">Amount</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.id} className="border-t border-line/70 hover:bg-paper-dim/50">
                    <td className="px-4 py-2.5 text-ink">{e.date}</td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs bg-paper-dim px-2 py-0.5 rounded-full text-ink">{e.category}</span>
                    </td>
                    <td className="px-4 py-2.5 text-slate">{e.description || '—'}</td>
                    <td className="px-4 py-2.5 text-right font-mono mono-num text-ink">{currency(e.amount)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button onClick={() => onDelete(e.id)} className="text-clay text-xs font-medium hover:underline">
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
