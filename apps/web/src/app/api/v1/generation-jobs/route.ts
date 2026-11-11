import { databaseProjectError, projectApi, projectBody, projectSuccess } from '@/lib/project-api';
import { commandKey, projectId, ProjectError } from '@/lib/project-contract';

export async function POST(request: Request) {
  return projectApi(async (client, correlationId) => {
    const key = commandKey(request.headers.get('idempotency-key'));
    const body = await projectBody(request);
    const invalid = () => new ProjectError('VALIDATION_FAILED', 422, 'Select a project and approved storyboard to queue a video.');
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw invalid();
    const { projectId: project, storyboardId, approvalId, ...rest } = body as Record<string, unknown>;
    if (Object.keys(rest).length) throw invalid();
    const { data, error } = await client.rpc('submit_video_job', {
      p_project_id: projectId(project), p_storyboard_id: projectId(storyboardId),
      p_approval_id: projectId(approvalId), p_command_key: key,
    });
    if (error) databaseProjectError(error);
    if (!data || typeof data !== 'object' || Array.isArray(data) || typeof data.id !== 'string') {
      throw new ProjectError('TEMPORARILY_UNAVAILABLE', 503, 'Job submission could not be confirmed. Retry with the same request key.');
    }
    return projectSuccess(data, correlationId, 202, {}, { Location: `/api/v1/jobs/${data.id}` });
  });
}
