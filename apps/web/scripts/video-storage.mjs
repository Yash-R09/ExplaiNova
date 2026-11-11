import { createHash } from 'node:crypto';
import { open } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getVideoMetadata } from '@remotion/renderer';
import { createClient } from '@supabase/supabase-js';

const bucketPattern = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;

async function readArtifact(path, limit) {
  const file = await open(path);
  try {
    const info = await file.stat();
    const { size } = info;
    if (!info.isFile() || size < 1 || size > limit) throw new Error('Render artifact has an invalid size.');
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

async function storeArtifact(s3, bucket, jobId, extension, contentType, bytes) {
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const object = { Bucket: bucket, Key: `video-jobs/${jobId}/${sha256}.${extension}` };
  try {
    await s3.send(new PutObjectCommand({
      ...object, Body: bytes, ContentLength: bytes.length, ContentType: contentType, IfNoneMatch: '*',
    }));
  } catch (error) {
    if (error.$metadata?.httpStatusCode !== 412) throw error;
  }

  const stored = await s3.send(new GetObjectCommand(object));
  const checksum = createHash('sha256');
  let size = 0;
  try {
    if (!stored.Body || stored.ContentLength !== bytes.length || stored.ContentType !== contentType) {
      throw new Error('Stored artifact metadata does not match.');
    }
    for await (const chunk of stored.Body) {
      size += chunk.length;
      if (size > bytes.length) throw new Error('Stored artifact is larger than expected.');
      checksum.update(chunk);
    }
    if (size !== bytes.length || checksum.digest('hex') !== sha256) throw new Error('Stored artifact bytes do not match.');
  } finally {
    stored.Body?.destroy();
  }
  return { sha256, size };
}

export async function storeVideoJob({ rpc, s3, bucket, renderRoot, jobId, inspectVideo = getVideoMetadata }) {
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(jobId)) throw new Error('Provide a video job UUID.');
  if (!bucketPattern.test(bucket)) throw new Error('Provide a valid R2 bucket name.');
  jobId = jobId.toLowerCase();
  const manifest = await rpc('read_video_storage_inputs', { p_job_id: jobId });
  if (!manifest) throw new Error('This job is not ready for artifact storage.');
  if (manifest.complete) return;
  if (!/^[0-9a-f]{64}$/.test(manifest.videoSha256)) throw new Error('This job has no recorded render. Run the render worker first.');

  const videoPath = join(renderRoot, jobId, 'video.mp4');
  const captions = await readArtifact(join(renderRoot, jobId, 'captions.srt'), 131072);
  if (captions.toString('utf8') !== manifest.srt || ![900, 1800, 2700].includes(manifest.durationFrames)) {
    throw new Error('Local captions or duration do not match the saved assembly.');
  }
  const video = await readArtifact(videoPath, 268435456);
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
  try {
    mp4 = await storeArtifact(s3, bucket, jobId, 'mp4', 'video/mp4', video);
    srt = await storeArtifact(s3, bucket, jobId, 'srt', 'application/x-subrip', captions);
  } catch (error) {
    throw new Error('R2 upload or verification failed. Rerun the storage worker to retry.', { cause: error });
  }
  if (!await rpc('complete_video_storage', {
    p_job_id: jobId, p_bucket: bucket, p_video_sha256: mp4.sha256, p_video_bytes: mp4.size,
    p_srt_sha256: srt.sha256, p_srt_bytes: srt.size,
  })) throw new Error('The job changed before storage could be finalized.');
}

async function main() {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;
  if (!SUPABASE_URL || new URL(SUPABASE_URL).origin !== 'http://127.0.0.1:54321' || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Local Supabase worker configuration is incomplete.');
  }
  if (!R2_ACCOUNT_ID || !/^[a-f0-9]{32}$/i.test(R2_ACCOUNT_ID) || !R2_BUCKET || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    throw new Error('Private staging R2 worker configuration is incomplete.');
  }
  const s3 = new S3Client({
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`, region: 'auto', forcePathStyle: true,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
    requestChecksumCalculation: 'WHEN_REQUIRED', responseChecksumValidation: 'WHEN_REQUIRED',
  });
  const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    await storeVideoJob({
      s3, bucket: R2_BUCKET, jobId: process.argv[2],
      renderRoot: fileURLToPath(new URL('../../../outputs/render-worker/', import.meta.url)),
      rpc: async (name, args) => {
        const { data, error } = await client.rpc(name, args);
        if (error) throw new Error('Worker database request failed. Rerun the storage worker to retry.');
        return data;
      },
    });
    console.log('Video job complete. MP4 and captions are stored in private R2.');
  } finally {
    s3.destroy();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
