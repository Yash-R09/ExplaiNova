'use client';
import { useActionState } from 'react';
import { signIn } from './actions';
import { Icon } from '@/components/icon';

export function SignInForm({ next, available, notice }: { next: string; available: boolean; notice: string }) {
  const [state, action, pending] = useActionState(signIn, { message: '', email: '' });
  return <form action={action} className="auth-form">
    <input type="hidden" name="next" value={next} />
    <fieldset disabled={pending || !available}>
      <label htmlFor="email">Email address</label>
      <input id="email" name="email" type="email" autoComplete="email" required maxLength={254} placeholder="you@example.com" defaultValue={state.email} />
      <label htmlFor="password">Password</label>
      <input id="password" name="password" type="password" autoComplete="current-password" required maxLength={1024} />
      <button className="button primary" type="submit">{pending ? 'Signing in…' : 'Sign in'}<Icon name="arrow" /></button>
    </fieldset>
    <p className="auth-message" role="status" aria-live="polite">{state.message || notice}</p>
  </form>;
}
