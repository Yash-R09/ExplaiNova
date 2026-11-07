import Link from 'next/link';
import { AuthFrame } from '@/components/auth-frame';
import { getSupabaseConfig } from '@/lib/supabase/config';
import { safeReturnTo } from '@/lib/auth-policy';
import { SignInForm } from './form';

export const metadata = { title: 'Sign in' };
export const dynamic = 'force-dynamic';
const notices: Record<string, string> = {
  AUTH_UNAVAILABLE: 'Sign-in is temporarily unavailable. Please try again later.',
  PROFILE_UNAVAILABLE: 'Your workspace could not be loaded. Please try again later.',
  ACCOUNT_UNAVAILABLE: 'Your workspace is currently unavailable. Please contact support.',
  SIGN_OUT_FAILED: 'Sign-out could not be completed. Please try again.',
  PASSWORD_UPDATED: 'Your password has been updated. Sign in with your new password.',
  PASSWORD_UPDATED_SIGN_OUT_PENDING: 'Your password has been updated. Sign in with your new password. Sign-out on other devices could not be confirmed.',
};

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; reason?: string }> }) {
  const params = await searchParams;
  const available = !!getSupabaseConfig();
  return <AuthFrame eyebrow="WELCOME BACK" title="Sign in to Explainova" subtitle="Pick up where your curiosity left off.">
    <SignInForm next={safeReturnTo(params.next)} available={available} notice={!available ? notices.AUTH_UNAVAILABLE : notices[params.reason ?? ''] ?? ''} />
    <p className="auth-scope">New here? <Link href="/sign-up">Create an account</Link><br /><Link href="/check-email">Need a confirmation link?</Link></p>
    <p className="auth-scope"><Link href="/forgot-password">Forgot your password?</Link></p>
  </AuthFrame>;
}
