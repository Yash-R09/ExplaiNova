import { createHash } from 'node:crypto';
import { open } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getVideoMetadata } from '@remotion/renderer';
import { createClient } from '@supabase/supabase-js';

const bucketPattern = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;
const hostedStorageOrigin = /^https:\/\/[a-z0-9]+\.supabase\.co$/;
const localStorageOrigin = 'http://127.0.0.1:54321';
const videoLimit = 50_000_000;

async function readArtifact(path, limit) {
  const file = await open(path);
  try {
    const info = await file.stat();
    const { size } = info;
    if (!info.isFile() || size < 1) throw new Error('Render artifact is empty or unreadable.');
    if (size > limit) throw new Error(`Render artifact exceeds the ${limit} byte storage limit.`);
    const bytes = Buffer.alloc(size + 1);
    let length = 0;
    while (length < bytes.length) {
      const { bytesRead } = await file.read(bytes, length, bytes.length - length, length);
      if (!bytesRead) break;
      length += bytesRead;
    }
    if (length !== size) throw new Error('Render artifact changed while reading.');
    return bytes.subarray(0, size);
  } finally {
    await file.close();
  }
}

async function storeArtifact(objects, jobId, extension, contentType, bytes) {
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const key = `video-jobs/${jobId}/${sha256}.${extension}`;
  const { error: uploadError } = await objects.upload(key, bytes, { contentType, upsert: false });
  if (uploadError && String(uploadError.statusCode) !== '409') throw uploadError;

  const { data: stored, error } = await objects.download(key);
  if (error) throw error;
  if (!stored || stored.size !== bytes.length || stored.type !== contentType) {
    throw new Error('Stored artifact metadata does not match.');
  }
  const checksum = createHash('sha256');
  for await (const chunk of stored.stream()) checksum.update(chunk);
  if (checksum.digest('hex') !== sha256) throw new Error('Stored artifact bytes do not match.');
  return { sha256, size: stored.size };
}

export async function storeVideoJob({ rpc, storage, storageOrigin, bucket, renderRoot, jobId, inspectVideo = getVideoMetadata }) {
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(jobId)) throw new Error('Provide a video job UUID.');
  if (!bucketPattern.test(bucket)) throw new Error('Provide a valid Supabase Storage bucket name.');
  if (storageOrigin !== localStorageOrigin && !hostedStorageOrigin.test(storageOrigin)) {
    throw new Error('Provide a valid Supabase Storage origin.');
  }
  jobId = jobId.toLowerCase();
  const manifest = await rpc('read_video_storage_inputs', { p_job_id: jobId });
  if (!manifest) throw new Error('This job is not ready for artifact storage.');
  if (manifest.complete) {
    if (manifest.storageOrigin !== storageOrigin || manifest.bucket !== bucket) {
      throw new Error('This job was completed with a different or unrecorded storage destination.');
    }
    return;
  }
  if (!/^[0-9a-f]{64}$/.test(manifest.videoSha256)) throw new Error('This job has no recorded render. Run the render worker first.');

  const videoPath = join(renderRoot, jobId, 'video.mp4');
  const captions = await readArtifact(join(renderRoot, jobId, 'captions.srt'), 131072);
  if (captions.toString('utf8') !== manifest.srt || ![900, 1800, 2700].includes(manifest.durationFrames)) {
    throw new Error('Local captions or duration do not match the saved assembly.');
  }
  const video = await readArtifact(videoPath, videoLimit);
  if (createHash('sha256').update(video).digest('hex') !== manifest.videoSha256) {
    throw new Error('Local MP4 does not match the render recorded for this job.');
  }
  const metadata = await inspectVideo(videoPath);
  if (metadata.width !== 1080 || metadata.height !== 1920 || metadata.fps !== 30
    || metadata.codec !== 'h264' || metadata.audioCodec !== 'aac' || !Number.isFinite(metadata.durationInSeconds)
    || Math.abs(metadata.durationInSeconds - manifest.durationFrames / 30) > 1 / 30) {
    throw new Error('The rendered MP4 did not pass technical checks.');
  }

  let mp4;
  let srt;
  const { data: bucketInfo, error: bucketError } = await storage.getBucket(bucket);
  if (bucketError || bucketInfo?.public !== false) throw new Error('Configure an accessible private Supabase Storage bucket.');
  const objects = storage.from(bucket);
  try {
    mp4 = await storeArtifact(objects, jobId, 'mp4', 'video/mp4', video);
    srt = await storeArtifact(objects, jobId, 'srt', 'application/x-subrip', captions);
  } catch (error) {
    throw new Error('Supabase Storage upload or verification failed. Rerun the storage worker to retry.', { cause: error });
  }
  if (!await rpc('complete_video_storage', {
    p_job_id: jobId, p_storage_origin: storageOrigin, p_bucket: bucket,
    p_video_sha256: mp4.sha256, p_video_bytes: mp4.size,
    p_srt_sha256: srt.sha256, p_srt_bytes: srt.size,
  })) throw new Error('The job changed before storage could be finalized.');
}

async function main() {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_STORAGE_URL, SUPABASE_STORAGE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || new URL(SUPABASE_URL).origin !== localStorageOrigin || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Local Supabase worker configuration is incomplete.');
  }
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, options);
  let storage = client.storage;
  let storageOrigin = localStorageOrigin;
  if (SUPABASE_STORAGE_URL || SUPABASE_STORAGE_SERVICE_ROLE_KEY) {
    storageOrigin = SUPABASE_STORAGE_URL?.replace(/\/$/, '');
    if (!hostedStorageOrigin.test(storageOrigin) || !SUPABASE_STORAGE_SERVICE_ROLE_KEY) {
      throw new Error('Hosted Supabase Storage configuration is incomplete.');
    }
    storage = createClient(storageOrigin, SUPABASE_STORAGE_SERVICE_ROLE_KEY, options).storage;
  }
  await storeVideoJob({
    storage, storageOrigin, bucket: 'explainova-videos', jobId: process.argv[2],
    renderRoot: fileURLToPath(new URL('../../../outputs/render-worker/', import.meta.url)),
    rpc: async (name, args) => {
      const { data, error } = await client.rpc(name, args);
      if (error) throw new Error('Worker database request failed. Rerun the storage worker to retry.');
      return data;
    },
  });
  console.log('Video job complete. MP4 and captions are stored in private Supabase Storage.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
