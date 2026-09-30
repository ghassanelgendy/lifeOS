import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';
import React from 'react';
import { AuthProvider } from './AuthContext';
import { useAuth } from '../hooks/useAuth';

// Mock Supabase
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signInWithOAuth: vi.fn(),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}));

function Consumer({ onValue }: { onValue: (val: any) => void }) {
  const auth = useAuth();
  onValue(auth);
  return (
    <div>
      <span data-testid="user-id">{auth.user?.id || 'no-user'}</span>
      <span data-testid="loading">{auth.loading ? 'loading' : 'ready'}</span>
    </div>
  );
}

describe('AuthContext offline resilience', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('restores cached offline user synchronously without flashing loading state', () => {
    const cachedSession = {
      session: {
        access_token: 'cached-token',
        refresh_token: 'cached-refresh',
        expires_at: 1000,
        expires_in: 3600,
        token_type: 'bearer',
        user: { id: 'cached-user-123', email: 'test@lifeos.local', user_metadata: {} },
      },
      user: { id: 'cached-user-123', email: 'test@lifeos.local', user_metadata: {} },
      persistedAt: Date.now(),
    };
    localStorage.setItem('lifeos_offline_session', JSON.stringify(cachedSession));

    let authVal: any = null;
    const { getByTestId } = render(
      <AuthProvider>
        <Consumer onValue={(v) => (authVal = v)} />
      </AuthProvider>
    );

    expect(getByTestId('user-id').textContent).toBe('cached-user-123');
    expect(getByTestId('loading').textContent).toBe('ready');
    expect(authVal.user?.id).toBe('cached-user-123');
  });

  it('creates offline user when continueOffline is invoked', async () => {
    let authVal: any = null;
    const { getByTestId } = render(
      <AuthProvider>
        <Consumer onValue={(v) => (authVal = v)} />
      </AuthProvider>
    );

    expect(getByTestId('user-id').textContent).toBe('no-user');

    act(() => {
      authVal.continueOffline('offline-tester@lifeos.local');
    });

    expect(getByTestId('user-id').textContent).not.toBe('no-user');
    expect(authVal.user?.email).toBe('offline-tester@lifeos.local');
    expect(localStorage.getItem('lifeos_offline_session')).toBeTruthy();
  });

  it('clears offline storage on explicit signOut', async () => {
    const cachedSession = {
      session: null,
      user: { id: 'user-to-logout', email: 'logout@test.local', user_metadata: {} },
      persistedAt: Date.now(),
    };
    localStorage.setItem('lifeos_offline_session', JSON.stringify(cachedSession));

    let authVal: any = null;
    const { getByTestId } = render(
      <AuthProvider>
        <Consumer onValue={(v) => (authVal = v)} />
      </AuthProvider>
    );

    expect(getByTestId('user-id').textContent).toBe('user-to-logout');

    await act(async () => {
      await authVal.signOut();
    });

    await waitFor(() => {
      expect(getByTestId('user-id').textContent).toBe('no-user');
      expect(localStorage.getItem('lifeos_offline_session')).toBeNull();
    });
  });
});
