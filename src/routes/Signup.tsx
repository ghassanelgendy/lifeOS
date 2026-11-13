import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui';
import { cn } from '../lib/utils';
import { AuthShell, EmailField, GoogleBlock, NameField, PasswordChecklist, PasswordField, SubmitButton, quietLink, useEnter } from '../components/auth/AuthShell';
import { usePublicLang } from '../components/landing/i18n';
import { checkPassword, isPasswordAcceptable } from '../lib/passwordRules';

const DEMO_EMAIL = 'ghesso@best.com';

type Busy = 'password' | 'google' | null;

export default function Signup() {
  const { signUp, signInWithGoogle, continueOffline } = useAuth();
  const navigate = useNavigate();
  const { t } = usePublicLang();
  const c = t.auth.signup;
  const enter = useEnter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);

  const checks = checkPassword(password, { email, name });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    // The button stays enabled; pressing it early says what is missing.
    if (!name.trim()) {
      setError(c.nameMissing);
      return;
    }
    if (!isPasswordAcceptable(password, { email, name })) {
      setError(c.tooShort);
      return;
    }
    setBusy('password');
    const { error: err } = await signUp(email.trim(), password, name.trim());
    setBusy(null);
    if (err) {
      setError(err.message ?? c.failed);
      return;
    }
    setRegisteredEmail(email.trim());
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setBusy('google');
    const { error: err } = await signInWithGoogle();
    setBusy(null);
    if (err) setError(err.message ?? t.auth.login.googleFailed);
  };

  const handleContinueOffline = () => {
    continueOffline(email.trim() || DEMO_EMAIL);
    navigate('/dashboard', { replace: true });
  };

  if (registeredEmail) {
    return (
      <AuthShell title={c.sentTitle} lead={c.sentLead}>
        <motion.div {...enter(1)}>
          <p className="mt-1 flex items-center gap-2 break-all text-base font-semibold" dir="ltr">
            <Mail size={18} className="shrink-0 text-muted-foreground" />
            {registeredEmail}
          </p>
          <ol className="mt-6 space-y-3">
            {c.steps.map((step, i) => (
              <li key={step} className="flex gap-3 text-sm leading-relaxed text-muted-foreground">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border text-[13px] font-semibold tabular-nums text-foreground">{i + 1}</span>
                {step}
              </li>
            ))}
          </ol>
          <p className="mt-5 text-sm text-muted-foreground">{c.sentNote}</p>
          <Button className="mt-6 min-h-[46px] w-full text-base" onClick={() => navigate('/login', { replace: true })}>
            {c.sentCta}
          </Button>
        </motion.div>
      </AuthShell>
    );
  }

  const locked = busy !== null;

  return (
    <AuthShell title={c.title} lead={c.lead}>
      <motion.div {...enter(1)} className="mt-8">
        <GoogleBlock onClick={handleGoogleSignIn} busy={busy === 'google'} disabled={locked} />

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <NameField value={name} onChange={setName} disabled={locked} />
          <EmailField value={email} onChange={setEmail} disabled={locked} />
          <div>
            <PasswordField value={password} onChange={setPassword} disabled={locked} autoComplete="new-password" describedBy="password-rule" />
            <PasswordChecklist id="password-rule" checks={checks} started={password.length > 0} />
          </div>

          {error && (
            <p role="alert" className="rounded-lg border border-destructive/40 px-3 py-2.5 text-sm font-medium text-destructive" dir="auto">
              {error}
            </p>
          )}

          <SubmitButton busy={busy === 'password'} busyLabel={c.busy} disabled={locked}>{c.submit}</SubmitButton>
        </form>
      </motion.div>

      <motion.div {...enter(2)}>
        <button type="button" className={cn(quietLink, 'mt-3')} disabled={locked} onClick={handleContinueOffline}>
          {t.auth.offline}
        </button>
        <p className="mt-3 border-t border-border pt-5 text-sm text-muted-foreground">
          {c.switchPrompt}{' '}
          <Link to="/login" className="font-semibold text-foreground underline-offset-4 hover:underline">
            {c.switchLink}
          </Link>
        </p>
      </motion.div>
    </AuthShell>
  );
}
