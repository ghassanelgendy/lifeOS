import { useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';

// Split out of AuthContext.tsx: a file exporting both a component (AuthProvider) and a
// hook (useAuth) can't be Fast-Refreshed by Vite ("useAuth export is incompatible"), which
// forces a full page reload on every edit to that file during dev. Keeping the hook in its
// own file (which only exports this hook) lets AuthContext.tsx stay a clean component-only
// module and fixes that HMR warning.
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
