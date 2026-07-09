import { currency } from '../lib/api';

// The signature element: the headline net-worth figure rendered like a
// ledger stamp validating the total, with a tabular mono typeface.
export default function StampNumber({ label, value, tone = 'ink', size = 'lg' }) {
  const toneClasses = {
    ink: 'text-ink border-ink',
    ledger: 'text-ledger border-ledger',
    clay: 'text-clay border-clay',
  }[tone];

  const sizeClasses = size === 'lg' ? 'text-4xl md:text-5xl px-6 py-4' : 'text-2xl px-4 py-2.5';

  return (
    <div className="inline-block">
      {label && <p className="text-xs uppercase tracking-wider text-slate mb-2 font-medium">{label}</p>}
      <div className={`stamp inline-block ${sizeClasses}`}>
        <span className={`font-mono mono-num font-semibold ${toneClasses.split(' ')[0]}`}>{currency(value)}</span>
      </div>
    </div>
  );
}
