import 'server-only';
import { databaseProjectError } from './project-api';
import { ProjectError } from './project-contract';
import type { StoryboardCandidate } from './storyboard-candidate';
import type { StoryboardDocument } from './storyboard-contract';
import type { createClient } from './supabase/server';

type Client = NonNullable<Awaited<ReturnType<typeof createClient>>>;

export async function storyboardSource(client: Client, id: string): Promise<StoryboardDocument> {
  const { data, error } = await client.from('planning_requests')
    .select('id, project_id, project_revision, storyboard')
    .eq('id', id).eq('mode', 'storyboard').eq('status', 'succeeded').is('base_storyboard_id', null).maybeSingle();
  if (error) databaseProjectError(error);
  if (!data?.storyboard) throw new ProjectError('RESOURCE_NOT_FOUND', 404, 'Storyboard not found.');
  return {
    id, projectId: data.project_id, projectRevision: data.project_revision,
    revisionId: id, revision: 1, content: data.storyboard as StoryboardCandidate,
  };
}

export async function readStoryboard(client: Client, id: string): Promise<StoryboardDocument> {
  const source = await storyboardSource(client, id);
  const { data, error } = await client.from('storyboard_revisions').select('id, revision, content')
    .eq('storyboard_id', id).order('revision', { ascending: false }).limit(1).maybeSingle();
  if (error) databaseProjectError(error);
  return data ? { ...source, revisionId: data.id, revision: data.revision, content: data.content as StoryboardCandidate } : source;
}
