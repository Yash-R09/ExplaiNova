import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Database, Json } from './supabase/database.types';
import { brainstormWithGemini } from './gemini-brainstorm';

function asObject(value: Json | undefined) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

export async function executeBrainstormRequest(id: string, projectId: string, ownerId: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;

  try {
    const client = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await client.rpc('claim_brainstorm_request', {
      p_id: id, p_project_id: projectId, p_owner_id: ownerId,
    });
    if (error) throw new Error('Planning claim failed');
    const claim = asObject(data);
    if (typeof claim.attemptId !== 'string' || typeof claim.message !== 'string') return;

    const snapshot = asObject(claim.snapshot);
    const { title, brief, referenceText, targetDurationMs, audienceLevel, tone } = asObject(snapshot.draft);
    const outcome = await brainstormWithGemini(
      process.env.GEMINI_API_KEY ?? '', process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      { message: claim.message, title, brief, savedNotes: referenceText, requestNotes: snapshot.referenceText, targetDurationMs, audienceLevel, tone },
    );
    const { error: finishError } = await client.rpc('finish_brainstorm_request', {
      p_id: id, p_attempt_id: claim.attemptId,
      ...(outcome.reply === null ? { p_failure_code: outcome.failureCode } : { p_reply: outcome.reply }),
    });
    if (finishError) throw new Error('Planning completion failed');
  } catch {
    // Keep inputs, credentials and provider responses out of logs. Replay can recover an expired lease.
    console.error('Brainstorm execution storage error', { requestId: id });
  }
}
