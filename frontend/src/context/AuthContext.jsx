import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const statusRes = await api.get('/auth/setup-status');
      setNeedsSetup(statusRes.data.needsSetup);

      if (!statusRes.data.needsSetup) {
        try {
          const meRes = await api.get('/auth/me');
          setUser(meRes.data);
        } catch {
          setUser(null);
        }
      } else {
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = async (username, password) => {
    const res = await api.post("/auth/login", { username, password });
    setUser(res.data);
  };

  const register = async (username, password, displayName) => {
    const res = await api.post("/auth/register", { username, password, displayName });
    setUser(res.data);
    setNeedsSetup(false);
  };

  const logout = async () => {
    await api.post('/auth/logout');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, needsSetup, login, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
