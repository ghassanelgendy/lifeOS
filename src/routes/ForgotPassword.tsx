import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MailCheck } from 'lucide-react';
import { AuthShell, EmailField, SubmitButton, useEnter } from '../components/auth/AuthShell';
import { usePublicLang } from '../components/landing/i18n';
import { requestPasswordReset } from '../lib/accountSecurity';

export default function ForgotPassword() {
  const { t } = usePublicLang();
  const c = t.auth.recover;
  const enter = useEnter();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error: err } = await requestPasswordReset(email);
    setBusy(false);
    // Say the same thing whether or not the account exists, so the form cannot be used to probe emails.
    if (err && !/user.*not.*found/i.test(err)) {
      setError(err);
      return;
    }
    setSent(true);
  };

  if (sent) {
    return (
      <AuthShell title={c.sentTitle} lead="">
        <motion.div {...enter(1)} className="mt-6">
          <MailCheck size={28} className="text-foreground" aria-hidden />
          <p className="mt-4 text-base leading-relaxed">
            {c.sentLead} <span dir="ltr" className="font-semibold">{email.trim()}</span> {c.sentTail}
          </p>
          <Link to="/login" className="mt-6 inline-block font-semibold underline-offset-4 hover:underline">{c.back}</Link>
        </motion.div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={c.forgotTitle} lead={c.forgotLead}>
      <motion.form {...enter(1)} onSubmit={submit} className="mt-8 space-y-4">
        <EmailField value={email} onChange={setEmail} disabled={busy} />
        {error && <p role="alert" className="rounded-lg border border-destructive/40 px-3 py-2.5 text-sm font-medium text-destructive" dir="auto">{error}</p>}
        <SubmitButton busy={busy} busyLabel={c.sending} disabled={busy}>{c.send}</SubmitButton>
        <Link to="/login" className="block pt-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">{c.back}</Link>
      </motion.form>
    </AuthShell>
  );
}
