import { databaseProjectError, projectApi, projectBody, projectSuccess } from '@/lib/project-api';
import { commandKey, projectId, ProjectError, uuidPattern } from '@/lib/project-contract';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return projectApi(async (client, correlationId) => {
    const id = projectId((await params).id);
    const key = commandKey(request.headers.get('idempotency-key'));
    const body = await projectBody(request);
    const invalid = () => new ProjectError('VALIDATION_FAILED', 422, 'Select the saved storyboard revision to approve.');
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw invalid();
    const { expectedRevision, revisionId, ...rest } = body as Record<string, unknown>;
    if (Object.keys(rest).length || typeof expectedRevision !== 'number' || !Number.isInteger(expectedRevision)
      || expectedRevision < 1 || expectedRevision > 2147483647 || typeof revisionId !== 'string' || !uuidPattern.test(revisionId)) throw invalid();
    const { data, error } = await client.rpc('approve_storyboard_revision', {
      p_id: id, p_expected_revision: expectedRevision, p_revision_id: revisionId, p_command_key: key,
    });
    if (error) databaseProjectError(error);
    return projectSuccess(data, correlationId, 201);
  });
}
