import Link from 'next/link';
import { AuthFrame } from '@/components/auth-frame';
import { getSupabaseConfig } from '@/lib/supabase/config';
import { ForgotPasswordForm } from './form';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Forgot password', robots: { index: false, follow: false } };
export default function ForgotPasswordPage() {
  return <AuthFrame eyebrow="LET’S GET YOU BACK IN" title="Forgot your password?" subtitle="Enter your account email. If it matches an account, we’ll send a link to choose a new password.">
    <ForgotPasswordForm available={!!getSupabaseConfig()} />
    <p className="auth-scope"><Link href="/sign-in">Back to sign in</Link></p>
  </AuthFrame>;
}
