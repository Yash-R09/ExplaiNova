'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseConfig } from '@/lib/supabase/config';
import { signupValidation, PENDING_EMAIL_COOKIE } from '@/lib/confirmation-policy';
import { authErrorMessage } from '@/lib/auth-errors';

export async function signUp(_previous: { message: string; email: string }, form: FormData): Promise<{ message: string; email: string }> {
  const email = String(form.get('email') ?? '').trim();
  const password = String(form.get('password') ?? '');
  const confirmation = String(form.get('confirmation') ?? '');
  const failure = (message: string) => ({ message, email: email.slice(0, 254) });
  const invalid = signupValidation(email, password, confirmation);
  if (invalid) return failure(invalid);
  const config = getSupabaseConfig(), client = await createClient();
  if (!config || !client) return failure('Account creation is temporarily unavailable. Please try again later.');
  let sessionCreated = false;
  try {
    const { data, error } = await client.auth.signUp({ email, password, options: { emailRedirectTo: `${config.appUrl}/auth/confirm` } });
    // Do not reveal whether an address already has an account.
    if (error && !['user_already_exists', 'email_exists'].includes(error.code ?? '')) return failure(authErrorMessage(error, 'sign-up'));
    sessionCreated = !!data.session;
  } catch { return failure('Account creation is temporarily unavailable. Please try again later.'); }
  (await cookies()).set(PENDING_EMAIL_COOKIE, email, { ...config.cookieOptions, httpOnly: true, maxAge: 3600 });
  redirect(sessionCreated ? '/projects' : '/check-email');
}
