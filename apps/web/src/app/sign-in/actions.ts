'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { safeReturnTo } from '@/lib/auth-policy';
import { authErrorMessage } from '@/lib/auth-errors';

export async function signIn(_previous: { message: string; email: string }, form: FormData): Promise<{ message: string; email: string }> {
  const email = String(form.get('email') ?? '').trim();
  const password = String(form.get('password') ?? '');
  const failure = (message: string) => ({ message, email: email.slice(0, 254) });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !password || password.length > 1024) return failure('Enter your email and password.');
  const client = await createClient();
  if (!client) return failure('Sign-in is temporarily unavailable. Please try again later.');
  try {
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) return failure(authErrorMessage(error, 'sign-in'));
  } catch { return failure('Sign-in is temporarily unavailable. Please try again later.'); }
  redirect(safeReturnTo(form.get('next')));
}

export async function signOut(): Promise<void> {
  const client = await createClient();
  if (client) {
    // The SDK clears session cookies even when its local refresh token expired.
    const { error } = await client.auth.signOut({ scope: 'local' });
    if (error) redirect('/sign-in?reason=SIGN_OUT_FAILED');
  }
  redirect('/sign-in');
}
