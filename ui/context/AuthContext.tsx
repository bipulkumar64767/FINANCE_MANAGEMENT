import { createContext, useContext, useEffect, useState, type ReactNode, useCallback } from 'react';
import type { Profile, UserRole } from '../types';
import {
  login as apiLogin,
  register as apiRegister,
  getMe,
  logout as apiLogout,
  getStoredSession,
  type AuthSession,
} from '../lib/api';

interface AuthContextValue {
  session: AuthSession | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string, phone: string, role: UserRole) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    try {
      const { profile: p } = await getMe();
      setProfile(p);
    } catch (err) {
      console.error('Error fetching profile:', err);
      apiLogout();
      setSession(null);
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    const stored = getStoredSession();
    if (stored) {
      setSession(stored);
      fetchProfile().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [fetchProfile]);

  const signIn = async (email: string, password: string) => {
    try {
      const data = await apiLogin(email, password);
      setSession({ access_token: data.access_token, user: data.user });
      setProfile(data.profile);
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Login failed' };
    }
  };

  const signUp = async (email: string, password: string, fullName: string, phone: string, role: UserRole) => {
    try {
      const data = await apiRegister(email, password, fullName, phone, role);
      setSession({ access_token: data.access_token, user: data.user });
      setProfile(data.profile);
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Registration failed' };
    }
  };

  const signOut = async () => {
    apiLogout();
    setProfile(null);
    setSession(null);
  };

  const refreshProfile = async () => {
    if (session) await fetchProfile();
  };

  return (
    <AuthContext.Provider value={{ session, profile, loading, signIn, signUp, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
