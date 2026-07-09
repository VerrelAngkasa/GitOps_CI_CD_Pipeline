import { currency } from '../lib/api';

// The signature element: headline figures rendered as a bold gradient
// number in the display face, with a colored dot to key the reader in.
export default function StampNumber({ label, value, tone = 'ink', size = 'lg' }) {
  const gradientClass = { ink: 'number-pop', ledger: 'number-pop-positive', clay: 'number-pop-negative' }[tone];
  const dotClass = { ink: 'bg-primary', ledger: 'bg-ledger', clay: 'bg-clay' }[tone];
  const sizeClass = size === 'lg' ? 'text-4xl md:text-5xl' : 'text-2xl md:text-3xl';

  return (
    <div className="inline-block">
      {label && (
        <p className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate mb-2 font-semibold">
          <span className={`w-2 h-2 rounded-full ${dotClass}`} />
          {label}
        </p>
      )}
      <p className={`font-display font-bold ${sizeClass} ${gradientClass} leading-none`}>{currency(value)}</p>
    </div>
  );
}
