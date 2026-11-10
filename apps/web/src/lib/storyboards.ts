import 'server-only';
import { databaseProjectError } from './project-api';
import { ProjectError } from './project-contract';
import type { StoryboardCandidate } from './storyboard-candidate';
import type { StoryboardDocument } from './storyboard-contract';
import type { createClient } from './supabase/server';
import { validSettingsPatch, type DraftSettings } from './draft-preferences';

type Client = NonNullable<Awaited<ReturnType<typeof createClient>>>;

export async function storyboardSource(client: Client, id: string): Promise<StoryboardDocument> {
  const { data, error } = await client.from('planning_requests')
    .select('id, project_id, project_revision, storyboard, source_settings:input_snapshot->draft->settings')
    .eq('id', id).eq('mode', 'storyboard').eq('status', 'succeeded').is('base_storyboard_id', null).maybeSingle();
  if (error) databaseProjectError(error);
  if (!data?.storyboard) throw new ProjectError('RESOURCE_NOT_FOUND', 404, 'Storyboard not found.');
  const settings = data.source_settings;
  const sourceSettings = validSettingsPatch(settings) && Object.keys(settings).length === 3
    ? settings as DraftSettings : null;
  return {
    id, projectId: data.project_id, projectRevision: data.project_revision,
    revisionId: id, revision: 1, content: data.storyboard as StoryboardCandidate, sourceSettings,
  };
}

export async function readStoryboard(client: Client, id: string): Promise<StoryboardDocument> {
  const source = await storyboardSource(client, id);
  const { data, error } = await client.from('storyboard_revisions').select('id, revision, content')
    .eq('storyboard_id', id).order('revision', { ascending: false }).limit(1).maybeSingle();
  if (error) databaseProjectError(error);
  const document = data ? { ...source, revisionId: data.id, revision: data.revision, content: data.content as StoryboardCandidate } : source;
  const { data: approval, error: approvalError } = await client.from('storyboard_approvals')
    .select('id, revision_id, revision, content_hash, approved_at')
    .eq('storyboard_id', id).eq('revision_id', document.revisionId).eq('revision', document.revision).maybeSingle();
  if (approvalError) databaseProjectError(approvalError);
  return approval ? { ...document, approval: {
    id: approval.id, revisionId: approval.revision_id, revision: approval.revision,
    contentHash: approval.content_hash, approvedAt: approval.approved_at,
  } } : document;
}
