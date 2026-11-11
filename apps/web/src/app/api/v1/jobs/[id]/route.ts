import { databaseProjectError, projectApi, projectSuccess } from '@/lib/project-api';
import { projectId, ProjectError } from '@/lib/project-contract';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return projectApi(async (client, correlationId) => {
    const id = projectId((await params).id);
    const { data, error } = await client.from('generation_jobs')
      .select('id, project_id, approval_id, status, created_at, error_code, narration_ready_at').eq('id', id).maybeSingle();
    if (error) databaseProjectError(error);
    if (!data) throw new ProjectError('RESOURCE_NOT_FOUND', 404, 'Video job not found.');
    return projectSuccess({
      id: data.id, projectId: data.project_id, approvalId: data.approval_id,
      kind: 'video', status: data.status, createdAt: data.created_at,
      ...(data.error_code ? { errorCode: data.error_code } : {}),
      ...(data.narration_ready_at ? { narrationReadyAt: data.narration_ready_at } : {}),
    }, correlationId);
  });
}
