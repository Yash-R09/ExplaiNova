'use client';
import { useActionState } from 'react';
import { resendConfirmation } from './actions';
export function ResendForm({ email, available }: { email: string; available: boolean }) {
  const [state, action, pending] = useActionState(resendConfirmation, { message: '', email });
  return <form action={action} className="auth-form">
    <fieldset disabled={pending || !available}>
      <label htmlFor="email">Email address</label>
      <input id="email" name="email" type="email" autoComplete="email" required maxLength={254} defaultValue={state.email} placeholder="you@example.com" />
      <button className="button primary" type="submit">{pending ? 'Requesting a link…' : 'Resend confirmation email'}</button>
    </fieldset>
    <p className="auth-message" role="status" aria-live="polite">{state.message || (!available ? 'Confirmation email is temporarily unavailable. Please try again later.' : '')}</p>
  </form>;
}
