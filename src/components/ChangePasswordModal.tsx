import { useEffect, useState } from 'react';
import { Check, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button, Input, Modal } from './ui';
import { toast } from './ui/Toast';
import { PasswordChecklist } from './auth/AuthShell';
import { checkPassword, isPasswordAcceptable } from '../lib/passwordRules';
import { requestPasswordReset, sendReauthCode, signOutOtherDevices, updatePassword } from '../lib/accountSecurity';

type Step = 'form' | 'code' | 'done';

function SecretInput({ label, value, onChange, autoComplete, error, autoFocus }: {
  label: string; value: string; onChange: (v: string) => void; autoComplete: 'current-password' | 'new-password'; error?: string; autoFocus?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input label={label} type={show ? 'text' : 'password'} autoComplete={autoComplete} dir="ltr" className="h-11 pr-11" value={value} onChange={(e) => onChange(e.target.value)} error={error} autoFocus={autoFocus} />
      <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}
        className="absolute right-0 top-[22px] flex size-11 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground">
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}

/** Change (or first set) a password: current password, new password with live rules, then a clear done state. */
export function ChangePasswordModal({ isOpen, onClose, email, name, hasPassword }: {
  isOpen: boolean; onClose: () => void; email: string; name: string; hasPassword: boolean;
}) {
  const [step, setStep] = useState<Step>('form');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [code, setCode] = useState('');
  const [others, setOthers] = useState(true);
  const [busy, setBusy] = useState(false);
  const [currentError, setCurrentError] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) { setStep('form'); setCurrent(''); setNext(''); setCode(''); setOthers(true); setCurrentError(undefined); setError(null); }
  }, [isOpen]);

  const checks = checkPassword(next, { email, name });
  const ready = isPasswordAcceptable(next, { email, name }) && (!hasPassword || current.length > 0) && (!hasPassword || next !== current);

  const finish = async () => {
    if (others) await signOutOtherDevices();
    setStep('done');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true); setError(null); setCurrentError(undefined);
    const r = await updatePassword(next, { currentPassword: hasPassword ? current : undefined, nonce: step === 'code' ? code : undefined });
    if (r.needsNonce && step === 'form') {
      const sent = await sendReauthCode();
      setBusy(false);
      if (sent.error) { setError(sent.error); return; }
      setStep('code');
      return;
    }
    if (r.error) {
      setBusy(false);
      if (r.wrongCurrent) setCurrentError('That is not your current password');
      else setError(r.error);
      return;
    }
    await finish();
    setBusy(false);
  };

  const forgot = async () => {
    const r = await requestPasswordReset(email);
    r.error ? toast.error(r.error) : toast.show(`Reset link sent to ${email}`);
  };

  return (
    <Modal isOpen={isOpen} onClose={() => !busy && onClose()} title={hasPassword ? 'Change password' : 'Set a password'}>
      {step === 'done' ? (
        <div className="space-y-4 py-2 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-500 text-white"><Check size={24} aria-hidden /></span>
          <p className="text-lg font-semibold">Password updated</p>
          <p className="text-sm text-muted-foreground">{others ? 'Your other devices were signed out.' : 'Your other devices stay signed in.'}</p>
          <Button type="button" className="w-full" onClick={onClose}>Done</Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {step === 'form' ? (
            <>
              {hasPassword && (
                <div className="space-y-1.5">
                  <SecretInput label="Current password" value={current} onChange={(v) => { setCurrent(v); setCurrentError(undefined); }} autoComplete="current-password" error={currentError} autoFocus />
                  <button type="button" onClick={() => void forgot()} className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">Forgot it? Email me a reset link</button>
                </div>
              )}
              <div>
                <SecretInput label="New password" value={next} onChange={setNext} autoComplete="new-password" autoFocus={!hasPassword} />
                <PasswordChecklist checks={checks} id="change-pw-rules" started={next.length > 0} />
                {hasPassword && next.length > 0 && next === current && <p className="mt-2 text-sm text-destructive">The new password must be different from the current one.</p>}
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" checked={others} onChange={(e) => setOthers(e.target.checked)} className="size-4 accent-current" />
                Sign out my other devices
              </label>
            </>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">For your safety we emailed a 6-digit code to <span dir="ltr" className="font-semibold text-foreground">{email}</span>. Enter it to finish.</p>
              <Input label="Code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} dir="ltr" className="h-11 text-center text-lg tracking-[0.4em]" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} autoFocus />
            </div>
          )}
          {error && <p role="alert" className="rounded-lg border border-destructive/40 px-3 py-2.5 text-sm font-medium text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" disabled={busy} onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={!ready || busy || (step === 'code' && code.length !== 6)}>
              {busy ? <span className="flex items-center gap-2"><Loader2 size={16} className="animate-spin" />Saving</span> : step === 'code' ? 'Confirm' : hasPassword ? 'Change password' : 'Set password'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
