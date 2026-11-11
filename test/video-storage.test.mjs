import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { storeVideoJob } from '../apps/web/scripts/video-storage.mjs';

test('storage retries partial uploads and only finalizes after reading back matching bytes', async t => {
  const jobId = '11111111-1111-4111-8111-111111111111';
  const renderRoot = await mkdtemp(join(tmpdir(), 'explainova-storage-'));
  t.after(() => rm(renderRoot, { recursive: true, force: true }));
  await mkdir(join(renderRoot, jobId));
  const srt = '1\n00:00:00,000 --> 00:00:01,000\nExample\n';
  await writeFile(join(renderRoot, jobId, 'captions.srt'), srt);
  await writeFile(join(renderRoot, jobId, 'video.mp4'), 'test video');
  const videoSha256 = createHash('sha256').update('test video').digest('hex');

  const objects = new Map();
  const finalized = [];
  let failCaptions = true;
  let corruptVideo = false;
  let isPublic = false;
  const options = {
    renderRoot, jobId, bucket: 'staging', storageOrigin: 'https://projecta.supabase.co',
    inspectVideo: async () => ({ width: 1080, height: 1920, fps: 30, codec: 'h264', audioCodec: 'aac', durationInSeconds: 30 }),
    rpc: async (name, args) => {
      if (name === 'read_video_storage_inputs') return {
        srt, durationFrames: 900, videoSha256, complete: finalized.length > 0,
        storageOrigin: finalized[0]?.p_storage_origin, bucket: finalized[0]?.p_bucket,
      };
      assert.equal(name, 'complete_video_storage');
      finalized.push(args);
      return true;
    },
    storage: {
      async getBucket() { return { data: { public: isPublic } }; },
      from() {
        return {
          async upload(key, bytes, { contentType, upsert }) {
            assert.equal(upsert, false);
            if (objects.has(key)) return { error: { statusCode: '409' } };
            if (failCaptions && key.endsWith('.srt')) return { error: new Error('Storage unavailable') };
            objects.set(key, { bytes, contentType });
            return {};
          },
          async download(key) {
            const saved = objects.get(key);
            const bytes = corruptVideo && key.endsWith('.mp4') ? Buffer.alloc(saved.bytes.length) : saved.bytes;
            return { data: new Blob([bytes], { type: saved.contentType }) };
          },
        };
      },
    },
  };

  await writeFile(join(renderRoot, jobId, 'video.mp4'), 'swap video');
  await assert.rejects(storeVideoJob(options), /does not match the render recorded for this job/);
  assert.equal(objects.size, 0);
  assert.equal(finalized.length, 0);
  await writeFile(join(renderRoot, jobId, 'video.mp4'), 'test video');
  isPublic = true;
  await assert.rejects(storeVideoJob(options), /private Supabase Storage bucket/);
  assert.equal(objects.size, 0);
  isPublic = false;
  await assert.rejects(storeVideoJob(options), /Supabase Storage upload or verification failed/);
  assert.equal(objects.size, 1);
  assert.equal(finalized.length, 0);
  failCaptions = false;
  corruptVideo = true;
  await assert.rejects(storeVideoJob(options), /Supabase Storage upload or verification failed/);
  assert.equal(finalized.length, 0);
  corruptVideo = false;
  await storeVideoJob(options);
  await storeVideoJob(options);
  await assert.rejects(storeVideoJob({ ...options, storageOrigin: 'https://projectb.supabase.co' }), /different or unrecorded storage destination/);
  assert.equal(finalized.length, 1);
  assert.equal(finalized[0].p_storage_origin, options.storageOrigin);
  assert.equal(objects.size, 2);
  assert.ok(objects.has(`video-jobs/${jobId}/${finalized[0].p_video_sha256}.mp4`));
  assert.ok(objects.has(`video-jobs/${jobId}/${finalized[0].p_srt_sha256}.srt`));
});
