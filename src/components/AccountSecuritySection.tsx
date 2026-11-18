import { useCallback, useEffect, useState } from 'react';
import type { UserIdentity } from '@supabase/supabase-js';
import { Loader2, LogOut, ShieldCheck, Trash2 } from 'lucide-react';
import { Button, Input, Modal } from './ui';
import { toast } from './ui/Toast';
import { UserBlobatar } from './ui/UserBlobatar';
import { useAuth } from '../hooks/useAuth';
import { getDisplayName } from '../lib/utils';
import { ChangePasswordModal } from './ChangePasswordModal';
import {
  DELETE_CONFIRM_WORD, canConfirmDelete, deleteAccount, linkGoogle, listIdentities, listTotpFactors,
  removeTotpFactor, signOutOtherDevices, startTotpEnrollment, unlinkIdentity,
  updateDisplayName, updateEmail, verifyTotp, type TotpEnrollment, type TotpFactor,
} from '../lib/accountSecurity';

function Block({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 border-t border-border pt-5 first:border-t-0 first:pt-0">
      <div>
        <h3 className="font-medium">{title}</h3>
        {hint && <p className="mt-0.5 text-sm text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function Busy({ on, children }: { on: boolean; children: React.ReactNode }) {
  return on ? <span className="flex items-center gap-2"><Loader2 size={16} className="animate-spin" />{children}</span> : <>{children}</>;
}

export function AccountSecuritySection() {
  const { user, signOut } = useAuth();
  const email = user?.email ?? '';
  const offline = user?.app_metadata?.provider === 'offline';

  // ---- name ----
  const [name, setName] = useState(() => getDisplayName(user, ''));
  const [nameBusy, setNameBusy] = useState(false);
  const saveName = async () => {
    setNameBusy(true);
    const r = await updateDisplayName(name);
    setNameBusy(false);
    r.error ? toast.error(r.error) : toast.show('Name saved');
  };

  // ---- password ----
  const [pwOpen, setPwOpen] = useState(false);

  // ---- email ----
  const [newEmail, setNewEmail] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);
  const saveEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailBusy(true);
    const r = await updateEmail(newEmail);
    setEmailBusy(false);
    if (r.error) { toast.error(r.error); return; }
    setNewEmail('');
    toast.show('Check your new inbox to confirm the change');
  };

  // ---- sign-in methods ----
  const [identities, setIdentities] = useState<UserIdentity[]>([]);
  const refreshIdentities = useCallback(async () => {
    const r = await listIdentities();
    if (r.data) setIdentities(r.data);
  }, []);
  const hasGoogle = identities.some((i) => i.provider === 'google');
  const hasPassword = identities.length === 0 || identities.some((i) => i.provider === 'email');
  const unlink = async (i: UserIdentity) => {
    const r = await unlinkIdentity(i);
    if (r.error) { toast.error(r.error); return; }
    toast.show('Sign-in method removed');
    void refreshIdentities();
  };
  const link = async () => {
    const r = await linkGoogle();
    if (r.error) toast.error(r.error);
  };

  // ---- two-step verification ----
  const [factors, setFactors] = useState<TotpFactor[]>([]);
  const [enroll, setEnroll] = useState<TotpEnrollment | null>(null);
  const [code, setCode] = useState('');
  const [mfaBusy, setMfaBusy] = useState(false);
  const refreshFactors = useCallback(async () => {
    const r = await listTotpFactors();
    if (r.data) setFactors(r.data.filter((f) => f.status === 'verified'));
  }, []);
  const beginEnroll = async () => {
    setMfaBusy(true);
    const r = await startTotpEnrollment();
    setMfaBusy(false);
    if (r.error || !r.data) { toast.error(r.error ?? 'Could not start'); return; }
    setEnroll(r.data); setCode('');
  };
  const confirmEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enroll) return;
    setMfaBusy(true);
    const r = await verifyTotp(enroll.factorId, code);
    setMfaBusy(false);
    if (r.error) { toast.error('That code is not right. Try the next one.'); setCode(''); return; }
    setEnroll(null); setCode('');
    toast.show('Two-step verification is on');
    void refreshFactors();
  };
  const cancelEnroll = async () => {
    if (enroll) await removeTotpFactor(enroll.factorId);
    setEnroll(null); setCode('');
  };
  const removeFactor = async (f: TotpFactor) => {
    const r = await removeTotpFactor(f.id);
    if (r.error) { toast.error(r.error); return; }
    toast.show('Two-step verification is off');
    void refreshFactors();
  };

  // ---- delete ----
  const [delOpen, setDelOpen] = useState(false);
  const [delWord, setDelWord] = useState('');
  const [delEmail, setDelEmail] = useState('');
  const [delBusy, setDelBusy] = useState(false);
  const armed = canConfirmDelete(delWord, delEmail, email);
  const runDelete = async () => {
    setDelBusy(true);
    const r = await deleteAccount();
    if (r.error) { setDelBusy(false); toast.error(r.error); return; }
    try { localStorage.clear(); } catch { /* storage can be blocked */ }
    await signOut();
    window.location.assign('/');
  };

  useEffect(() => {
    if (offline || !user) return;
    void refreshIdentities();
    void refreshFactors();
  }, [offline, user?.id, refreshIdentities, refreshFactors]);

  const mailBox = 'w-full max-w-sm';

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <UserBlobatar identifier={user?.email || user?.id} size={48} />
        <div className="min-w-0">
          <p className="truncate font-medium">{email || '—'}</p>
          <p className="text-sm text-muted-foreground">{offline ? 'Offline workspace' : 'Signed in'}</p>
        </div>
      </div>

      {offline ? (
        <p className="rounded-lg border border-border p-3 text-sm text-muted-foreground">
          You are in the offline workspace. Sign in online to manage your password, sign-in methods and two-step verification.
        </p>
      ) : (
        <>
          <Block title="Name" hint="How lifeOS greets you.">
            <div className={`${mailBox} flex items-end gap-2`}>
              <Input label="Your name" value={name} onChange={(e) => setName(e.target.value)} className="h-10" />
              <Button type="button" variant="outline" disabled={nameBusy || !name.trim()} onClick={saveName}><Busy on={nameBusy}>Save</Busy></Button>
            </div>
          </Block>

          <Block title="Password" hint={hasPassword ? 'Choose one you do not use anywhere else.' : 'You sign in with Google. Add a password to also sign in with your email.'}>
            <Button type="button" variant="outline" onClick={() => setPwOpen(true)}>{hasPassword ? 'Change password' : 'Set a password'}</Button>
          </Block>

          <Block title="Email" hint={`Now ${email}. We confirm the change by email.`}>
            <form onSubmit={saveEmail} className={`${mailBox} flex items-end gap-2`}>
              <Input label="New email" type="email" autoComplete="email" dir="ltr" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="h-10" />
              <Button type="submit" variant="outline" disabled={emailBusy || !newEmail.trim()}><Busy on={emailBusy}>Change</Busy></Button>
            </form>
          </Block>

          <Block title="Sign-in methods" hint="Ways to get into this account.">
            <ul className="space-y-2">
              {identities.map((i) => (
                <li key={i.identity_id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                  <span className="text-sm font-medium capitalize">{i.provider === 'email' ? 'Email and password' : i.provider}</span>
                  <Button type="button" variant="ghost" size="sm" disabled={identities.length < 2} onClick={() => void unlink(i)}>Remove</Button>
                </li>
              ))}
            </ul>
            {!hasGoogle && <Button type="button" variant="outline" onClick={() => void link()}>Link Google</Button>}
            {identities.length < 2 && <p className="text-sm text-muted-foreground">Add a second method before removing this one.</p>}
          </Block>

          <Block title="Two-step verification" hint="A code from an authenticator app, asked for after your password.">
            {factors.length > 0 && !enroll && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                <span className="flex items-center gap-2 text-sm font-medium"><ShieldCheck size={16} aria-hidden />On</span>
                <Button type="button" variant="ghost" size="sm" onClick={() => void removeFactor(factors[0])}>Turn off</Button>
              </div>
            )}
            {factors.length === 0 && !enroll && (
              <Button type="button" variant="outline" disabled={mfaBusy} onClick={() => void beginEnroll()}><Busy on={mfaBusy}>Set up</Busy></Button>
            )}
            {enroll && (
              <form onSubmit={confirmEnroll} className={`${mailBox} space-y-3`}>
                <p className="text-sm text-muted-foreground">Scan this with your authenticator app, then enter the 6-digit code it shows.</p>
                <img src={enroll.qr} alt="Authenticator QR code" width={176} height={176} className="rounded-lg border border-border bg-white p-2" />
                <p className="text-sm text-muted-foreground">Cannot scan? Enter this key: <span dir="ltr" className="select-all break-all font-mono text-foreground">{enroll.secret}</span></p>
                <Input label="6-digit code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} dir="ltr" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} className="h-10" />
                <div className="flex gap-2">
                  <Button type="submit" disabled={mfaBusy || code.length !== 6}><Busy on={mfaBusy}>Turn on</Busy></Button>
                  <Button type="button" variant="ghost" onClick={() => void cancelEnroll()}>Cancel</Button>
                </div>
              </form>
            )}
          </Block>
        </>
      )}

      <Block title="Sessions">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => signOut()} className="gap-2"><LogOut size={18} />Sign out</Button>
          {!offline && (
            <Button variant="outline" onClick={async () => { const r = await signOutOtherDevices(); r.error ? toast.error(r.error) : toast.show('Signed out everywhere else'); }}>
              Sign out other devices
            </Button>
          )}
        </div>
      </Block>

      {!offline && (
        <Block title="Delete account" hint="Removes your account and everything in it: tasks, habits, notes, finance, health and settings. This cannot be undone.">
          <Button type="button" variant="destructive" className="gap-2" onClick={() => { setDelWord(''); setDelEmail(''); setDelOpen(true); }}>
            <Trash2 size={18} />Delete my account
          </Button>
        </Block>
      )}

      <ChangePasswordModal isOpen={pwOpen} onClose={() => setPwOpen(false)} email={email} name={name} hasPassword={hasPassword} />

      <Modal isOpen={delOpen} onClose={() => !delBusy && setDelOpen(false)} title="Delete your account?">
        <div className="space-y-4">
          <p className="text-sm leading-relaxed">
            This permanently deletes <span dir="ltr" className="font-semibold">{email}</span> and all of its data. There is no way to get it back.
          </p>
          <Input label={`Type ${DELETE_CONFIRM_WORD} to confirm`} value={delWord} onChange={(e) => setDelWord(e.target.value)} autoComplete="off" dir="ltr" className="h-10" />
          <Input label="Type your email" value={delEmail} onChange={(e) => setDelEmail(e.target.value)} autoComplete="off" dir="ltr" className="h-10" />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" disabled={delBusy} onClick={() => setDelOpen(false)}>Keep my account</Button>
            <Button type="button" variant="destructive" disabled={!armed || delBusy} onClick={() => void runDelete()}><Busy on={delBusy}>Delete forever</Busy></Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
