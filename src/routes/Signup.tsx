import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button, Input } from '../components/ui';
import { Loader2, Mail, CheckCircle2, ShieldCheck } from 'lucide-react';
import { cn } from '../lib/utils';

const MIN_PASSWORD_LENGTH = 6;

function PasswordRequirement({ met, label }: { met: boolean; label: string }) {
  return (
    <li className={cn("flex items-center gap-2 text-sm", met ? "text-green-500" : "text-muted-foreground")}>
      {met ? <CheckCircle2 size={14} className="flex-shrink-0" /> : <span className="w-3.5 h-3.5 rounded-full border border-current flex-shrink-0" />}
      {label}
    </li>
  );
}

export default function Signup() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');

  const passwordLongEnough = password.length >= MIN_PASSWORD_LENGTH;
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;
  const canSubmit = email.length > 0 && passwordLongEnough && passwordsMatch && !loading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!passwordsMatch) {
      setError('Passwords do not match');
      return;
    }
    if (!passwordLongEnough) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return;
    }
    setLoading(true);
    const { error: err } = await signUp(email.trim(), password);
    setLoading(false);
    if (err) {
      setError(err.message ?? 'Sign up failed');
      return;
    }
    setRegisteredEmail(email.trim());
    setSuccess(true);
  };

  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
        <div className="w-full max-w-md text-center space-y-6">
          <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <Mail className="text-primary" size={28} />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Verify your email</h1>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              We sent a confirmation link to
            </p>
            <p className="font-medium text-foreground mt-1 break-all">{registeredEmail}</p>
          </div>
          <div className="rounded-xl border border-border bg-card/50 p-4 text-left space-y-3">
            <p className="text-sm font-medium text-foreground flex items-center gap-2">
              <ShieldCheck size={16} className="text-primary" />
              Next steps
            </p>
            <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
              <li>Check your inbox (and spam folder) for an email from us.</li>
              <li>Click the confirmation link in that email.</li>
              <li>Come back here and sign in with your email and password.</li>
            </ol>
          </div>
          <p className="text-xs text-muted-foreground">
            You won’t be able to sign in until your email is verified.
          </p>
          <Button size="lg" className="w-full" onClick={() => navigate('/login', { replace: true })}>
            Go to sign in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Create account</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Sign up for LifeOS. You’ll verify your email before signing in.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            disabled={loading}
          />

          <div className="space-y-2">
            <Input
              label="Password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              placeholder="At least 6 characters"
            />
            <ul className="flex flex-col gap-1 pt-1">
              <PasswordRequirement met={passwordLongEnough} label={`At least ${MIN_PASSWORD_LENGTH} characters`} />
            </ul>
          </div>

          <div className="space-y-2">
            <Input
              label="Confirm password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={loading}
              placeholder="Re-enter your password"
              error={confirmPassword.length > 0 && !passwordsMatch ? 'Passwords do not match' : undefined}
            />
            {confirmPassword.length > 0 && (
              <p className={cn("text-sm flex items-center gap-1.5", passwordsMatch ? "text-green-500" : "text-destructive")}>
                {passwordsMatch ? <CheckCircle2 size={14} /> : null}
                {passwordsMatch ? 'Passwords match' : 'Passwords do not match'}
              </p>
            )}
          </div>

          {error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2" role="alert">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <Button type="submit" className="w-full min-h-[44px]" size="lg" disabled={!canSubmit}>
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 size={18} className="animate-spin" />
                Creating account...
              </span>
            ) : (
              'Create account'
            )}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-foreground hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
