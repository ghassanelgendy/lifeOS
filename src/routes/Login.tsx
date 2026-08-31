import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button, Input } from '../components/ui';
import { Loader2, Copy, Check } from 'lucide-react';

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export default function Login() {
  const { signIn, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [copiedField, setCopiedField] = useState<'email' | 'password' | null>(null);

  const handleCopy = (text: string, field: 'email' | 'password') => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleAutoFill = () => {
    setEmail('ghesso@best.com');
    setPassword('123');
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setGoogleLoading(true);
    const { error: err } = await signInWithGoogle();
    setGoogleLoading(false);
    if (err) setError(err.message ?? 'Google sign in failed');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: err } = await signIn(email, password);
    setLoading(false);
    if (err) {
      setError(err.message ?? 'Sign in failed');
      return;
    }
    navigate('/dashboard', { replace: true });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background select-text">
      <div className="w-full max-w-md space-y-8 select-text">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Sign in</h1>
          <p className="text-muted-foreground mt-1 text-sm">Sign in to your LifeOS account</p>
          <p className="text-xs text-muted-foreground mt-2 px-4">
            Just signed up? Check your email and click the verification link before signing in.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full min-h-[44px] gap-2"
          onClick={handleGoogleSignIn}
          disabled={loading || googleLoading}
        >
          {googleLoading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <GoogleIcon className="w-5 h-5" />
          )}
          Continue with Google
        </Button>

        <div className="relative flex items-center gap-2">
          <div className="flex-1 border-t border-border" />
          <span className="text-xs text-muted-foreground">or</span>
          <div className="flex-1 border-t border-border" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
          />
          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
          />

          {/* Test Account Credentials Box with Copy & Auto-fill */}
          <div className="rounded-xl border border-border/80 bg-secondary/30 p-3 text-xs space-y-2 select-text">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground font-medium">🧪 Test Account Credentials:</span>
              <button
                type="button"
                onClick={handleAutoFill}
                className="text-[11px] font-semibold text-primary hover:underline cursor-pointer flex items-center gap-1 active:scale-95 transition-transform"
              >
                Auto-fill
              </button>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 font-mono text-[11px]">
              {/* Email */}
              <div className="flex-1 flex items-center justify-between gap-1.5 bg-background/80 px-2.5 py-1.5 rounded-lg border border-border/50 select-text">
                <span className="select-all font-medium text-foreground select-text cursor-text">ghesso@best.com</span>
                <button
                  type="button"
                  onClick={() => handleCopy('ghesso@best.com', 'email')}
                  className="p-1 text-muted-foreground hover:text-foreground rounded hover:bg-secondary cursor-pointer transition-colors active:scale-90"
                  title="Copy Email"
                >
                  {copiedField === 'email' ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                </button>
              </div>

              {/* Password */}
              <div className="sm:w-28 flex items-center justify-between gap-1.5 bg-background/80 px-2.5 py-1.5 rounded-lg border border-border/50 select-text">
                <span className="select-all font-medium text-foreground select-text cursor-text">123</span>
                <button
                  type="button"
                  onClick={() => handleCopy('123', 'password')}
                  className="p-1 text-muted-foreground hover:text-foreground rounded hover:bg-secondary cursor-pointer transition-colors active:scale-90"
                  title="Copy Password"
                >
                  {copiedField === 'password' ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                </button>
              </div>
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full min-h-[44px]" disabled={loading}>
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 size={18} className="animate-spin" />
                Signing in...
              </span>
            ) : (
              'Sign in'
            )}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}{' '}
          <Link to="/signup" className="font-medium text-foreground hover:underline">
            Sign up
          </Link>
        </p>

        <div className="pt-2 border-t border-border/60">
          <div className="flex items-center justify-center gap-4 text-[11px] text-muted-foreground">
            <a
              href="https://github.com/ghassanelgendy"
              target="_blank"
              rel="noreferrer"
              className="underline-offset-2 hover:underline"
            >
              GitHub
            </a>
            <span className="text-muted-foreground/60">·</span>
            <a
              href="https://www.linkedin.com/in/ghassanelgendy/"
              target="_blank"
              rel="noreferrer"
              className="underline-offset-2 hover:underline"
            >
              LinkedIn
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
