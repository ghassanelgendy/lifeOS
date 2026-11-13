import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2, WifiOff } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui';
import { AuthShell, EmailField, GoogleBlock, PasswordField, SubmitButton, quietLink, useEnter } from '../components/auth/AuthShell';
import { usePublicLang } from '../components/landing/i18n';

// Public demo account, for visitors who want to look around before signing up.
const DEMO_EMAIL = 'ghesso@best.com';
const DEMO_PASSWORD = '123';

type Busy = 'password' | 'google' | 'demo' | null;

export default function Login() {
  const { signIn, signInWithGoogle, continueOffline, isOffline } = useAuth();
  const navigate = useNavigate();
  const { t } = usePublicLang();
  const c = t.auth.login;
  const enter = useEnter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Busy>(null);

  const run = async (kind: 'password' | 'demo', mail: string, pass: string) => {
    setError(null);
    setBusy(kind);
    const { error: err } = await signIn(mail, pass);
    setBusy(null);
    if (err) {
      setError(err.message ?? c.failed);
      return;
    }
    navigate('/dashboard', { replace: true });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void run('password', email.trim(), password);
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setBusy('google');
    const { error: err } = await signInWithGoogle();
    setBusy(null);
    if (err) setError(err.message ?? c.googleFailed);
  };

  const handleContinueOffline = () => {
    continueOffline(email.trim() || DEMO_EMAIL);
    navigate('/dashboard', { replace: true });
  };

  const locked = busy !== null;

  return (
    <AuthShell title={c.title} lead={c.lead}>
      {isOffline && (
        <motion.div {...enter(1)} className="mt-6 rounded-xl border border-border bg-card p-4" role="status">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <WifiOff size={16} className="shrink-0 text-amber-500" />
            {c.offlineTitle}
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{c.offlineBody}</p>
          <Button type="button" variant="secondary" className="mt-3 min-h-[44px] w-full" onClick={handleContinueOffline}>
            {c.offlineCta}
          </Button>
        </motion.div>
      )}

      <motion.div {...enter(1)} className="mt-8">
        <GoogleBlock onClick={handleGoogleSignIn} busy={busy === 'google'} disabled={locked} />

        <form onSubmit={handleSubmit} className="space-y-4">
          <EmailField value={email} onChange={setEmail} disabled={locked} />
          <PasswordField value={password} onChange={setPassword} disabled={locked} autoComplete="current-password" describedBy={error ? 'auth-error' : undefined} />

          {error && (
            <div id="auth-error" role="alert" className="rounded-lg border border-destructive/40 px-3 py-2.5 text-sm">
              <p className="font-medium text-destructive" dir="auto">{error}</p>
              <p className="mt-1 text-muted-foreground">{c.verifyHint}</p>
            </div>
          )}

          <SubmitButton busy={busy === 'password'} busyLabel={c.busy} disabled={locked}>{c.submit}</SubmitButton>
        </form>
      </motion.div>

      <motion.div {...enter(2)}>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-6">
          <button type="button" className={quietLink} disabled={locked} onClick={() => void run('demo', DEMO_EMAIL, DEMO_PASSWORD)}>
            {busy === 'demo' ? (
              <span className="flex items-center gap-2">
                <Loader2 size={15} className="animate-spin" />
                {c.demoBusy}
              </span>
            ) : (
              c.demo
            )}
          </button>
          {!isOffline && (
            <button type="button" className={quietLink} disabled={locked} onClick={handleContinueOffline}>
              {t.auth.offline}
            </button>
          )}
        </div>

        <p className="mt-5 border-t border-border pt-5 text-sm text-muted-foreground">
          {c.switchPrompt}{' '}
          <Link to="/signup" className="font-semibold text-foreground underline-offset-4 hover:underline">
            {c.switchLink}
          </Link>
        </p>
      </motion.div>
    </AuthShell>
  );
}
