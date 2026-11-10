import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { localAuthHarness } from './local-form-support.mjs';

const { admin, request, browserSession } = localAuthHarness();
const users = [];
const exerciseExecution = process.env.PLANNING_TEST_EXECUTION === '1';

async function terminalRequest(path, jar, id) {
  for (let attempt = 0; attempt < 50; attempt++) {
    const history = await request(path, jar);
    assert.equal(history.status, 200);
    const row = (await history.json()).data.find(entry => entry.id === id);
    if (row?.status === 'succeeded' || row?.status === 'failed') return row;
    await delay(100);
  }
  assert.fail('Brainstorm request did not reach a terminal state');
}

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
  const workspace = await request(`/projects/${project.id}`, owner.jar);
  assert.equal(workspace.status, 200);
  assert.match(await workspace.text(), /Brainstorm with AI/);
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
  const resumePath = `${path}/${first.data.id}/resume`;
  assert.equal((await post(resumePath, other.jar, {})).status, 404);
  assert.equal((await post(resumePath, owner.jar, { message: 'Unexpected' })).status, 422);
  const resumed = await post(resumePath, owner.jar, {});
  assert.equal(resumed.status, 202);
  assert.equal((await resumed.json()).data.id, first.data.id);
  const history = await request(path, owner.jar);
  assert.equal(history.status, 200);
  assert.match(history.headers.get('cache-control') ?? '', /no-store/);
  const { data: historyRows } = await history.json();
  assert.deepEqual(historyRows.map(row => row.id), [first.data.id]);
  if (exerciseExecution) {
    const completed = await terminalRequest(path, owner.jar, first.data.id);
    assert.equal(completed.status, 'succeeded');
    assert.deepEqual(completed.result, { reply: 'Open with a falling satellite.' });
    const rejected = await post(path, owner.jar, { ...command, message: 'Simulate quota' });
    assert.equal(rejected.status, 202);
    const failed = await terminalRequest(path, owner.jar, (await rejected.json()).data.id);
    assert.equal(failed.status, 'failed');
    assert.equal(failed.failureCode, 'PROVIDER_RATE_LIMITED');
    assert.equal(failed.result, null);
  } else {
    assert.deepEqual(historyRows, [first.data]);
  }
  const second = await post('/api/v1/projects', owner.jar, { title: 'Orbit' });
  assert.equal(second.status, 201);
  const secondPath = `/api/v1/projects/${(await second.json()).data.id}/planning-jobs`;
  const acceptedBeforeBurst = exerciseExecution ? 2 : 1;
  const burst = await Promise.all(Array.from({ length: 11 - acceptedBeforeBurst }, (_, index) =>
    post(index % 2 ? secondPath : path, owner.jar, command)));
  assert.equal(burst.filter(response => response.status === 202).length, 10 - acceptedBeforeBurst);
  const limited = burst.filter(response => response.status === 429);
  assert.equal(limited.length, 1);
  const retryAfter = Number(limited[0].headers.get('retry-after'));
  assert.ok(retryAfter > 0 && retryAfter <= 3600);
  assert.equal((await limited[0].json()).error.code, 'BRAINSTORM_RATE_LIMITED');
  assert.deepEqual((await (await post(path, owner.jar, command, key)).json()).data, first.data);

  const independent = await post('/api/v1/projects', other.jar, { title: 'Orbit' });
  assert.equal(independent.status, 201);
  const independentPath = `/api/v1/projects/${(await independent.json()).data.id}/planning-jobs`;
  assert.equal((await post(independentPath, other.jar, command)).status, 202);
  console.log('Planning API integration passed.');
} finally {
  for (const user of users) {
    assert.ifError((await admin.from('projects').delete().eq('owner_id', user.id)).error);
    assert.ifError((await admin.from('profiles').delete().eq('owner_id', user.id)).error);
    assert.ifError((await admin.auth.admin.deleteUser(user.id)).error);
  }
}
