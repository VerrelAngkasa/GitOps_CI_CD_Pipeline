import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Setup from './pages/Setup';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Expenses from './pages/Expenses';
import FixedExpenses from './pages/FixedExpenses';
import Income from './pages/Income';
import Transfers from './pages/Transfers';
import Assets from './pages/Assets';
import Reports from './pages/Reports';

function Gate({ children }) {
  const { user, loading, needsSetup } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <p className="text-slate">Loading…</p>
      </div>
    );
  }
  if (needsSetup) return <Setup />;
  if (!user) return <Login />;
  return children;
}

function AppRoutes() {
  return (
    <Gate>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="expenses" element={<Expenses />} />
          <Route path="fixed-expenses" element={<FixedExpenses />} />
          <Route path="income" element={<Income />} />
          <Route path="transfers" element={<Transfers />} />
          <Route path="assets" element={<Assets />} />
          <Route path="reports" element={<Reports />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Gate>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
