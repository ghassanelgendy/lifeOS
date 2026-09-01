import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { queryClient } from '../lib/queryClient';
import { idbClearAll } from '../db/indexedDb';

const PERSISTED_CACHE_KEY = 'lifeos_query_cache';

async function clearAllUserDataCache() {
  // Clear React Query cache
  queryClient.clear();
  
  // Clear localStorage items
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(PERSISTED_CACHE_KEY);
    // Clear offline sync timestamp
    window.localStorage.removeItem('lifeos_last_sync_at');
  }
  
  // Clear ALL IndexedDB stores (critical for preventing data leakage between users)
  void idbClearAll();
}

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

function tryGetLocalSession(): Session | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const key = Object.keys(localStorage).find(
      (k) => k.startsWith('sb-') && k.endsWith('-auth-token')
    );
    if (!key) return null;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.access_token && parsed?.user) {
      return parsed as Session;
    }
  } catch {}
  return null;
}

function getSessionWithTimeout(timeoutMs: number): Promise<{ data: { session: Session | null }; error: Error | null }> {
  return Promise.race([
    supabase.auth.getSession() as Promise<{ data: { session: Session | null }; error: Error | null }>,
    new Promise<{ data: { session: Session | null }; error: Error | null }>((_, reject) =>
      setTimeout(() => reject(new Error('auth_timeout')), timeoutMs)
    ),
  ]);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const previousUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    // ── Immediate offline bootstrap ──────────────────────────────────────────
    // Read session from localStorage immediately so the app can render offline
    // without waiting or hanging on Supabase network calls.
    const localSession = tryGetLocalSession();
    if (localSession) {
      setSession(localSession);
      setUser(localSession.user ?? null);
      previousUserIdRef.current = localSession.user?.id ?? null;
      setLoading(false);
    }

    // ── Background validation / refresh with hard timeout ────────────────────
    getSessionWithTimeout(5000)
      .then(({ data: { session: s } }) => {
        if (s) {
          setSession(s);
          setUser(s.user ?? null);
          previousUserIdRef.current = s.user?.id ?? null;
        } else if (!localSession) {
          setSession(null);
          setUser(null);
          previousUserIdRef.current = null;
        }
      })
      .catch(() => {
        // If we don't have a local session, clear out state
        if (!localSession) {
          setSession(null);
          setUser(null);
          previousUserIdRef.current = null;
        }
      })
      .finally(() => setLoading(false));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, s) => {
      const nextUserId = s?.user?.id ?? null;
      const prevUserId = previousUserIdRef.current;
      setSession(s);
      setUser(s?.user ?? null);

      // Keep extension sync token fresh in localStorage
      if (s?.access_token && typeof window !== 'undefined') {
        try {
          const syncData = JSON.parse(window.localStorage.getItem('lifeos_extension_sync') || '{}');
          window.localStorage.setItem('lifeos_extension_sync', JSON.stringify({
            ...syncData,
            accessToken: s.access_token,
            refreshToken: s.refresh_token || syncData.refreshToken || '',
            userId: s.user?.id || '',
            userEmail: s.user?.email || '',
            syncedAt: new Date().toISOString(),
          }));
        } catch (e) {}
      }

      // Clear cache only when the logged-in user actually changes (switch account or logout)
      if (prevUserId !== nextUserId) {
        previousUserIdRef.current = nextUserId;
        // Clear all caches including IndexedDB to prevent data leakage
        void clearAllUserDataCache();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return { error: error as Error | null };
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/dashboard` : undefined,
      },
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    // Clear all caches including IndexedDB to prevent data leakage between users
    await clearAllUserDataCache();
  };

  const value: AuthState = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
