'use client';
import { useActionState } from 'react';
import { signUp } from './actions';
import { Icon } from '@/components/icon';

export function SignUpForm({ available }: { available: boolean }) {
  const [state, action, pending] = useActionState(signUp, { message: '', email: '' });
  return <form action={action} className="auth-form">
    <fieldset disabled={pending || !available}>
      <label htmlFor="email">Email address</label>
      <input id="email" name="email" type="email" autoComplete="email" required maxLength={254} placeholder="you@example.com" defaultValue={state.email} />
      <label htmlFor="password">Password</label>
      <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} maxLength={72} required aria-describedby="password-hint" />
      <p id="password-hint" className="muted">At least 8 characters. Use a unique password.</p>
      <label htmlFor="confirmation">Confirm password</label>
      <input id="confirmation" name="confirmation" type="password" autoComplete="new-password" minLength={8} maxLength={72} required />
      <button className="button primary" type="submit">{pending ? 'Creating your account…' : 'Create account'}<Icon name="arrow" /></button>
    </fieldset>
    <p className="auth-message" role="status" aria-live="polite">{state.message || (!available ? 'Account creation is temporarily unavailable. Please try again later.' : '')}</p>
  </form>;
}
