import Link from 'next/link';
import { AuthFrame } from '@/components/auth-frame';
import { getSupabaseConfig } from '@/lib/supabase/config';
import { SignUpForm } from './form';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Create an account' };
export default function SignUpPage() {
  return <AuthFrame eyebrow="YOUR STUDIO STARTS HERE" title="A place for your big ideas." subtitle="Create your account, then confirm your email to get started.">
    <SignUpForm available={!!getSupabaseConfig()} />
    <p className="auth-scope">Already have an account? <Link href="/sign-in">Sign in</Link></p>
  </AuthFrame>;
}
