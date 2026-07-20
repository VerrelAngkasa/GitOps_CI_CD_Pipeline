import { currency } from '../lib/api';
import { usePrivacy } from '../context/PrivacyContext';

const MASK = 'Rp ••••••';

// Wraps every rendered amount so the global "hide balances" toggle can mask
// it everywhere at once. `prefix`/`suffix` render outside the mask (e.g. a
// "+" sign or "↑" arrow) so they still make sense even when hidden.
export default function Money({ value, className = '', prefix = '', suffix = '' }) {
  const { hidden } = usePrivacy();

  return (
    <span className={className}>
      {prefix}
      {hidden ? <span aria-label="Amount hidden">{MASK}</span> : currency(value)}
      {suffix}
    </span>
  );
}
