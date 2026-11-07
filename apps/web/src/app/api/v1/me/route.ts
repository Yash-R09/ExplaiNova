import { readIdentity } from '@/lib/session';

export async function GET() {
  const identity = await readIdentity();
  const requestId = crypto.randomUUID();
  const headers = { 'Cache-Control': 'private, no-store' };
  if ('error' in identity) {
    const code = identity.error!;
    const status = code === 'SESSION_REQUIRED' ? 401 : code === 'ACCOUNT_UNAVAILABLE' ? 403 : 503;
    return Response.json({ error: { code, message: status === 401 ? 'Please sign in to continue.' : 'Your workspace is unavailable.', retryable: status === 503, correlationId: requestId } }, { status, headers });
  }
  const { user, profile } = identity;
  return Response.json({ data: { id: user.id, email: user.email, preferences: profile.preferences, version: profile.version, createdAt: profile.created_at, updatedAt: profile.updated_at }, meta: { requestId } }, { headers });
}
