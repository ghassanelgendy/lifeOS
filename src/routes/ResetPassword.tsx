import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AuthShell, PasswordChecklist, PasswordField, SubmitButton, useEnter } from '../components/auth/AuthShell';
import { usePublicLang } from '../components/landing/i18n';
import { useAuth } from '../hooks/useAuth';
import { checkPassword, isPasswordAcceptable } from '../lib/passwordRules';
import { updatePassword } from '../lib/accountSecurity';
import { supabase } from '../lib/supabase';

// The emailed link signs the user in with a short recovery session and lands here.
export default function ResetPassword() {
  const { t } = usePublicLang();
  const c = t.auth.recover;
  const s = t.auth.signup;
  const enter = useEnter();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [waited, setWaited] = useState(false);

  // The session is read from the link's hash a moment after load; give it a beat before calling the link bad.
  useEffect(() => {
    const id = window.setTimeout(() => setWaited(true), 2500);
    const { data } = supabase.auth.onAuthStateChange((event) => { if (event === 'PASSWORD_RECOVERY') setWaited(true); });
    return () => { window.clearTimeout(id); data.subscription.unsubscribe(); };
  }, []);

  const checks = checkPassword(password, { email: user?.email ?? '' });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPasswordAcceptable(password, { email: user?.email ?? '' })) { setError(s.tooShort); return; }
    setError(null);
    setBusy(true);
    const res = await updatePassword(password);
    setBusy(false);
    if (res.error) { setError(res.error || c.failed); return; }
    setDone(true);
  };

  if (done) {
    return (
      <AuthShell title={c.doneTitle} lead={c.doneLead}>
        <motion.div {...enter(1)} className="mt-8">
          <button type="button" onClick={() => navigate('/dashboard', { replace: true })} className="min-h-[46px] w-full rounded-lg bg-primary px-4 text-base font-semibold text-primary-foreground">{c.doneCta}</button>
        </motion.div>
      </AuthShell>
    );
  }

  if (!loading && !user && waited) {
    return (
      <AuthShell title={c.resetTitle} lead={c.invalid}>
        <motion.div {...enter(1)} className="mt-8">
          <Link to="/forgot-password" className="font-semibold underline-offset-4 hover:underline">{c.again}</Link>
        </motion.div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={c.resetTitle} lead={c.resetLead}>
      <motion.form {...enter(1)} onSubmit={submit} className="mt-8 space-y-4">
        <PasswordField value={password} onChange={setPassword} disabled={busy || !user} autoComplete="new-password" describedBy="reset-rules" />
        <PasswordChecklist checks={checks} id="reset-rules" started={password.length > 0} />
        {error && <p role="alert" className="rounded-lg border border-destructive/40 px-3 py-2.5 text-sm font-medium text-destructive" dir="auto">{error}</p>}
        <SubmitButton busy={busy} busyLabel={c.saving} disabled={busy || !user}>{c.save}</SubmitButton>
      </motion.form>
    </AuthShell>
  );
}
