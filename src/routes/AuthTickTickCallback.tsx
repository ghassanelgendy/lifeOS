import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { exchangeTickTickCode } from '../lib/ticktick';

export default function AuthTickTickCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'connecting' | 'success' | 'error'>('connecting');
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state') ?? '';
    const errorParam = searchParams.get('error');

    if (errorParam) {
      setStatus('error');
      setMessage(searchParams.get('error_description') || errorParam);
      setTimeout(() => navigate('/settings', { replace: true }), 2000);
      return;
    }

    if (!code) {
      setStatus('error');
      setMessage('Missing authorization code');
      setTimeout(() => navigate('/settings', { replace: true }), 2000);
      return;
    }

    exchangeTickTickCode(code, state)
      .then((result) => {
        if (result.success) {
          setStatus('success');
          setTimeout(() => navigate('/settings?ticktick=connected', { replace: true }), 1000);
        } else {
          setStatus('error');
          setMessage(result.error || 'Failed to connect');
          setTimeout(() => navigate('/settings', { replace: true }), 3000);
        }
      })
      .catch(() => {
        setStatus('error');
        setMessage('Connection failed');
        setTimeout(() => navigate('/settings', { replace: true }), 3000);
      });
  }, [searchParams, navigate]);

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 p-6">
      {status === 'connecting' && (
        <>
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Connecting TickTick…</p>
        </>
      )}
      {status === 'success' && <p className="text-green-600">TickTick connected. Redirecting…</p>}
      {status === 'error' && (
        <>
          <p className="text-destructive">{message}</p>
          <p className="text-sm text-muted-foreground">Redirecting to Settings…</p>
        </>
      )}
    </div>
  );
}
