'use client';

import Script from 'next/script';
import { useRef, useState, type FormEvent } from 'react';

type Widget = {
  render: (target: HTMLElement, options: {
    sitekey: string;
    action: string;
    callback: (value: string) => void;
    'expired-callback': () => void;
    'error-callback': () => void;
  }) => string;
  reset: (id: string) => void;
};

function turnstile() {
  return (window as Window & {turnstile?: Widget}).turnstile;
}

export default function LoginForm({siteKey}: {siteKey?: string}) {
  const target = useRef<HTMLDivElement>(null);
  const widget = useRef<string | undefined>(undefined);
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function loadWidget() {
    if (!siteKey || !target.current || widget.current !== undefined) return;
    widget.current = turnstile()?.render(target.current, {
      sitekey: siteKey,
      action: 'login',
      callback: setToken,
      'expired-callback': () => setToken(''),
      'error-callback': () => {
        setToken('');
        setError('The security check could not load. Reload to try again.');
      },
    });
  }

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || (siteKey && !token)) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({password, token}),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? 'Could not sign in. Try again shortly.');
      window.location.replace('/');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not sign in.');
      setToken('');
      if (widget.current !== undefined) turnstile()?.reset(widget.current);
      setBusy(false);
    }
  }

  return <form method="post" onSubmit={signIn}>
    <label>Shared password
      <input type="password" autoComplete="current-password" required maxLength={512}
        value={password} onChange={event => setPassword(event.target.value)}/>
    </label>
    {siteKey && <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        onReady={loadWidget} onError={() => setError('The security check could not load. Reload to try again.')}/>
      <div className="login-challenge" ref={target}/>
    </>}
    {error && <p role="alert">{error}</p>}
    <button className="primary" disabled={busy || !password || Boolean(siteKey && !token)}>
      {busy ? 'Signing in…' : 'Sign in'}
    </button>
  </form>;
}
