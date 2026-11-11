import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { narrationAudio, runNarrationJob } from '../apps/web/scripts/video-narration.mjs';

function providerAudio(text) {
  const characters = Array.from(text);
  return { audio_base64: Buffer.alloc(32000).toString('base64'), alignment: {
    characters, character_start_times_seconds: characters.map((_, index) => index / 100),
    character_end_times_seconds: characters.map((_, index) => (index + 1) / 100),
  } };
}

test('rejects missing or out-of-range provider timing for the approved text', () => {
  const data = providerAudio('A short line.');
  assert.throws(() => narrationAudio(data, 'Different narration.'), /timing/);
  data.alignment.character_end_times_seconds[0] = 10;
  assert.throws(() => narrationAudio(data, 'A short line.'), /timing/);
});

test('worker checkpoints approved scenes and reuses audio after a lost database acknowledgement', async t => {
  const outputRoot = await mkdtemp(join(tmpdir(), 'explainova-narration-'));
  t.after(() => rm(outputRoot, { recursive: true, force: true }));
  const claim = {
    jobId: '11111111-1111-4111-8111-111111111111', leaseToken: '22222222-2222-4222-8222-222222222222',
    contentHash: 'a'.repeat(64), settings: { voice: 'male' },
    storyboard: { scenes: [{ narration: 'First scene.' }, { narration: 'Second scene.' }] },
  };
  const requests = [];
  let manifest;
  let completions = 0;
  const rpc = async (name, args) => {
    if (name === 'claim_video_job') return claim;
    if (name === 'renew_video_job_lease') return 'renewed';
    assert.equal(name, 'complete_video_narration');
    assert.equal(args.p_lease_token, claim.leaseToken);
    if (++completions === 1) throw new Error('Database response lost');
    manifest = args.p_manifest;
    return true;
  };
  const send = async (url, init) => {
    assert.match(url, /male-fixture\/with-timestamps/);
    const { text } = JSON.parse(init.body);
    requests.push(text);
    return Response.json(providerAudio(text));
  };
  const options = { rpc, outputRoot, voices: { male: { voiceId: 'male-fixture', category: 'premade' } }, apiKey: 'fixture', send };
  await assert.rejects(runNarrationJob(options), /Database response lost/);
  assert.equal(await runNarrationJob(options), 'narration_ready');
  assert.deepEqual(requests, ['First scene.', 'Second scene.']);
  const first = JSON.parse(await readFile(join(outputRoot, claim.jobId, manifest.scenes[0].file), 'utf8'));
  assert.deepEqual(first.words.map(word => word.text), ['First', 'scene.']);
  assert.equal(Buffer.from(first.wavBase64, 'base64').toString('ascii', 0, 4), 'RIFF');
});
