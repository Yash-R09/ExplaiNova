'use server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseConfig } from '@/lib/supabase/config';
import { validEmail, PENDING_EMAIL_COOKIE } from '@/lib/confirmation-policy';
import { authErrorMessage } from '@/lib/auth-errors';

export async function resendConfirmation(_previous: { message: string; email: string }, form: FormData): Promise<{ message: string; email: string }> {
  const email = String(form.get('email') ?? '').trim();
  const result = (message: string) => ({ message, email: email.slice(0, 254) });
  if (!validEmail(email)) return result('Enter a valid email address.');
  const config = getSupabaseConfig(), client = await createClient();
  if (!config || !client) return result('Confirmation email is temporarily unavailable. Please try again later.');
  try {
    const { error } = await client.auth.resend({ type: 'signup', email, options: { emailRedirectTo: `${config.appUrl}/auth/confirm` } });
    if (error) return result(authErrorMessage(error, 'resend'));
  } catch { return result('Confirmation email is temporarily unavailable. Please try again later.'); }
  (await cookies()).set(PENDING_EMAIL_COOKIE, email, { ...config.cookieOptions, httpOnly: true, maxAge: 3600 });
  return result('If this address needs confirmation, a new link will arrive shortly. Check your inbox and spam folder.');
}
