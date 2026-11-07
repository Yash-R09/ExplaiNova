import Link from 'next/link';
import { cookies } from 'next/headers';
import { AuthFrame } from '@/components/auth-frame';
import { getSupabaseConfig } from '@/lib/supabase/config';
import { CONFIRM_COOKIE, readConfirmation } from '@/lib/confirmation-policy';
import { ConfirmForm } from './form';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Confirm your email', referrer: 'no-referrer' as const, robots: { index: false, follow: false } };
export default async function ConfirmEmailPage() {
  const valid = !!readConfirmation((await cookies()).get(CONFIRM_COOKIE)?.value);
  const configured = !!getSupabaseConfig();
  return <AuthFrame eyebrow="YOU’RE ALMOST THERE" title={valid ? 'Confirm your email.' : 'Let’s get you a fresh link.'} subtitle={valid ? 'Confirming will sign you in to the account for this email link.' : 'Your confirmation link is missing, expired, or no longer available.'}>
    {valid ? <ConfirmForm available={configured} /> : null}
    {valid && !configured ? <p className="auth-message" role="status">Email confirmation is temporarily unavailable. Please try again later.</p> : null}
    <p className="auth-scope"><Link href="/check-email">Request a new confirmation link</Link><br /><Link href="/sign-in">Back to sign in</Link></p>
  </AuthFrame>;
}
