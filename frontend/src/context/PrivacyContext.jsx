import { createContext, useContext, useEffect, useState } from 'react';

const STORAGE_KEY = 'ledger:balances-hidden';
const PrivacyContext = createContext(null);

export function PrivacyProvider({ children }) {
  // Hidden by default, per-device — nothing here is sent to the server.
  const [hidden, setHidden] = useState(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      return stored === null ? true : stored === 'true';
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(hidden));
    } catch {
      // localStorage unavailable (private browsing, etc.) — state still works for this session
    }
  }, [hidden]);

  const toggle = () => setHidden((h) => !h);

  return <PrivacyContext.Provider value={{ hidden, toggle }}>{children}</PrivacyContext.Provider>;
}

export function usePrivacy() {
  const ctx = useContext(PrivacyContext);
  if (!ctx) throw new Error('usePrivacy must be used within PrivacyProvider');
  return ctx;
}
