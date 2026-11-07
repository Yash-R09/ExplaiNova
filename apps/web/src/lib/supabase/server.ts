import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseConfig } from './config';
import type { Database } from './database.types';

export async function createClient() {
  const config = getSupabaseConfig();
  if (!config) return null;
  const store = await cookies();
  return createServerClient<Database>(config.url, config.key, {
    cookieOptions: config.cookieOptions,
    cookies: {
      getAll: () => store.getAll(),
      setAll(values) {
        // Server Components cannot write; proxy refreshes before rendering.
        // Actions and Route Handlers can write using this same request client.
        try { values.forEach(({ name, value, options }) => store.set(name, value, options)); }
        catch { /* Read-only Server Component; proxy owns refresh. */ }
      },
    },
  });
}
