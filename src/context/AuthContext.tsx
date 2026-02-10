/* ──────────────────────────────────────────────────────────
   HoboSky v0.1.0 — Auth Context
   ────────────────────────────────────────────────────────── */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { api } from '../services/api';
import type { SessionData } from '../types';

interface AuthContextValue {
  session: SessionData | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (identifier: string, password: string, service?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  isLoading: true,
  isAuthenticated: false,
  login: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionData | null>(api.getSession());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsub = api.onSessionChange((s) => setSession(s));

    api.resumeSession().then(() => {
      setSession(api.getSession());
      setIsLoading(false);
    });

    return unsub;
  }, []);

  const login = useCallback(
    async (identifier: string, password: string, service?: string) => {
      await api.login(identifier, password, service);
    },
    []
  );

  const logout = useCallback(async () => {
    await api.logout();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        isLoading,
        isAuthenticated: session !== null,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
