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
  await idbClearAll();
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const previousUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    const startedAt = Date.now();
    const MIN_LOADING_MS = 2200;

    supabase.auth.getSession()
      .then(({ data: { session: s } }) => {
        setSession(s);
        setUser(s?.user ?? null);
        previousUserIdRef.current = s?.user?.id ?? null;
      })
      .catch(() => {
        setSession(null);
        setUser(null);
        previousUserIdRef.current = null;
      })
      .finally(() => {
        const elapsed = Date.now() - startedAt;
        const remaining = Math.max(0, MIN_LOADING_MS - elapsed);
        setTimeout(() => setLoading(false), remaining);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      const nextUserId = s?.user?.id ?? null;
      const prevUserId = previousUserIdRef.current;
      setSession(s);
      setUser(s?.user ?? null);
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
        redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/` : undefined,
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
