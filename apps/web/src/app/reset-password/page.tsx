import Link from 'next/link';
import { cookies } from 'next/headers';
import { AuthFrame } from '@/components/auth-frame';
import { getSupabaseConfig } from '@/lib/supabase/config';
import { RECOVERY_COOKIE, readConfirmation } from '@/lib/confirmation-policy';
import { ResetPasswordForm } from './form';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Reset password', referrer: 'no-referrer' as const, robots: { index: false, follow: false } };
export default async function ResetPasswordPage() {
  const valid = !!readConfirmation((await cookies()).get(RECOVERY_COOKIE)?.value);
  const configured = !!getSupabaseConfig();
  return <AuthFrame eyebrow="A FRESH START" title={valid ? 'Choose a new password.' : 'Let’s get you a fresh link.'} subtitle={valid ? 'This resets the account for your recovery email. You’ll sign in again after saving.' : 'Your reset link is missing, expired, or no longer available.'}>
    <ResetPasswordForm available={valid && configured} />
    {valid && !configured ? <p className="auth-message" role="status">Password recovery is temporarily unavailable. Please try again later.</p> : null}
    <p className="auth-scope"><Link href="/forgot-password">Request a fresh reset link</Link><br /><Link href="/sign-in">Back to sign in</Link></p>
  </AuthFrame>;
}
