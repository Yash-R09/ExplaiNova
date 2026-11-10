import assert from 'node:assert/strict';
import test from 'node:test';
import { StoryboardAutosave } from '../src/lib/storyboard-autosave.ts';
import { validateStoryboardCandidate } from '../src/lib/storyboard-candidate.ts';
import type { StoryboardDocument } from '../src/lib/storyboard-contract.ts';

const scene = { title: 'Orbit', type: 'illustration', purpose: 'Introduce gravity', narration: 'Gravity bends the path.',
  objects: ['Earth'], labels: ['Gravity'], motion: 'Trace the orbit.' };
const content = validateStoryboardCandidate({
  title: 'Orbits', theme: 'Indigo diagrams', reviewNotes: [], scenes: Array.from({ length: 4 }, () => scene),
}, 60000)!;
const initial: StoryboardDocument = { id: 'story', projectId: 'project', projectRevision: 3, revisionId: 'story', revision: 1, content };
function storage() {
  const values = new Map<string, string>();
  return { get length() { return values.size; }, key: (index: number) => [...values.keys()][index] ?? null,
    getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); } };
}
function ack(init?: RequestInit) {
  const body = JSON.parse(String(init?.body));
  return Response.json({ data: { ...initial, content: body.content, revision: body.expectedRevision + 1, revisionId: crypto.randomUUID() } });
}
function editor(transport: typeof fetch, overrides: Partial<ConstructorParameters<typeof StoryboardAutosave>[0]> = {}) {
  return new StoryboardAutosave({ initial, ownerId: 'owner', storage: storage(), online: true, transport,
    notify: () => {}, debounceMs: 60000, ...overrides });
}

test('debounces edits and acknowledges only the snapshot sent', async () => {
  let complete!: (response: Response) => void;
  const writes: RequestInit[] = [];
  const story = editor(async (_url, init) => {
    writes.push(init!);
    return writes.length === 1 ? new Promise(resolve => { complete = resolve; }) : ack(init);
  });
  try {
    story.change(copy => ({ ...copy, title: 'First change' }));
    story.change(copy => ({ ...copy, title: 'First snapshot' }));
    assert.equal(writes.length, 0);
    const pending = story.flush();
    story.change(copy => ({ ...copy, title: 'Typed during save' }));
    await story.flush();
    assert.equal(writes.length, 1);
    complete(ack(writes[0]));
    await pending;
    assert.equal(story.view().saved.content.title, 'First snapshot');
    assert.equal(story.view().content.title, 'Typed during save');
    assert.equal(story.view().dirty, true);
    await story.flush();
    assert.equal(JSON.parse(String(writes[1].body)).expectedRevision, 2);
    assert.equal(story.view().status, 'saved');
  } finally { story.dispose(); }
});

test('a reopened uncertain save replays the exact operation before sending newer edits', async () => {
  const browser = storage();
  const writes: RequestInit[] = [];
  const before = editor(async (_url, init) => { writes.push(init!); throw new Error('response lost'); }, { storage: browser });
  before.change(copy => ({ ...copy, title: 'First snapshot' }));
  await before.flush();
  before.change(copy => ({ ...copy, title: 'Newer local text' }));
  before.dispose();
  const after = editor(async (_url, init) => { writes.push(init!); return ack(init); }, {
    storage: browser, initial: { ...initial, revision: 2, revisionId: 'second', content: { ...content, title: 'First snapshot' } },
  });
  try {
    assert.equal(after.view().status, 'recovery');
    after.restore(after.view().recoveries[0].key);
    await after.flush();
    assert.equal(writes[1].body, writes[0].body);
    assert.equal(new Headers(writes[1].headers).get('Idempotency-Key'), new Headers(writes[0].headers).get('Idempotency-Key'));
    assert.equal(after.view().content.title, 'Newer local text');
    await after.flush();
    assert.equal(JSON.parse(String(writes[2].body)).expectedRevision, 2);
    assert.equal(browser.length, 0);
  } finally { after.dispose(); }
});

test('replaying a saved request does not replace a newer version already loaded', async () => {
  const browser = storage();
  const before = editor(async () => { throw new Error('response lost'); }, { storage: browser });
  before.change(copy => ({ ...copy, title: 'Accepted but unconfirmed' }));
  await before.flush();
  before.dispose();
  const latest = { ...initial, revision: 3, revisionId: 'third', content: { ...content, title: 'Latest title' } };
  const after = editor(async (_url, init) => ack(init), { initial: latest, storage: browser });
  try {
    after.restore(after.view().recoveries[0].key);
    await after.flush();
    assert.equal(after.view().revision, 3);
    assert.equal(after.view().content.title, 'Latest title');
    assert.equal(after.view().status, 'saved');
    assert.equal(browser.length, 0);
  } finally { after.dispose(); }
});

test('offline and invalid edits remain recoverable without sending them', async () => {
  const browser = storage();
  let writes = 0;
  const transport: typeof fetch = async (_url, init) => { writes++; return ack(init); };
  const before = editor(transport, { storage: browser, online: false });
  before.change(copy => ({ ...copy, title: '' }));
  await before.flush();
  before.dispose();
  const after = editor(transport, { storage: browser, online: false });
  try {
    after.restore(after.view().recoveries[0].key);
    assert.equal(after.view().status, 'offline');
    assert.equal(after.view().content.title, '');
    after.connectivity(true);
    await after.flush();
    assert.equal(writes, 0);
    assert.equal(after.view().status, 'error');
    after.change(copy => ({ ...copy, title: 'Ready to save' }));
    await after.flush();
    assert.equal(writes, 1);
    assert.equal(after.view().status, 'saved');
  } finally { after.dispose(); }
});

test('stale recovered edits pause and an explicit overwrite uses the compared revision', async () => {
  const browser = storage();
  const before = editor(async () => { throw new Error(); }, { storage: browser, online: false });
  before.change(copy => ({ ...copy, title: 'Local title' }));
  before.dispose();
  const remote = { ...initial, revision: 2, revisionId: 'second', content: { ...content, title: 'Newer saved title' } };
  const writes: RequestInit[] = [];
  const after = editor(async (_url, init) => {
    if (init?.method !== 'PATCH') return Response.json({ data: remote });
    writes.push(init);
    return Response.json({ error: { code: 'REVISION_CONFLICT' } }, { status: 409 });
  }, { initial: remote, storage: browser });
  try {
    after.restore(after.view().recoveries[0].key);
    await after.flush();
    assert.equal(writes.length, 0);
    assert.equal(after.view().status, 'conflict');
    await after.compare();
    after.resolve('local');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(JSON.parse(String(writes[0].body)).expectedRevision, 2);
    assert.equal(after.view().status, 'conflict');
    assert.equal(after.view().content.title, 'Local title');
  } finally { after.dispose(); }
});

test('backup keys isolate owners and separate editors on the same storyboard', () => {
  const browser = storage();
  const transport: typeof fetch = async () => { throw new Error(); };
  const options = { storage: browser, online: false };
  const first = editor(transport, options);
  const second = editor(transport, options);
  first.change(copy => ({ ...copy, title: 'One' }));
  second.change(copy => ({ ...copy, title: 'Two' }));
  first.dispose();
  second.dispose();
  const other = editor(transport, { ...options, ownerId: 'another-owner' });
  const same = editor(transport, options);
  try {
    assert.equal(other.view().recoveries.length, 0);
    assert.deepEqual(same.view().recoveries.map(source => source.backup.content.title).sort(), ['One', 'Two']);
  } finally { other.dispose(); same.dispose(); }
});
