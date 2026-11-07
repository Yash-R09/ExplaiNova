'use client';
import { useActionState } from 'react';
import { resetPassword } from './actions';

export function ResetPasswordForm({ available }: { available: boolean }) {
  const [state, action, pending] = useActionState(resetPassword, { message: '' });
  return <form action={action} className="auth-form">
    {available ? <fieldset disabled={pending}>
      <label htmlFor="password">New password</label>
      <input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={72} aria-describedby="password-hint" />
      <p className="muted" id="password-hint">At least 8 characters. Choose a password you have not used before.</p>
      <label htmlFor="confirmation">Confirm new password</label>
      <input id="confirmation" name="confirmation" type="password" autoComplete="new-password" required minLength={8} maxLength={72} />
      <button className="button primary" type="submit">{pending ? 'Updating your password…' : 'Save new password'}</button>
    </fieldset> : null}
    <p className="auth-message" role="status" aria-live="polite">{state.message}</p>
  </form>;
}
