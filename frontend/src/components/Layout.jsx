import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/expenses', label: 'Daily Expenses' },
  { to: '/fixed-expenses', label: 'Fixed Expenses' },
  { to: '/assets', label: 'Assets' },
  { to: '/reports', label: 'Monthly Report' },
];

export default function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-paper flex">
      <aside className="w-60 shrink-0 border-r border-line bg-card flex flex-col">
        <div className="px-6 py-6 border-b border-line">
          <div className="inline-block stamp px-3 py-1.5 rotate-[-1.5deg]">
            <span className="font-display text-lg font-semibold text-ink">MyLedger</span>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive ? 'bg-ink text-paper' : 'text-ink hover:bg-paper-dim'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="px-4 py-4 border-t border-line">
          <p className="text-xs text-slate mb-2 truncate">{user?.email}</p>
          <button
            onClick={logout}
            className="text-sm text-clay font-medium hover:underline"
          >
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <div className="max-w-5xl mx-auto px-6 py-8 md:px-10 md:py-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
