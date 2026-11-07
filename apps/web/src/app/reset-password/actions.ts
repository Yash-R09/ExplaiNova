'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createRecoveryClient } from '@/lib/supabase/recovery';
import { getSupabaseConfig } from '@/lib/supabase/config';
import { RECOVERY_COOKIE, readConfirmation, passwordValidation } from '@/lib/confirmation-policy';
import { authErrorKind } from '@/lib/auth-errors';

export async function resetPassword(_previous: { message: string }, form: FormData): Promise<{ message: string }> {
  const password = String(form.get('password') ?? '');
  const confirmation = String(form.get('confirmation') ?? '');
  const invalid = passwordValidation(password, confirmation);
  if (invalid) return { message: invalid }; // Do not consume the link for bad input.
  const store = await cookies();
  const pending = readConfirmation(store.get(RECOVERY_COOKIE)?.value);
  if (!pending) return { message: 'This reset link is unavailable. Request a fresh link.' };
  const config = getSupabaseConfig(), client = createRecoveryClient();
  if (!config || !client) return { message: 'Password recovery is temporarily unavailable. Please try again later.' };
  const clearLink = () => store.set(RECOVERY_COOKIE, '', { ...config.cookieOptions, path: '/reset-password', httpOnly: true, maxAge: 0 });
  let verified = false, changed = false, revokeFailed = false;
  try {
    const { data, error } = await client.auth.verifyOtp({ token_hash: pending.tokenHash, type: 'recovery' });
    if (error || !data.session || !data.user) {
      if (error && authErrorKind(error) === 'unavailable') return { message: 'Password recovery is temporarily unavailable. Retry, or request a fresh reset link.' };
      if (error && authErrorKind(error) === 'rate_limit') return { message: 'Too many attempts. Please wait before trying again.' };
      clearLink();return { message: 'This reset link is invalid, expired, or already used. Request a fresh link.' };
    }
    verified = true;clearLink();
    // The verified token's account is authoritative, even if another account is
    // signed in in this browser. Its temporary session never leaves this action.
    const { data: profile, error: profileError } = await client.from('profiles').select('owner_id,deletion_status').eq('owner_id', data.user.id).single();
    if (profileError || !profile || profile.deletion_status !== 'active') return { message: 'This account cannot be recovered right now. Request a fresh link later or contact support.' };
    const result = await client.auth.updateUser({ password });
    if (result.error) {
      if (authErrorKind(result.error) === 'unavailable') return { message: 'We could not confirm whether your password changed. Try signing in with the new password, or request a fresh reset link.' };
      if (authErrorKind(result.error) === 'rate_limit') return { message: 'Too many attempts. Please wait, then request a fresh reset link.' };
      if (result.error.code === 'same_password') return { message: 'Choose a password you have not used before. Request a fresh reset link to try again.' };
      return { message: 'Your new password could not be accepted. Request a fresh reset link and choose a different password.' };
    }
    changed = true;
    // Invalidate refresh sessions after recovery; existing access JWTs may remain
    // valid until provider expiry. Never claim immediate access-token revocation.
    try { revokeFailed = !!(await client.auth.signOut({ scope: 'global' })).error; }
    catch { revokeFailed = true; }
  } catch {
    return { message: verified ? 'We could not confirm whether your password changed. Try signing in with the new password, or request a fresh reset link.' : 'Password recovery is temporarily unavailable. Retry, or request a fresh reset link.' };
  } finally {
    if (verified && !changed) { try { await client.auth.signOut({ scope: 'local' }); } catch { /* Best-effort cleanup of the isolated temporary session. */ } }
  }
  redirect(`/sign-in?reason=${revokeFailed ? 'PASSWORD_UPDATED_SIGN_OUT_PENDING' : 'PASSWORD_UPDATED'}`);
}
