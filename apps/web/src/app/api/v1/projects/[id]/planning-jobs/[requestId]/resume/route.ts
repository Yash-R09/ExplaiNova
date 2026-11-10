import { after } from 'next/server';
import { executePlanningRequest } from '@/lib/planning-execution';
import { databaseProjectError, projectApi, projectBody, projectSuccess } from '@/lib/project-api';
import { projectId, ProjectError } from '@/lib/project-contract';

export const maxDuration = 60;

export async function POST(request: Request, { params }: { params: Promise<{ id: string; requestId: string }> }) {
  return projectApi(async (client, correlationId, ownerId) => {
    const route = await params;
    const id = projectId(route.id);
    const planningId = projectId(route.requestId);
    const body = await projectBody(request);
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length) {
      throw new ProjectError('VALIDATION_FAILED', 422, 'Send an empty resume request.');
    }
    const { data, error } = await client.from('planning_requests')
      .select('id, status, lease_until').eq('id', planningId).eq('project_id', id).maybeSingle();
    if (error) databaseProjectError(error);
    if (!data) throw new ProjectError('RESOURCE_NOT_FOUND', 404, 'Planning request not found.');
    if (data.status === 'queued' || (data.status === 'running' && data.lease_until && Date.parse(data.lease_until) <= Date.now())) {
      after(() => executePlanningRequest(planningId, id, ownerId));
    }
    return projectSuccess({ id: planningId }, correlationId, 202);
  });
}
