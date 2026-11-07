'use server';
import { createRecoveryClient } from '@/lib/supabase/recovery';
import { getSupabaseConfig } from '@/lib/supabase/config';
import { validEmail } from '@/lib/confirmation-policy';
import { authErrorMessage } from '@/lib/auth-errors';

export async function requestPasswordReset(_previous: { message: string; email: string }, form: FormData): Promise<{ message: string; email: string }> {
  const email = String(form.get('email') ?? '').trim();
  const result = (message: string) => ({ message, email: email.slice(0, 254) });
  if (!validEmail(email)) return result('Enter a valid email address.');
  const config = getSupabaseConfig(), client = createRecoveryClient();
  if (!config || !client) return result('Password recovery is temporarily unavailable. Please try again later.');
  try {
    const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: `${config.appUrl}/auth/recovery` });
    if (error && error.code !== 'user_not_found') return result(authErrorMessage(error, 'recovery'));
  } catch { return result('Password recovery is temporarily unavailable. Please try again later.'); }
  return result('If an account matches this email, a reset link will arrive shortly. Check your inbox and spam folder.');
}
