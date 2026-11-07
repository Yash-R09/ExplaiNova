'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseConfig } from '@/lib/supabase/config';
import { CONFIRM_COOKIE, PENDING_EMAIL_COOKIE, readConfirmation } from '@/lib/confirmation-policy';
import { authErrorKind, authErrorMessage } from '@/lib/auth-errors';

export async function confirmEmail(): Promise<{ message: string }> {
  const store = await cookies();
  const pending = readConfirmation(store.get(CONFIRM_COOKIE)?.value);
  if (!pending) return { message: 'This confirmation link is unavailable. Request a new link.' };
  const config = getSupabaseConfig(), client = await createClient();
  if (!config || !client) return { message: 'Email confirmation is temporarily unavailable. Please try again later.' };
  try {
    const { error } = await client.auth.verifyOtp({ token_hash: pending.tokenHash, type: 'email' });
    if (error) {
      // Keep the token only for retryable transport/rate failures.
      if (authErrorKind(error) === 'invalid') store.set(CONFIRM_COOKIE, '', { ...config.cookieOptions, path: '/confirm-email', httpOnly: true, maxAge: 0 });
      return { message: authErrorMessage(error, 'confirm') };
    }
  } catch { return { message: 'Email confirmation is temporarily unavailable. Please try again later.' }; }
  store.set(CONFIRM_COOKIE, '', { ...config.cookieOptions, path: '/confirm-email', httpOnly: true, maxAge: 0 });
  store.set(PENDING_EMAIL_COOKIE, '', { ...config.cookieOptions, httpOnly: true, maxAge: 0 });
  redirect('/projects');
}
