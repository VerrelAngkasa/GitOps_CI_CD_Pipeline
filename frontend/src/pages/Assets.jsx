import { useEffect, useState } from 'react';
import api, { currency, ASSET_TYPES } from '../lib/api';

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function Assets() {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', type: 'bank', notes: '', initialValue: '', date: todayISO() });
  const [submitting, setSubmitting] = useState(false);
  const [updatingAsset, setUpdatingAsset] = useState(null);

  const load = () => {
    setLoading(true);
    api.get('/assets').then((res) => {
      setAssets(res.data);
      setLoading(false);
    });
  };

  useEffect(load, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name) {
      setError('Give the asset a name.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/assets', form);
      setForm({ name: '', type: 'bank', notes: '', initialValue: '', date: todayISO() });
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not save asset.');
    } finally {
      setSubmitting(false);
    }
  };

  const onArchive = async (asset) => {
    await api.put(`/assets/${asset.id}`, { archived: true });
    load();
  };

  const totalAssets = assets.filter((a) => a.currentValue >= 0).reduce((s, a) => s + a.currentValue, 0);
  const totalLiabilities = assets.filter((a) => a.currentValue < 0).reduce((s, a) => s + Math.abs(a.currentValue), 0);

  const grouped = ASSET_TYPES.map((t) => ({
    ...t,
    items: assets.filter((a) => a.type === t.value),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-medium text-ink">Assets</h1>
        <p className="text-slate mt-1">Track what you own and owe. Update values whenever a balance changes.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-card border border-line rounded-lg p-4">
          <p className="text-xs uppercase tracking-wider text-slate font-medium mb-2">Total assets</p>
          <p className="font-mono mono-num text-2xl font-semibold text-ledger">{currency(totalAssets)}</p>
        </div>
        <div className="bg-card border border-line rounded-lg p-4">
          <p className="text-xs uppercase tracking-wider text-slate font-medium mb-2">Total liabilities</p>
          <p className="font-mono mono-num text-2xl font-semibold text-clay">{currency(totalLiabilities)}</p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="bg-card border border-line rounded-lg p-5 grid grid-cols-1 sm:grid-cols-6 gap-3 items-end">
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-ink mb-1">Name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Chase Checking"
            className="w-full border border-line rounded-md px-2.5 py-2 bg-paper text-sm focus:outline-none focus:ring-2 focus:ring-gold"
          />
        </div>
        <div className="sm:col-span-1">
          <label className="block text-xs font-medium text-ink mb-1">Type</label>
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            className="w-full border border-line rounded-md px-2.5 py-2 bg-paper text-sm focus:outline-none focus:ring-2 focus:ring-gold"
          >
            {ASSET_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-1">
          <label className="block text-xs font-medium text-ink mb-1">Value</label>
          <input
            type="number"
            step="0.01"
            value={form.initialValue}
            onChange={(e) => setForm({ ...form, initialValue: e.target.value })}
            placeholder="0.00"
            title="Use a negative number for liabilities like loans"
            className="w-full border border-line rounded-md px-2.5 py-2 bg-paper text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gold"
          />
        </div>
        <div className="sm:col-span-1">
          <label className="block text-xs font-medium text-ink mb-1">As of</label>
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            className="w-full border border-line rounded-md px-2.5 py-2 bg-paper text-sm focus:outline-none focus:ring-2 focus:ring-gold"
          />
        </div>
        <div className="sm:col-span-1">
          <label className="block text-xs font-medium text-ink mb-1">Notes</label>
          <input
            type="text"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Optional"
            className="w-full border border-line rounded-md px-2.5 py-2 bg-paper text-sm focus:outline-none focus:ring-2 focus:ring-gold"
          />
        </div>
        <div className="sm:col-span-6">
          {error && <p className="text-clay text-sm mb-2">{error}</p>}
          <p className="text-xs text-slate mb-2">Tip: enter a negative value for liabilities like loans or credit card debt.</p>
          <button
            type="submit"
            disabled={submitting}
            className="bg-ink text-paper font-medium rounded-md px-4 py-2 text-sm hover:bg-ink-light transition-colors disabled:opacity-60"
          >
            Add asset
          </button>
        </div>
      </form>

      {loading ? (
        <p className="text-slate text-sm">Loading…</p>
      ) : assets.length === 0 ? (
        <p className="text-slate text-sm bg-card border border-line rounded-lg p-6 text-center">
          No assets yet. Add a bank account, cash, or investment above.
        </p>
      ) : (
        <div className="space-y-6">
          {grouped.map((g) => (
            <div key={g.value}>
              <h3 className="text-xs uppercase tracking-wider text-slate font-medium mb-2">{g.label}</h3>
              <div className="bg-card border border-line rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <tbody>
                    {g.items.map((a) => (
                      <tr key={a.id} className="border-t border-line/70 first:border-t-0 hover:bg-paper-dim/50">
                        <td className="px-4 py-3 text-ink font-medium">{a.name}</td>
                        <td className="px-4 py-3 text-slate">{a.notes}</td>
                        <td
                          className={`px-4 py-3 text-right font-mono mono-num font-semibold ${
                            a.currentValue < 0 ? 'text-clay' : 'text-ink'
                          }`}
                        >
                          {currency(a.currentValue)}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <button
                            onClick={() => setUpdatingAsset(a)}
                            className="text-ink text-xs font-medium hover:underline mr-3"
                          >
                            Update value
                          </button>
                          <button onClick={() => onArchive(a)} className="text-clay text-xs font-medium hover:underline">
                            Archive
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {updatingAsset && (
        <UpdateValueModal
          asset={updatingAsset}
          onClose={() => setUpdatingAsset(null)}
          onSaved={() => {
            setUpdatingAsset(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function UpdateValueModal({ asset, onClose, onSaved }) {
  const [value, setValue] = useState('');
  const [date, setDate] = useState(todayISO());
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (value === '' || Number.isNaN(Number(value))) {
      setError('Enter a numeric value.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/assets/${asset.id}/values`, { date, value: Number(value) });
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not save.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center px-4 z-50" onClick={onClose}>
      <div className="bg-card border border-line rounded-lg p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display text-lg font-medium text-ink mb-1">Update value</h3>
        <p className="text-sm text-slate mb-4">{asset.name}</p>
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-ink mb-1">New value</label>
            <input
              type="number"
              step="0.01"
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={String(asset.currentValue)}
              className="w-full border border-line rounded-md px-2.5 py-2 bg-paper text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gold"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink mb-1">As of</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full border border-line rounded-md px-2.5 py-2 bg-paper text-sm focus:outline-none focus:ring-2 focus:ring-gold"
            />
          </div>
          {error && <p className="text-clay text-sm">{error}</p>}
          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-ink text-paper font-medium rounded-md py-2 text-sm hover:bg-ink-light transition-colors disabled:opacity-60"
            >
              Save
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-line text-ink font-medium rounded-md py-2 text-sm hover:bg-paper-dim transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
