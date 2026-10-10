import { createContext, useEffect, useRef, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { supabase } from '../lib/supabase';
import { queryClient } from '../lib/queryClient';
import { idbClearAll } from '../db/indexedDb';
import { clearInFlightRequests } from '../lib/api-limiter';

const PERSISTED_CACHE_KEY = 'lifeos_query_cache';
const OFFLINE_AUTH_KEY = 'lifeos_offline_session';
const DEFAULT_OFFLINE_USER_ID = '00000000-0000-4000-8000-000000000001';

async function clearAllUserDataCache() {
  // Clear React Query cache
  queryClient.clear();

  // Drop any in-flight/deduped network responses tied to the outgoing session
  clearInFlightRequests();

  // Clear localStorage items
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(PERSISTED_CACHE_KEY);
    window.localStorage.removeItem('lifeos_last_sync_at');
    window.localStorage.removeItem(OFFLINE_AUTH_KEY);
  }

  // Clear ALL IndexedDB stores (critical for preventing data leakage between users)
  void idbClearAll();
}

export interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isOffline: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  continueOffline: (email?: string) => void;
}

export const AuthContext = createContext<AuthState | null>(null);

function getStoredOfflineSession(): { session: Session | null; user: User | null } | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(OFFLINE_AUTH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const session = parsed?.session ?? null;
    const user = parsed?.user ?? session?.user ?? null;
    if (user && typeof user === 'object' && user.id) {
      return { session, user: user as User };
    }
  } catch {}
  return null;
}

function persistOfflineSession(session: Session | null, user: User | null): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    if (user || session) {
      const payload = {
        session,
        user: user || session?.user || null,
        persistedAt: Date.now(),
      };
      window.localStorage.setItem(OFFLINE_AUTH_KEY, JSON.stringify(payload));
    }
  } catch (err) {
    console.warn('[Auth] Failed to persist offline session:', err);
  }
}

function clearOfflineSession(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.removeItem(OFFLINE_AUTH_KEY);
  } catch {}
}

