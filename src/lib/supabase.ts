import { createClient } from '@supabase/supabase-js';
import { installApiLimiter } from './api-limiter';

// Install egress circuit-breaker BEFORE creating the Supabase client
// so the Supabase SDK's internal fetch calls are also gated.
installApiLimiter();

// Access environment variables securely
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
}

// Initialize Supabase client
// You can pass a generic <Database> type here if you have generated types
const storage = typeof window !== 'undefined' ? window.localStorage : undefined;

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    ...(storage ? { storage } : {}),
  },
});
