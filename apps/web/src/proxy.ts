import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseConfig } from '@/lib/supabase/config';
import { isStudioPath, safeReturnTo } from '@/lib/auth-policy';
import type { Database } from '@/lib/supabase/database.types';

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  response.headers.set('Cache-Control', 'private, no-store');
  const config = getSupabaseConfig();
  let authenticated = false;
  if (config) {
    const client = createServerClient<Database>(config.url, config.key, {
      cookieOptions: config.cookieOptions,
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(values, headers) {
          values.forEach(({ name, value }) => request.cookies.set(name, value));
          const previous = response.cookies.getAll();
          response = NextResponse.next({ request });
          previous.forEach(cookie => response.cookies.set(cookie));
          values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
          response.headers.set('Cache-Control', 'private, no-store');
        },
      },
    });
    try { const { data, error } = await client.auth.getClaims(); authenticated = !error && !!data?.claims.sub; }
    catch { /* Fail closed; private data is also checked in the data layer. */ }
  }
  if (isStudioPath(request.nextUrl.pathname) && !authenticated) {
    const target = new URL('/sign-in', request.url);
    target.searchParams.set('next', safeReturnTo(request.nextUrl.pathname));
    if (!config) target.searchParams.set('reason', 'AUTH_UNAVAILABLE');
    const redirect = NextResponse.redirect(target);
    response.cookies.getAll().forEach(cookie => redirect.cookies.set(cookie));
    redirect.headers.set('Cache-Control', 'private, no-store');
    return redirect;
  }
  return response;
}

export const config = { matcher: ['/sign-in', '/projects/:path*', '/create/:path*', '/publishing/:path*', '/connections/:path*', '/settings/:path*', '/api/v1/:path*'] };
