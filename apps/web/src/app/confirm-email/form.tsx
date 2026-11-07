'use client';
import { useActionState } from 'react';
import { confirmEmail } from './actions';
export function ConfirmForm({ available }: { available: boolean }) {
  const [state, action, pending] = useActionState(confirmEmail, { message: '' });
  return <form action={action} className="auth-form">
    <button className="button primary" disabled={!available || pending} type="submit">{pending ? 'Confirming your email…' : 'Confirm email and enter studio'}</button>
    <p className="auth-message" role="status" aria-live="polite">{state.message}</p>
  </form>;
}
