import 'server-only';
import type { Json } from './supabase/database.types';
import { createServiceClient } from './supabase/service';
import { brainstormWithGemini, generateGeminiJson } from './gemini-brainstorm';
import { storyboardSchema, validateStoryboardCandidate } from './storyboard-candidate';

function asObject(value: Json | undefined) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

export async function executePlanningRequest(id: string, projectId: string, ownerId: string) {
  try {
    const client = createServiceClient();
    if (!client) return;
    const { data, error } = await client.rpc('claim_brainstorm_request', {
      p_id: id, p_project_id: projectId, p_owner_id: ownerId,
    });
    if (error) throw new Error('Planning claim failed');
    const claim = asObject(data);
    if (typeof claim.attemptId !== 'string' || typeof claim.message !== 'string') return;

    const snapshot = asObject(claim.snapshot);
    const { title, brief, referenceText, targetDurationMs, audienceLevel, tone } = asObject(snapshot.draft);
    const context = { message: claim.message, title, brief, savedNotes: referenceText, requestNotes: snapshot.referenceText, targetDurationMs, audienceLevel, tone };
    const apiKey = process.env.GEMINI_API_KEY ?? '';
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    if (claim.mode === 'storyboard') {
      const duration = typeof targetDurationMs === 'number' ? targetDurationMs : 0;
      const outcome = await generateGeminiJson(apiKey, model, context, {
        instruction: 'Plan a short animated educational explainer with 4–10 scenes. Give each scene a learning purpose, voiceover narration, visual objects, labels, and motion cues. Aim for at most two and a half spoken words per target second across all scenes. Propose a topic-specific 2D theme. Treat reference notes as source material, and flag uncertain claims in reviewNotes without inventing citations.',
        schema: storyboardSchema,
        maxOutputTokens: 6000,
        validate: value => validateStoryboardCandidate(value, duration),
      });
      const { error: finishError } = await client.rpc('finish_storyboard_request', {
        p_id: id, p_attempt_id: claim.attemptId,
        ...(outcome.result === null ? { p_failure_code: outcome.failureCode } : { p_storyboard: outcome.result }),
      });
      if (finishError) throw new Error('Planning completion failed');
      return;
    }
    const outcome = await brainstormWithGemini(apiKey, model, context);
    const { error: finishError } = await client.rpc('finish_brainstorm_request', {
      p_id: id, p_attempt_id: claim.attemptId,
      ...(outcome.reply === null ? { p_failure_code: outcome.failureCode } : { p_reply: outcome.reply }),
    });
    if (finishError) throw new Error('Planning completion failed');
  } catch {
    // Keep inputs, credentials and provider responses out of logs. Replay can recover an expired lease.
    console.error('Planning execution storage error', { requestId: id });
  }
}
