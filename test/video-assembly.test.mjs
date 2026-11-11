import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { pcmWav } from '../elevenlabs.mjs';
import { assembleVideoJob } from '../apps/web/scripts/video-assembly.mjs';

async function fixture(t, durations) {
  const outputRoot = await mkdtemp(join(tmpdir(), 'explainova-assembly-'));
  t.after(() => rm(outputRoot, { recursive: true, force: true }));
  const jobId = '11111111-1111-4111-8111-111111111111';
  await mkdir(join(outputRoot, jobId));
  const contentHash = 'a'.repeat(64);
  const scenes = durations.map((_, index) => ({
    title: `Scene ${index + 1}`, type: 'illustration', narration: 'An approved scene.',
    durationMs: 15000, startMs: index * 15000,
  }));
  const entries = await Promise.all(durations.map(async (durationSeconds, index) => {
    const file = String(index + 1).repeat(64) + '.json';
    await writeFile(join(outputRoot, jobId, file), JSON.stringify({
      wavBase64: pcmWav(Buffer.alloc(durationSeconds * 32000)).toString('base64'),
      words: [{ text: 'An', start: 0.1 }, { text: 'approved', start: 0.2 }, { text: 'scene.', start: 0.4 }],
      durationSeconds,
    }));
    return { file, scene: index + 1, durationSeconds };
  }));
  const calls = [];
  const inputs = { contentHash, settings: { captions: true },
    storyboard: { title: 'Approved', theme: 'Blue', targetDurationMs: 30000, scenes },
    narration: { version: 1, contentHash, scenes: entries } };
  const rpc = async (name, args) => {
    calls.push({ name, args });
    return name === 'read_video_assembly_inputs' ? inputs : true;
  };
  return { rpc, outputRoot, jobId, calls, inputs };
}

test('assembly uses actual audio length, offsets captions, and emits a repeatable manifest', async t => {
  const options = await fixture(t, [20, 5]);
  const manifest = await assembleVideoJob(options);
  assert.equal(manifest.durationFrames, 900);
  assert.deepEqual(manifest.scenes.map(({ startFrame, durationFrames }) => [startFrame, durationFrames]), [[0, 600], [600, 300]]);
  assert.match(manifest.srt, /00:00:20,100 --> 00:00:25,000/);
  assert.deepEqual(await assembleVideoJob(options), manifest);
  assert.deepEqual(options.calls[1].args.p_manifest, manifest);
});

test('assembly rejects traversal and flags audio that cannot fit the approved target', async t => {
  const options = await fixture(t, [20, 20]);
  const first = options.inputs.narration.scenes[0];
  const file = first.file;
  first.file = '../foreign.json';
  await assert.rejects(assembleVideoJob(options), /missing or invalid/);
  assert.equal(options.calls.at(-1).args.p_error_code, 'VIDEO_NARRATION_CHECKPOINT_INVALID');
  first.file = file;
  await assert.rejects(assembleVideoJob(options), /exceeds the approved duration/);
  assert.equal(options.calls.at(-1).args.p_error_code, 'VIDEO_NARRATION_TOO_LONG');
});

test('missing or corrupt checkpoint files report terminal assembly failure', async t => {
  const options = await fixture(t, [5, 5]);
  const file = options.inputs.narration.scenes[0].file;
  const path = join(options.outputRoot, options.jobId, file);
  await rm(path);
  await assert.rejects(assembleVideoJob(options), /missing or invalid/);
  await writeFile(path, '{invalid json');
  await assert.rejects(assembleVideoJob(options), /missing or invalid/);
  assert.deepEqual(options.calls.filter(call => call.name === 'fail_video_assembly').map(call => call.args), [
    { p_job_id: options.jobId, p_error_code: 'VIDEO_NARRATION_CHECKPOINT_INVALID' },
    { p_job_id: options.jobId, p_error_code: 'VIDEO_NARRATION_CHECKPOINT_INVALID' },
  ]);
});
