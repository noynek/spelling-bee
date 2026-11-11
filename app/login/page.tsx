import { redirect } from 'next/navigation';
import { accessMode } from '../../lib/access';
import LoginForm from './login-form';

export const dynamic = 'force-dynamic';

export default function LoginPage() {
  const mode = accessMode();
  if (mode === 'open') redirect('/');
  return <main className="shell">
    <section className="card login-card">
      <h1>Spelling Bee</h1>
      {mode === 'locked'
        ? <LoginForm siteKey={process.env.TURNSTILE_SITE_KEY}/>
        : <p>Sign-in setup is incomplete. Ask the person who manages this site to finish setting it up.</p>}
    </section>
  </main>;
}
