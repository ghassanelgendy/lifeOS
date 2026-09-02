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
    // Check known Supabase token key patterns
    const keys = Object.keys(localStorage);
    // Supabase JS v2 stores auth token under `sb-${project-ref}-auth-token` or custom keys
    const authKeys = keys.filter(
      (k) => (k.startsWith('sb-') && k.endsWith('-auth-token')) || k.includes('-auth-token') || k.startsWith('supabase.auth.token')
    );
    for (const authKey of authKeys) {
      const raw = localStorage.getItem(authKey);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        // Supabase v2: { access_token, refresh_token, user, ... }
        // Some wrappers / older versions store: { currentSession: { access_token, user } }
        const sessionCandidate = parsed?.currentSession || parsed;
        if (sessionCandidate?.access_token && sessionCandidate?.user) {
          return sessionCandidate as Session;
        }
      } catch {}
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

    // ── Background validation / refresh with generous timeout ────────────────
    // Never wipe an existing valid session on timeout / network error!
    getSessionWithTimeout(15000)
      .then(({ data: { session: s }, error }) => {
        if (error) {
          // An explicit Supabase auth error: only clear if we don't have a local session
          if (!localSession && !tryGetLocalSession()) {
            setSession(null);
            setUser(null);
            previousUserIdRef.current = null;
          }
          return;
        }
        if (s) {
          setSession(s);
          setUser(s.user ?? null);
          previousUserIdRef.current = s.user?.id ?? null;
        } else if (!localSession && !tryGetLocalSession()) {
          // Only clear if neither initial localSession nor current storage has any session
          setSession(null);
          setUser(null);
          previousUserIdRef.current = null;
        }
      })
      .catch((err) => {
        // Network timeout / offline / limiter pause:
        // If we have a local session or any session in localStorage, KEEP IT active. Do NOT log the user out!
        if (!localSession && !tryGetLocalSession()) {
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

      // Clear cache only when switching from one valid user to a DIFFERENT valid user.
      // Do NOT clear cache on cold-boot (null -> user) or transient null refreshes.
      if (prevUserId && nextUserId && prevUserId !== nextUserId) {
        previousUserIdRef.current = nextUserId;
        // Clear all caches including IndexedDB to prevent data leakage between different users
        void clearAllUserDataCache();
      } else if (nextUserId) {
        previousUserIdRef.current = nextUserId;
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