function createOfflineUser(email?: string, id?: string): { user: User; session: Session } {
  const userId = id || DEFAULT_OFFLINE_USER_ID;
  const userEmail = email && email.trim() ? email.trim() : 'ghesso@best.com';
  const offlineUser: User = {
    id: userId,
    email: userEmail,
    aud: 'authenticated',
    role: 'authenticated',
    app_metadata: { provider: 'offline' },
    user_metadata: { name: userEmail.split('@')[0] || 'LifeOS User' },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const offlineSession: Session = {
    access_token: 'offline-token',
    refresh_token: 'offline-refresh-token',
    expires_in: 315360000, // 10 years
    expires_at: Math.floor(Date.now() / 1000) + 315360000,
    token_type: 'bearer',
    user: offlineUser,
  };
  return { user: offlineUser, session: offlineSession };
}

function tryGetLocalSession(): Session | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    // Check known Supabase token key patterns
    const keys = Object.keys(localStorage);
    const authKeys = keys.filter(
      (k) => (k.startsWith('sb-') && k.endsWith('-auth-token')) || k.includes('-auth-token') || k.startsWith('supabase.auth.token')
    );
    for (const authKey of authKeys) {
      const raw = localStorage.getItem(authKey);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
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
  // Synchronous initialization prevents flash of loading/login screen on offline refresh
  const initialOffline = getStoredOfflineSession();
  const initialLocal = initialOffline?.session || tryGetLocalSession();
  const initialUser = initialOffline?.user || initialLocal?.user || null;

  const [user, setUser] = useState<User | null>(initialUser);
  const [session, setSession] = useState<Session | null>(initialLocal);
  const [loading, setLoading] = useState<boolean>(() => !initialUser);
  const [isOffline, setIsOffline] = useState<boolean>(() => (typeof navigator !== 'undefined' ? !navigator.onLine : false));

  const previousUserIdRef = useRef<string | null>(initialUser?.id ?? null);
  const explicitSignOutRef = useRef<boolean>(false);

  // Monitor network connection status
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    // ── Immediate offline bootstrap ──────────────────────────────────────────
    // If we have an existing offline or local session, persist and activate it immediately.
    const offlineRecord = getStoredOfflineSession();
    const localSess = offlineRecord?.session || tryGetLocalSession();
    const localUsr = offlineRecord?.user || localSess?.user || null;

    if (localUsr) {
      setUser(localUsr);
      setSession(localSess);
      previousUserIdRef.current = localUsr.id;
      persistOfflineSession(localSess, localUsr);
      setLoading(false);
    }

    // ── Background validation / refresh with generous timeout ────────────────
    // Never wipe an existing session on timeout / network error / offline!
    getSessionWithTimeout(15000)
      .then(({ data: { session: s }, error }) => {
        if (explicitSignOutRef.current) return;

        if (error) {
          // Network timeout, rate limit, or offline failure: KEEP existing offline session!
          console.warn('[Auth] Supabase getSession error (likely offline, keeping active session):', error);
          return;
        }

        if (s?.user) {
          setSession(s);
          setUser(s.user);
          previousUserIdRef.current = s.user.id;
          persistOfflineSession(s, s.user);
        } else {
          // Supabase returned null session. Check if offline or if we have an active offline session
          const onlineNow = typeof navigator !== 'undefined' ? navigator.onLine : false;
          const currentOffline = getStoredOfflineSession();
          if (onlineNow && !currentOffline?.user && !localUsr) {
            setSession(null);
            setUser(null);
            previousUserIdRef.current = null;
          } else if (currentOffline?.user) {
            // Retain cached offline user
            setUser(currentOffline.user);
            setSession(currentOffline.session);
            previousUserIdRef.current = currentOffline.user.id;
          }
        }
      })
      .catch((_err) => {
        // Network timeout / offline / limiter pause:
        // Retain current session and user. Do NOT log the user out!
        const currentOffline = getStoredOfflineSession();
        if (currentOffline?.user) {
          setUser(currentOffline.user);
          setSession(currentOffline.session);
          previousUserIdRef.current = currentOffline.user.id;
        }
      })
      .finally(() => setLoading(false));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, s) => {
      // If user explicitly signed out, perform complete teardown
      if (explicitSignOutRef.current) {
        setSession(null);
        setUser(null);
        previousUserIdRef.current = null;
        return;
      }

      if (s?.user) {
        const nextUserId = s.user.id;
        const prevUserId = previousUserIdRef.current;
        setSession(s);
        setUser(s.user);
        persistOfflineSession(s, s.user);

        // Keep extension sync token fresh in localStorage
        if (s.access_token && typeof window !== 'undefined') {
          try {
            const syncData = JSON.parse(window.localStorage.getItem('lifeos_extension_sync') || '{}');
            window.localStorage.setItem('lifeos_extension_sync', JSON.stringify({
              ...syncData,
              accessToken: s.access_token,
              refreshToken: s.refresh_token || syncData.refreshToken || '',
              userId: s.user.id || '',
              userEmail: s.user.email || '',
              syncedAt: new Date().toISOString(),
            }));
          } catch {}
        }

        // Clear cache only when switching from one valid user to a DIFFERENT valid user.
        if (prevUserId && nextUserId && prevUserId !== nextUserId) {
          previousUserIdRef.current = nextUserId;
          void clearAllUserDataCache();
        } else if (nextUserId) {
          previousUserIdRef.current = nextUserId;
        }
        return;
      }

      // If s is null: Supabase emits INITIAL_SESSION or SIGNED_OUT when offline or when
      // an expired JWT refresh fails over network. If the user didn't explicitly sign out,
      // and we are offline OR have a stored session, DO NOT WIPE THE USER!
      const onlineNow = typeof navigator !== 'undefined' ? navigator.onLine : false;
      const cached = getStoredOfflineSession();
      if (!onlineNow || cached?.user) {
        console.info(`[Auth] Retaining offline session despite Supabase ${event} event.`);
        if (cached?.user) {
          setUser((prev) => prev || cached.user);
          setSession((prev) => prev || cached.session);
        }
        return;
      }

      // Only if truly online, with no stored session, and no user:
      setSession(null);
      setUser(null);
      previousUserIdRef.current = null;
    });

    return () => subscription.unsubscribe();
  }, []);

  const continueOffline = (email?: string) => {
    explicitSignOutRef.current = false;
    const stored = getStoredOfflineSession();
    if (stored?.user) {
      setUser(stored.user);
      setSession(stored.session);
      previousUserIdRef.current = stored.user.id;
      setLoading(false);
      return;
    }

    const { user: offUser, session: offSession } = createOfflineUser(email);
    setUser(offUser);
    setSession(offSession);
    previousUserIdRef.current = offUser.id;
    persistOfflineSession(offSession, offUser);
    setLoading(false);
  };

  const signIn = async (email: string, password: string) => {
    explicitSignOutRef.current = false;
    const onlineNow = typeof navigator !== 'undefined' ? navigator.onLine : false;

    // If completely offline, authenticate directly with offline workspace
    if (!onlineNow) {
      continueOffline(email);
      return { error: null };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        // If network failure occurs during sign in, fall back to offline workspace
        const msg = (error.message || '').toLowerCase();
        if (msg.includes('fetch') || msg.includes('network') || msg.includes('failed') || (error as any).status === 0) {
          console.warn('[Auth] Network unreachable during sign in, falling back to offline mode.');
          continueOffline(email);
          return { error: null };
        }
        return { error: error as Error | null };
      }

      if (data.session && data.user) {
        persistOfflineSession(data.session, data.user);
      }
      return { error: null };
    } catch (err: any) {
      // Uncaught network failure: seamless offline fallback
      console.warn('[Auth] Unexpected error during sign in, falling back to offline mode:', err);
      continueOffline(email);
      return { error: null };
    }
  };

  const signUp = async (email: string, password: string) => {
    explicitSignOutRef.current = false;
    const onlineNow = typeof navigator !== 'undefined' ? navigator.onLine : false;
    if (!onlineNow) {
      continueOffline(email);
      return { error: null };
    }

    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        const msg = (error.message || '').toLowerCase();
        if (msg.includes('fetch') || msg.includes('network') || (error as any).status === 0) {
          continueOffline(email);
          return { error: null };
        }
        return { error: error as Error | null };
      }
      if (data.session && data.user) {
        persistOfflineSession(data.session, data.user);
      }
      return { error: error as Error | null };
    } catch {
      continueOffline(email);
      return { error: null };
    }
  };

  const signInWithGoogle = async () => {
    explicitSignOutRef.current = false;
    const onlineNow = typeof navigator !== 'undefined' ? navigator.onLine : false;
    if (!onlineNow) {
      continueOffline();
      return { error: null };
    }

    const isNative = Capacitor.isNativePlatform();
    // On native iOS/Android, redirect to custom scheme lifeos://auth/callback so app resumes directly
    const redirectTo = isNative
      ? 'lifeos://auth/callback'
      : typeof window !== 'undefined'
      ? `${window.location.origin}/dashboard`
      : undefined;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
      },
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    explicitSignOutRef.current = true;
    try {
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        await supabase.auth.signOut();
      }
    } catch {}
    clearOfflineSession();
    setSession(null);
    setUser(null);
    previousUserIdRef.current = null;
    await clearAllUserDataCache();
  };

  const value: AuthState = {
    user,
    session,
    loading,
    isOffline,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
    continueOffline,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
