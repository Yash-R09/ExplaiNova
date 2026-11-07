export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!url || !key || !appUrl) return null;
  try {
    for (const value of [url, appUrl]) {
      const parsed = new URL(value);
      if (parsed.username || parsed.password || parsed.search || parsed.hash) return null;
      if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname))) return null;
    }
    // Only browser-safe publishable keys or legacy anon keys belong here.
    if (!key.startsWith('sb_publishable_')) {
      const payload = JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      if (payload.role !== 'anon') return null;
    }
    return { url, key, appUrl: new URL(appUrl).origin, cookieOptions: { path: '/', sameSite: 'lax' as const, secure: new URL(appUrl).protocol === 'https:' } };
  } catch { return null; }
}
