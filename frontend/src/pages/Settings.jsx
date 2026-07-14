import { useState } from 'react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';

export default function Settings() {
  const { user } = useAuth();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold text-ink">Settings</h1>
        <p className="text-slate mt-1">Signed in as @{user?.username}.</p>
      </div>

      <ChangePasswordCard />
      <RecoveryCodeCard />
    </div>
  );
}

function ChangePasswordCard() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    if (form.newPassword !== form.confirm) {
      setError("New passwords don't match.");
      return;
    }
    if (form.newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/auth/change-password', {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      setForm({ currentPassword: '', newPassword: '', confirm: '' });
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not change password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-card border border-line rounded-2xl shadow-sm p-5">
      <h2 className="font-display text-lg font-bold text-ink mb-1">Change password</h2>
      <p className="text-sm text-slate mb-4">You'll stay signed in on this device after changing it.</p>

      <form onSubmit={onSubmit} className="space-y-3 max-w-sm">
        <div>
          <label className="block text-xs font-medium text-ink mb-1">Current password</label>
          <input
            type="password"
            required
            value={form.currentPassword}
            onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
            className="w-full border border-line rounded-xl px-3 py-2 bg-paper text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink mb-1">New password</label>
          <input
            type="password"
            required
            value={form.newPassword}
            onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
            placeholder="At least 8 characters"
            className="w-full border border-line rounded-xl px-3 py-2 bg-paper text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink mb-1">Confirm new password</label>
          <input
            type="password"
            required
            value={form.confirm}
            onChange={(e) => setForm({ ...form, confirm: e.target.value })}
            className="w-full border border-line rounded-xl px-3 py-2 bg-paper text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {error && <p className="text-clay text-sm">{error}</p>}
        {success && <p className="text-ledger text-sm">Password updated.</p>}

        <button
          type="submit"
          disabled={submitting}
          className="bg-primary text-white font-semibold rounded-xl px-4 py-2 text-sm shadow-md shadow-primary/25 hover:bg-primary-dark transition-colors disabled:opacity-60"
        >
          Update password
        </button>
      </form>
    </div>
  );
}

function RecoveryCodeCard() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [newCode, setNewCode] = useState(null);
  const [copied, setCopied] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await api.post('/auth/recovery-code/regenerate', { password });
      setNewCode(res.data.recoveryCode);
      setPassword('');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not generate a new code.');
    } finally {
      setSubmitting(false);
    }
  };

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(newCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API unavailable — the code is still selectable on screen
    }
  };

  return (
    <div className="bg-card border border-line rounded-2xl shadow-sm p-5">
      <h2 className="font-display text-lg font-bold text-ink mb-1">Recovery code</h2>
      <p className="text-sm text-slate mb-4">
        Used to reset your password if you ever forget it. Generating a new one immediately invalidates the old one.
      </p>

      {newCode ? (
        <div className="max-w-sm space-y-3">
          <div className="bg-paper-dim border border-line rounded-xl px-4 py-4 text-center">
            <p className="font-mono mono-num text-lg font-bold text-ink tracking-wider select-all">{newCode}</p>
          </div>
          <button
            type="button"
            onClick={onCopy}
            className="w-full border border-line text-ink font-semibold rounded-xl py-2 text-sm hover:bg-paper-dim transition-colors"
          >
            {copied ? 'Copied!' : 'Copy to clipboard'}
          </button>
          <button
            type="button"
            onClick={() => setNewCode(null)}
            className="w-full text-slate text-xs font-medium hover:underline"
          >
            Done
          </button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3 max-w-sm">
          <div className="flex-1 min-w-[10rem]">
            <label className="block text-xs font-medium text-ink mb-1">Confirm password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-line rounded-xl px-3 py-2 bg-paper text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="border border-line text-ink font-semibold rounded-xl px-4 py-2 text-sm hover:bg-paper-dim transition-colors disabled:opacity-60"
          >
            Generate new code
          </button>
          {error && <p className="text-clay text-sm w-full">{error}</p>}
        </form>
      )}
    </div>
  );
}
