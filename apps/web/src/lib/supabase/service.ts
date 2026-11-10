import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  }) : null;
}
