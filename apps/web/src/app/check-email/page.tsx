import Link from 'next/link';
import { cookies } from 'next/headers';
import { AuthFrame } from '@/components/auth-frame';
import { getSupabaseConfig } from '@/lib/supabase/config';
import { PENDING_EMAIL_COOKIE, validEmail } from '@/lib/confirmation-policy';
import { ResendForm } from './form';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Check your email', robots: { index: false, follow: false } };
export default async function CheckEmailPage() {
  const pending = (await cookies()).get(PENDING_EMAIL_COOKIE)?.value ?? '';
  return <AuthFrame eyebrow="ONE LAST THING" title="Check your inbox." subtitle="If your address needs confirmation, a link will arrive shortly. Open it to confirm your email and enter your studio.">
    <ResendForm email={validEmail(pending) ? pending : ''} available={!!getSupabaseConfig()} />
    <p className="auth-scope">Already confirmed? <Link href="/sign-in">Sign in</Link><br />Wrong address? <Link href="/sign-up">Start again</Link></p>
  </AuthFrame>;
}
