import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { localAuthHarness } from './local-form-support.mjs';

const { admin, request, browserSession } = localAuthHarness();
const users = [];

async function post(path, jar, data, key = randomUUID()) {
  return request(path, jar, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
    body: JSON.stringify(data),
  });
}

try {
  for (let index = 0; index < 2; index++) {
    const email = `planning-${randomUUID()}@example.test`;
    const password = randomUUID() + 'aA1!';
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    assert.ifError(error);
    const user = { id: data.user.id };
    users.push(user);
    user.jar = await browserSession(email, password);
  }
  const [owner, other] = users;
  const created = await post('/api/v1/projects', owner.jar, { title: 'Orbit' });
  assert.equal(created.status, 201);
  const { data: project } = await created.json();
  const path = `/api/v1/projects/${project.id}/planning-jobs`;
  const command = { expectedRevision: 1, mode: 'brainstorm', message: 'Suggest two opening questions.' };
  const key = randomUUID();
  assert.equal((await post(path, owner.jar, { ...command, message: '\t\n\u00a0\ufeff' }, key)).status, 422);
  const replies = await Promise.all([post(path, owner.jar, command, key), post(path, owner.jar, command, key)]);
  for (const reply of replies) assert.equal(reply.status, 202);
  const [first, replay] = await Promise.all(replies.map(reply => reply.json()));
  assert.deepEqual(first.data, replay.data);
  assert.equal(first.data.projectRevision, 1);
  assert.equal(first.data.status, 'queued');
  assert.equal(first.data.result, null);
  assert.equal((await post(path, owner.jar, { ...command, message: 'Different' }, key)).status, 409);
  assert.equal((await post(path, owner.jar, { ...command, expectedRevision: 2 })).status, 409);
  assert.equal((await post(path, owner.jar, { ...command, mode: 'storyboard' })).status, 422);
  assert.equal((await post(path, other.jar, command)).status, 404);
  assert.equal((await request(path, other.jar)).status, 404);
  const history = await request(path, owner.jar);
  assert.equal(history.status, 200);
  assert.match(history.headers.get('cache-control') ?? '', /no-store/);
  assert.deepEqual((await history.json()).data, [first.data]);
  console.log('Planning API integration passed.');
} finally {
  for (const user of users) {
    assert.ifError((await admin.from('projects').delete().eq('owner_id', user.id)).error);
    assert.ifError((await admin.from('profiles').delete().eq('owner_id', user.id)).error);
    assert.ifError((await admin.auth.admin.deleteUser(user.id)).error);
  }
}
