import { databaseProjectError, projectApi, projectBody, projectSuccess } from '@/lib/project-api';
import { commandKey, projectId, ProjectError } from '@/lib/project-contract';
import { storyboardEdit } from '@/lib/storyboard-contract';
import { readStoryboard, storyboardSource } from '@/lib/storyboards';
import { createServiceClient } from '@/lib/supabase/service';

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  return projectApi(async (client, requestId) =>
    projectSuccess(await readStoryboard(client, projectId((await params).id)), requestId));
}

export async function PATCH(request: Request, { params }: Context) {
  return projectApi(async (client, requestId, ownerId) => {
    const id = projectId((await params).id);
    const body = await projectBody(request);
    const key = commandKey(request.headers.get('idempotency-key'));
    const source = await storyboardSource(client, id);
    const edit = storyboardEdit(body, source.content.targetDurationMs);
    const service = createServiceClient();
    if (!service) throw new ProjectError('TEMPORARILY_UNAVAILABLE', 503, 'Storyboard saving is temporarily unavailable.');
    const { data, error } = await service.rpc('save_storyboard_revision', {
      p_owner: ownerId, p_id: id, p_expected_revision: edit.expectedRevision,
      p_content: edit.content, p_command_key: key,
    });
    if (error) databaseProjectError(error);
    return projectSuccess(data, requestId, 201);
  });
}
