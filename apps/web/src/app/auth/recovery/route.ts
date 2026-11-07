import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseConfig } from '@/lib/supabase/config';
import { RECOVERY_COOKIE, CONFIRM_SECONDS, confirmationToken } from '@/lib/confirmation-policy';

export async function GET(request: NextRequest) {
  const config = getSupabaseConfig();
  const tokenHash = confirmationToken(request.nextUrl.searchParams.get('token_hash'));
  const valid = !!config && !!tokenHash && request.nextUrl.searchParams.get('type') === 'recovery';
  const response = NextResponse.redirect(new URL('/reset-password', config?.appUrl ?? request.url), 303);
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.cookies.set(RECOVERY_COOKIE, valid ? Buffer.from(JSON.stringify({ tokenHash, createdAt: Date.now() })).toString('base64url') : '', {
    path: '/reset-password', httpOnly: true, sameSite: 'lax', secure: config?.cookieOptions.secure ?? true, maxAge: valid ? CONFIRM_SECONDS : 0,
  });
  return response;
}
