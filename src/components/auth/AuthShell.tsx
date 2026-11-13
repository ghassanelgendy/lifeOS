/**
 * Shared layout and parts for the sign-in and sign-up pages (web, desktop and
 * iOS): logo and language switch on top, one form column, and a brand panel
 * beside it on desktop. Theme classes only, so it follows dark/light and
 * works in every platform build. English and Arabic.
 */
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { Check, Eye, EyeOff, Languages, Loader2 } from 'lucide-react';
import { Button, Input } from '../ui';
import { cn } from '../../lib/utils';
import '../landing/landing.css';
import { LogoMark } from '../landing/Logo';
import { usePublicLang } from '../landing/i18n';

export const quietLink =
  'inline-flex min-h-11 items-center text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:opacity-50';

export function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

/** Props for a block that fades up once on load, in order. */
export function useEnter() {
  const reduce = useReducedMotion();
  return (i: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 12 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.45, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] as const },
        };
}

export function AuthShell({ title, lead, children }: { title: string; lead: string; children: ReactNode }) {
  const { t, lang, dir, toggle } = usePublicLang();
  const enter = useEnter();
  const a = t.auth;

  return (
    <div dir={dir} lang={lang} className={cn('grid h-dvh select-text overflow-y-auto bg-background text-foreground lg:grid-cols-2', lang === 'ar' && 'lang-ar')}>
      <div className="flex min-h-full flex-col px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))] sm:px-10">
        <div className="flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 rounded-lg" aria-label={a.home}>
            <LogoMark size={26} />
            <span className="text-lg font-bold tracking-tight" dir="ltr">lifeOS</span>
          </Link>
          <button
            type="button"
            onClick={toggle}
            lang={lang === 'ar' ? 'en' : 'ar'}
            aria-label={t.switchLabel}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            <Languages size={16} />
            {t.switchTo}
          </button>
        </div>

        <div className="my-auto w-full max-w-[380px] self-center py-8">
          <motion.div {...enter(0)}>
            <h1 className="text-3xl font-bold leading-tight tracking-tight">{title}</h1>
            <p className="mt-2 text-base leading-relaxed text-muted-foreground">{lead}</p>
          </motion.div>
          {children}
        </div>
      </div>

      <aside className="relative hidden flex-col justify-between overflow-hidden border-s border-border bg-card p-12 lg:flex" aria-label={a.panelLabel}>
        <LogoMark size={420} className="pointer-events-none absolute -bottom-24 -end-20 text-foreground opacity-[0.04]" />
        <p className="relative text-sm font-semibold text-muted-foreground">{a.panelLabel}</p>
        <p className="relative max-w-[18ch] text-4xl font-bold leading-[1.2] tracking-tight xl:text-5xl xl:leading-[1.2]">
          {a.panelHead}
          <span className="text-muted-foreground"> {a.panelTail}</span>
        </p>
        <ul className="relative space-y-3">
          {a.facts.map((fact) => (
            <li key={fact} className="flex items-start gap-3 text-sm text-muted-foreground">
              <Check size={16} className="mt-0.5 shrink-0 text-foreground" />
              {fact}
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}

/** Google first (one tap), then the divider that introduces the email form. */
export function GoogleBlock({ onClick, busy, disabled }: { onClick: () => void; busy: boolean; disabled: boolean }) {
  const { t } = usePublicLang();
  return (
    <>
      <Button type="button" variant="outline" className="min-h-[46px] w-full gap-2.5 text-base" onClick={onClick} disabled={disabled}>
        {busy ? <Loader2 size={18} className="animate-spin" /> : <GoogleIcon className="size-5" />}
        {t.auth.google}
      </Button>
      <div className="my-5 flex items-center gap-3" aria-hidden>
        <div className="flex-1 border-t border-border" />
        <span className="text-[13px] text-muted-foreground">{t.auth.or}</span>
        <div className="flex-1 border-t border-border" />
      </div>
    </>
  );
}

/** Email field: always typed left-to-right, whatever the page language. */
export function EmailField({ value, onChange, disabled, error }: { value: string; onChange: (v: string) => void; disabled: boolean; error?: string }) {
  const { t } = usePublicLang();
  return (
    <Input
      label={t.auth.email}
      type="email"
      inputMode="email"
      autoComplete="email"
      autoCapitalize="none"
      spellCheck={false}
      dir="ltr"
      className="h-11 rtl:text-right"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required
      disabled={disabled}
      error={error}
    />
  );
}

/** Password field with a show/hide control, which replaces a "confirm password" box. */
export function PasswordField({ value, onChange, disabled, autoComplete, describedBy }: {
  value: string; onChange: (v: string) => void; disabled: boolean; autoComplete: 'current-password' | 'new-password'; describedBy?: string;
}) {
  const { t } = usePublicLang();
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        label={t.auth.password}
        type={show ? 'text' : 'password'}
        autoComplete={autoComplete}
        dir="ltr"
        className="h-11 pr-12 rtl:text-right"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        disabled={disabled}
        aria-describedby={describedBy}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? t.auth.hide : t.auth.show}
        aria-pressed={show}
        className="absolute bottom-0 right-0 flex size-11 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground"
      >
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}

export function SubmitButton({ busy, busyLabel, children, disabled }: { busy: boolean; busyLabel: string; children: ReactNode; disabled: boolean }) {
  return (
    <Button type="submit" className="min-h-[46px] w-full text-base" disabled={disabled}>
      {busy ? (
        <span className="flex items-center justify-center gap-2">
          <Loader2 size={18} className="animate-spin" />
          {busyLabel}
        </span>
      ) : (
        children
      )}
    </Button>
  );
}
