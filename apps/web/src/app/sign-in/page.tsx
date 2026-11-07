import { Icon } from '@/components/icon';
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
};

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; reason?: string }> }) {
  const params = await searchParams;
  const available = !!getSupabaseConfig();
  return <div className="auth-page">
    <section className="auth-editorial" aria-label="Explainova studio">
      <div className="brand"><span className="brand-mark"><Icon name="spark" /></span><span>Explainova<small>THE EXPLAINER STUDIO</small></span></div>
      <div><span className="tag lime">MAKE IT MAKE SENSE</span><h1>Good ideas deserve<br />a clear explanation.</h1><p>Your ideas, storyboards, and next “aha” moment. Together in your own studio.</p></div>
      <span className="auth-art" aria-hidden="true">✳</span>
      <p className="auth-footnote">A little curiosity goes a long way.</p>
    </section>
    <main className="auth-content" id="main">
      <div className="auth-card"><p className="eyebrow">WELCOME BACK</p><h2>Sign in to Explainova</h2><p className="subtitle">Pick up where your curiosity left off.</p>
        <SignInForm next={safeReturnTo(params.next)} available={available} notice={!available ? notices.AUTH_UNAVAILABLE : notices[params.reason ?? ''] ?? ''} />
        <p className="auth-scope">Existing accounts can sign in. Account creation and password recovery are coming in the next update.</p>
      </div>
    </main>
  </div>;
}
