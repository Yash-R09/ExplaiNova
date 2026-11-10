import { after } from 'next/server';
import { projectApi, projectBody, projectSuccess, databaseProjectError } from '@/lib/project-api';
import { commandKey, projectId, ProjectError } from '@/lib/project-contract';
import { planningInput } from '@/lib/planning-contract';
import { executeBrainstormRequest } from '@/lib/brainstorm-execution';

type Context = { params: Promise<{ id: string }> };
export const maxDuration = 60;

export async function POST(request: Request, { params }: Context) {
  return projectApi(async (client, requestId, ownerId) => {
    const id = projectId((await params).id);
    const input = planningInput(await projectBody(request));
    const key = commandKey(request.headers.get('idempotency-key'));
    const { data, error } = await client.rpc('submit_brainstorm_request', {
      p_id: id, p_command: input, p_command_key: key,
    });
    if (error) databaseProjectError(error);
    if (data && typeof data === 'object' && !Array.isArray(data) && typeof data.id === 'string') {
      const planningId = data.id;
      after(() => executeBrainstormRequest(planningId, id, ownerId));
    }
    return projectSuccess(data, requestId, 202);
  });
}

export async function GET(request: Request, { params }: Context) {
  return projectApi(async (client, requestId) => {
    const id = projectId((await params).id);
    if (new URL(request.url).search) throw new ProjectError('VALIDATION_FAILED', 400, 'Invalid planning history query.');
    const { error: projectError } = await client.rpc('get_idea_project', { p_id: id });
    if (projectError) databaseProjectError(projectError);
    const { data, error } = await client.from('planning_requests')
      .select('id, project_id, project_revision, message, created_at, status, reply, failure_code, lease_until')
      .eq('project_id', id).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(20);
    if (error) databaseProjectError(error);
    return projectSuccess(data.map(row => ({
      id: row.id, projectId: row.project_id, projectRevision: row.project_revision,
      message: row.message, createdAt: row.created_at, mode: 'brainstorm', status: row.status,
      result: row.reply === null ? null : { reply: row.reply },
      ...(row.failure_code === null ? {} : { failureCode: row.failure_code }),
      ...(row.status === 'running' && row.lease_until && Date.parse(row.lease_until) <= Date.now()
        ? { canResume: true } : {}),
    })), requestId);
  });
}
