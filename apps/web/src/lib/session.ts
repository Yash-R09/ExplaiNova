import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from './supabase/server';

export const readIdentity = cache(async () => {
  const client = await createClient();
  if (!client) return { error: 'AUTH_UNAVAILABLE' as const };
  try {
    // Validate with Auth; never authorize from a cookie's embedded user object.
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) return { error: error && (error.status ?? 0) >= 500 ? 'AUTH_UNAVAILABLE' as const : 'SESSION_REQUIRED' as const };
    const { data: profile, error: profileError } = await client.from('profiles').select('owner_id, preferences, version, deletion_status, created_at, updated_at').eq('owner_id', user.id).single();
    if (profileError || !profile) return { error: 'PROFILE_UNAVAILABLE' as const };
    if (profile.deletion_status !== 'active') return { error: 'ACCOUNT_UNAVAILABLE' as const };
    return { user, profile };
  } catch { return { error: 'AUTH_UNAVAILABLE' as const }; }
});

export async function requireIdentity() {
  const identity = await readIdentity();
  if ('error' in identity) redirect(`/sign-in?reason=${identity.error}`);
  return identity;
}
