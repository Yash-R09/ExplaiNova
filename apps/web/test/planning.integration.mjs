import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
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
  const workspaceHtml = await workspace.text();
  assert.match(workspaceHtml, /Brainstorm with AI/);
  assert.match(workspaceHtml, /Generate storyboard/);
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
  assert.equal((await post(path, owner.jar, { ...command, mode: 'revise' })).status, 422);
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
  const { data: independentProject } = await independent.json();
  const independentPath = `/api/v1/projects/${independentProject.id}/planning-jobs`;
  assert.equal((await post(independentPath, other.jar, command)).status, 202);
  if (exerciseExecution) {
    const storyboardCommand = { expectedRevision: 1, mode: 'storyboard' };
    const emptyDraft = await post('/api/v1/projects', other.jar, {});
    assert.equal(emptyDraft.status, 201);
    const emptyPath = `/api/v1/projects/${(await emptyDraft.json()).data.id}/planning-jobs`;
    const emptyStoryboard = await post(emptyPath, other.jar, storyboardCommand);
    assert.equal(emptyStoryboard.status, 422);
    assert.equal((await emptyStoryboard.json()).error.code, 'STORYBOARD_IDEA_REQUIRED');
    const storyboardKey = randomUUID();
    const storyboardRequest = await post(independentPath, other.jar, storyboardCommand, storyboardKey);
    assert.equal(storyboardRequest.status, 202);
    const { data: storyboardReceipt } = await storyboardRequest.json();
    assert.equal(storyboardReceipt.mode, 'storyboard');
    const { data: storyboardReplay } = await (await post(independentPath, other.jar, storyboardCommand, storyboardKey)).json();
    assert.deepEqual(storyboardReplay, storyboardReceipt);
    const storyboard = await terminalRequest(independentPath, other.jar, storyboardReceipt.id);
    assert.equal(storyboard.status, 'succeeded');
    assert.equal(storyboard.result.storyboardId, storyboardReceipt.id);
    assert.equal(storyboard.result.storyboard.scenes.length, 4);
    assert.equal(storyboard.result.storyboard.scenes.reduce((sum, scene) => sum + scene.durationMs, 0), 60000);
    assert.equal((await request(independentPath, owner.jar)).status, 404);

    const reviewPath = `/storyboards/${storyboard.id}`;
    const storyboardPath = `/api/v1${reviewPath}`;
    const reviewPage = await request(reviewPath, other.jar);
    assert.equal(reviewPage.status, 200);
    assert.match(await reviewPage.text(), /Save storyboard/);
    assert.equal((await request(storyboardPath, owner.jar)).status, 404);
    const initial = (await (await request(storyboardPath, other.jar)).json()).data;
    assert.equal(initial.revision, 1);
    assert.deepEqual(initial.content, storyboard.result.storyboard);

    const edit = { expectedRevision: 1, content: structuredClone(initial.content) };
    edit.content.scenes[0].narration = 'Gravity keeps a satellite moving around Earth.';
    const saveEdit = (jar, body, key = randomUUID()) => request(storyboardPath, jar, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
      body: JSON.stringify(body),
    });
    assert.equal((await saveEdit(owner.jar, edit)).status, 404);
    const invalid = structuredClone(edit);
    invalid.content.scenes[0].narration = '   ';
    assert.equal((await saveEdit(other.jar, invalid)).status, 422);
    const saveKeys = [randomUUID(), randomUUID()];
    const saves = await Promise.all(saveKeys.map(key => saveEdit(other.jar, edit, key)));
    assert.deepEqual(saves.map(response => response.status).sort(), [201, 409]);
    const successfulIndex = saves.findIndex(response => response.status === 201);
    const saved = (await saves[successfulIndex].json()).data;
    assert.equal(saved.revision, 2);
    assert.notEqual(saved.revisionId, initial.revisionId);
    assert.equal(saved.content.scenes[0].narration, edit.content.scenes[0].narration);
    assert.equal(saved.content.scenes.reduce((sum, scene) => sum + scene.durationMs, 0), 60000);
    const nextEdit = { expectedRevision: 2, content: { ...saved.content, title: 'How a satellite stays in orbit' } };
    assert.equal((await saveEdit(other.jar, nextEdit)).status, 201);
    const savedAgain = await saveEdit(other.jar, edit, saveKeys[successfulIndex]);
    assert.equal(savedAgain.status, 201);
    assert.deepEqual((await savedAgain.json()).data, saved);
    const latest = (await (await request(storyboardPath, other.jar)).json()).data;
    assert.equal(latest.revision, 3);
    assert.equal(latest.content.title, nextEdit.content.title);

    const malformed = await post(independentPath, other.jar, { ...storyboardCommand, message: 'Simulate invalid storyboard' });
    assert.equal(malformed.status, 202);
    const failed = await terminalRequest(independentPath, other.jar, (await malformed.json()).data.id);
    assert.equal(failed.failureCode, 'INVALID_PROVIDER_OUTPUT');
    assert.equal(failed.result, null);
    const draft = await request(independentPath.replace('/planning-jobs', ''), other.jar);
    assert.equal((await draft.json()).data.revision, 1);

    // Simulate activity over several hours without bypassing the per-owner insert trigger.
    const fixtureIds = [other.id, independentProject.id];
    for (const id of fixtureIds) assert.match(id, /^[0-9a-f-]{36}$/i);
    const [fixtureOwner, fixtureProject] = fixtureIds;
    const backlogSql = `
      begin;
      update public.planning_requests set created_at = clock_timestamp() - interval '4 hours'
        where owner_id = '${fixtureOwner}' and project_id = '${fixtureProject}';
      insert into public.planning_requests(owner_id, project_id, project_revision, message, input_snapshot)
        select '${fixtureOwner}', '${fixtureProject}', 1, 'History fixture ' || n, '{}'
        from generate_series(1,10) n;
      update public.planning_requests set created_at = clock_timestamp() - interval '2 hours'
        where owner_id = '${fixtureOwner}' and project_id = '${fixtureProject}' and message like 'History fixture %';
      insert into public.planning_requests(owner_id, project_id, project_revision, message, input_snapshot)
        select '${fixtureOwner}', '${fixtureProject}', 1, 'History fixture ' || n, '{}'
        from generate_series(11,20) n;
      commit;
    `;
    execFileSync('docker', ['exec', '-i', 'supabase_db_explainova', 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres'],
      { input: backlogSql, stdio: ['pipe', 'pipe', 'pipe'] });
    const backlog = await request(independentPath, other.jar);
    assert.equal(backlog.status, 200);
    const { data: visibleHistory } = await backlog.json();
    const recentBrainstorms = visibleHistory.filter(row => row.mode === 'brainstorm');
    const savedStoryboard = visibleHistory.find(row => row.id === storyboard.id);
    assert.equal(recentBrainstorms.length, 20);
    assert.ok(savedStoryboard);
    assert.ok(recentBrainstorms.every(row => row.createdAt > savedStoryboard.createdAt));
    assert.deepEqual(savedStoryboard.result, storyboard.result);

    const trashed = await request(independentPath.replace('/planning-jobs', ''), other.jar, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': randomUUID() },
      body: JSON.stringify({ expectedRevision: 1 }),
    });
    assert.equal(trashed.status, 202);
    assert.equal((await request(storyboardPath, other.jar)).status, 404);
    assert.equal((await saveEdit(other.jar, edit, saveKeys[successfulIndex])).status, 404);
  }
  console.log('Planning API integration passed.');
} finally {
  for (const user of users) {
    assert.ifError((await admin.from('projects').delete().eq('owner_id', user.id)).error);
    assert.ifError((await admin.from('profiles').delete().eq('owner_id', user.id)).error);
    assert.ifError((await admin.auth.admin.deleteUser(user.id)).error);
  }
}
