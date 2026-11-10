import { after } from 'next/server';
import { executePlanningRequest } from '@/lib/planning-execution';
import { databaseProjectError, projectApi, projectBody, projectSuccess } from '@/lib/project-api';
import { commandKey, projectId, ProjectError } from '@/lib/project-contract';
import { storyboardSource } from '@/lib/storyboards';

type Context = { params: Promise<{ id: string }> };
export const maxDuration = 60;

export async function POST(request: Request, { params }: Context) {
  return projectApi(async (client, correlationId, ownerId) => {
    const id = projectId((await params).id);
    const key = commandKey(request.headers.get('idempotency-key'));
    const body = await projectBody(request);
    const invalid = () => new ProjectError('VALIDATION_FAILED', 422, 'Enter a change to request for the saved storyboard.');
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw invalid();
    const { expectedRevision, message, ...rest } = body as Record<string, unknown>;
    if (Object.keys(rest).length || typeof expectedRevision !== 'number' || !Number.isInteger(expectedRevision)
      || expectedRevision < 1 || expectedRevision > 2147483647 || typeof message !== 'string' || message.length > 4000
      || !message.trim() || message.includes('\0') || !message.isWellFormed()) throw invalid();
    const { data, error } = await client.rpc('submit_storyboard_suggestion', {
      p_id: id, p_expected_revision: expectedRevision, p_message: message.trim(), p_command_key: key,
    });
    if (error) databaseProjectError(error);
    if (data && typeof data === 'object' && !Array.isArray(data) && typeof data.id === 'string' && typeof data.projectId === 'string') {
      const { id: suggestionId, projectId: ownerProject } = data;
      after(() => executePlanningRequest(suggestionId, ownerProject, ownerId));
    }
    return projectSuccess(data, correlationId, 202);
  });
}

export async function GET(_request: Request, { params }: Context) {
  return projectApi(async (client, correlationId) => {
    const id = projectId((await params).id);
    await storyboardSource(client, id);
    const { data, error } = await client.from('planning_requests')
      .select('id, message, base_storyboard_revision, status, storyboard, lease_until')
      .eq('base_storyboard_id', id).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(20);
    if (error) databaseProjectError(error);
    return projectSuccess(data.map(row => ({
      id: row.id, message: row.message, baseRevision: row.base_storyboard_revision, status: row.status, content: row.storyboard,
      canResume: row.status === 'queued' || (row.status === 'running' && !!row.lease_until && Date.parse(row.lease_until) <= Date.now()),
    })), correlationId);
  });
}
