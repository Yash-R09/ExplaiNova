'use client';
import { useActionState } from 'react';
import { requestPasswordReset } from './actions';

export function ForgotPasswordForm({ available }: { available: boolean }) {
  const [state, action, pending] = useActionState(requestPasswordReset, { message: '', email: '' });
  return <form action={action} className="auth-form">
    <fieldset disabled={!available || pending}>
      <label htmlFor="email">Email address</label>
      <input id="email" name="email" type="email" autoComplete="email" required maxLength={254} placeholder="you@example.com" defaultValue={state.email} />
      <button className="button primary" type="submit">{pending ? 'Requesting a reset link…' : 'Send reset link'}</button>
    </fieldset>
    <p className="auth-message" role="status" aria-live="polite">{state.message || (!available ? 'Password recovery is temporarily unavailable. Please try again later.' : '')}</p>
  </form>;
}
