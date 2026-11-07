import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseConfig } from '@/lib/supabase/config';
import { CONFIRM_COOKIE, CONFIRM_SECONDS, confirmationToken } from '@/lib/confirmation-policy';

export async function GET(request: NextRequest) {
  const config = getSupabaseConfig();
  const tokenHash = confirmationToken(request.nextUrl.searchParams.get('token_hash'));
  const valid = !!config && !!tokenHash && request.nextUrl.searchParams.get('type') === 'email';
  const response = NextResponse.redirect(new URL('/confirm-email', config?.appUrl ?? request.url), 303);
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  // Do not verify on GET: email scanners must not consume single-use links.
  // Stage a short-lived HttpOnly token and redirect away from the secret URL.
  response.cookies.set(CONFIRM_COOKIE, valid ? Buffer.from(JSON.stringify({ tokenHash, createdAt: Date.now() })).toString('base64url') : '', {
    path: '/confirm-email', httpOnly: true, sameSite: 'lax', secure: config?.cookieOptions.secure ?? true, maxAge: valid ? CONFIRM_SECONDS : 0,
  });
  return response;
}
