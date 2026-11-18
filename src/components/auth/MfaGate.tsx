import { useEffect, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Input } from '../ui';
import { AuthShell, SubmitButton, quietLink, useEnter } from './AuthShell';
import { usePublicLang } from '../landing/i18n';
import { useAuth } from '../../hooks/useAuth';
import { needsMfaStep, verifyTotp } from '../../lib/accountSecurity';

/** Holds the app back until a user with two-step verification has entered their code. */
export function MfaGate({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const { t } = usePublicLang();
  const c = t.auth.recover;
  const enter = useEnter();
  const [state, setState] = useState<{ checked: boolean; factorId?: string }>({ checked: false });
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setState({ checked: false });
    // Offline workspaces have no real session, so there is nothing to challenge.
    if (!user || user.app_metadata?.provider === 'offline') { setState({ checked: true }); return; }
    void needsMfaStep().then((r) => { if (alive) setState({ checked: true, factorId: r.needed ? r.factorId : undefined }); });
    return () => { alive = false; };
  }, [user?.id]);

  if (!state.checked) return null;
  if (!state.factorId) return <>{children}</>;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await verifyTotp(state.factorId!, code);
    setBusy(false);
    if (res.error) { setError(c.mfaWrong); setCode(''); return; }
    setState({ checked: true });
  };

  return (
    <AuthShell title={c.mfaTitle} lead={c.mfaLead}>
      <motion.form {...enter(1)} onSubmit={submit} className="mt-8 space-y-4">
        <Input
          label={c.mfaLabel}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          dir="ltr"
          className="h-11 text-center text-lg tracking-[0.4em]"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          autoFocus
          required
          disabled={busy}
        />
        {error && <p role="alert" className="rounded-lg border border-destructive/40 px-3 py-2.5 text-sm font-medium text-destructive" dir="auto">{error}</p>}
        <SubmitButton busy={busy} busyLabel={c.mfaBusy} disabled={busy || code.length !== 6}>{c.mfaVerify}</SubmitButton>
        <button type="button" className={quietLink} onClick={() => void signOut()}>{c.mfaSignOut}</button>
      </motion.form>
    </AuthShell>
  );
}
