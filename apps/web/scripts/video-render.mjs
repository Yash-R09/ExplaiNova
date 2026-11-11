import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, mkdtemp, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { createClient } from '@supabase/supabase-js';
import { toSrt } from '../../../lib.mjs';

const fps = 30;
const entryPoint = fileURLToPath(new URL('./render/Explainer.jsx', import.meta.url));
const hash = /^[0-9a-f]{64}$/;

async function hashVideo(path) {
  const digest = createHash('sha256');
  for await (const chunk of createReadStream(path)) digest.update(chunk);
  return digest.digest('hex');
}

export async function renderVideoJob({ rpc, narrationRoot, renderRoot, jobId, browserExecutable, onProgress }) {
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(jobId)) throw new Error('Provide a video job UUID.');
  jobId = jobId.toLowerCase();
  renderRoot = resolve(renderRoot);
  const manifest = await rpc('read_video_render_inputs', { p_job_id: jobId });
  if (!manifest) throw new Error('This job is not ready to render.');
  if (manifest.version !== 1 || manifest.fps !== fps || ![900, 1800, 2700].includes(manifest.durationFrames)
    || !hash.test(manifest.contentHash) || typeof manifest.theme !== 'string' || !Array.isArray(manifest.scenes)
    || manifest.scenes.length < 1 || manifest.scenes.length > 10) {
    throw new Error('Invalid assembly manifest.');
  }

  const destination = join(renderRoot, jobId);
  async function recordPublishedRender() {
    try {
      await stat(destination);
    } catch (error) {
      if (error.code === 'ENOENT') return false;
      throw error;
    }
    let receipt;
    try {
      receipt = JSON.parse(await readFile(join(destination, 'render.json'), 'utf8'));
      if (receipt?.jobId !== jobId || receipt.contentHash !== manifest.contentHash || !hash.test(receipt.videoSha256)
        || receipt.videoSha256 !== await hashVideo(join(destination, 'video.mp4'))) {
        throw new Error('Render checkpoint mismatch.');
      }
    } catch (error) {
      throw new Error('Existing render cannot be verified. Restore the original output, or move legacy output aside and rerender.', { cause: error });
    }
    if (!await rpc('record_video_render', {
      p_job_id: jobId, p_content_hash: manifest.contentHash, p_video_sha256: receipt.videoSha256,
    })) throw new Error('This job already has a different render checkpoint or is no longer queued.');
    return true;
  }
  if (await recordPublishedRender()) return destination;

  await mkdir(renderRoot, { recursive: true });
  const scratch = await mkdtemp(join(renderRoot, '.render-'));
  const assets = join(scratch, 'audio');
  const output = join(scratch, 'output');
  try {
    await mkdir(assets);
    await mkdir(output);
    let cursor = 0;
    const scenes = [];
    for (const scene of manifest.scenes) {
      if (scene?.startFrame !== cursor || !Number.isInteger(scene.durationFrames) || scene.durationFrames <= 0
        || typeof scene.title !== 'string' || !Array.isArray(scene.labels) || !Array.isArray(scene.objects)
        || !Array.isArray(scene.captions) || !scene.captions.length || !/^[0-9a-f]{64}\.json$/.test(scene.audio?.file)
        || !hash.test(scene.audio.sha256)) throw new Error('Invalid scene in assembly manifest.');
      const startSeconds = cursor / fps;
      cursor += scene.durationFrames;
      if (cursor > manifest.durationFrames || scene.captions.some(cue =>
        !Number.isFinite(cue?.start) || !Number.isFinite(cue.end) || cue.start < startSeconds - 0.0005
        || cue.end <= cue.start || cue.end > cursor / fps + 0.0005 || typeof cue.text !== 'string')) {
        throw new Error('Invalid scene timing in assembly manifest.');
      }
      const checkpoint = JSON.parse(await readFile(join(narrationRoot, jobId, scene.audio.file), 'utf8'));
      if (typeof checkpoint?.wavBase64 !== 'string' || checkpoint.wavBase64.length > 8_001_000) {
        throw new Error('Invalid narration checkpoint.');
      }
      const wav = Buffer.from(checkpoint.wavBase64, 'base64');
      if (createHash('sha256').update(wav).digest('hex') !== scene.audio.sha256) {
        throw new Error('Narration checksum differs from the assembled scene.');
      }
      const audioFile = `scene-${scenes.length + 1}.wav`;
      await writeFile(join(assets, audioFile), wav);
      const { title, type, labels, objects, startFrame, durationFrames, captions } = scene;
      scenes.push({ title, type, labels, objects, startFrame, durationFrames, captions, audioFile });
    }
    if (cursor !== manifest.durationFrames) throw new Error('Scene durations do not cover the assembled timeline.');
    const hue = createHash('sha256').update(manifest.theme.trim().toLowerCase()).digest().readUInt16BE() % 360;
    const inputProps = { scenes, hue, durationFrames: manifest.durationFrames };
    const serveUrl = await bundle({ entryPoint, publicDir: assets, outDir: join(scratch, 'bundle') });
    const chromeMode = browserExecutable ? 'chrome-for-testing' : 'headless-shell';
    const composition = await selectComposition({ serveUrl, id: 'StudioExplainer', inputProps, browserExecutable, chromeMode });
    await renderMedia({
      serveUrl, composition, inputProps, browserExecutable, chromeMode, codec: 'h264', audioCodec: 'aac',
      concurrency: 2, outputLocation: join(output, 'video.mp4'), onProgress,
    });
    await writeFile(join(output, 'captions.srt'), toSrt(scenes.flatMap(scene => scene.captions)));
    await writeFile(join(output, 'render.json'), JSON.stringify({
      jobId, contentHash: manifest.contentHash, videoSha256: await hashVideo(join(output, 'video.mp4')),
    }));
    try {
      await rename(output, destination);
    } catch (error) {
      // Another run may have published the output and receipt while this one was rendering.
      if (!['EEXIST', 'ENOTEMPTY', 'EPERM'].includes(error.code)) throw error;
      if (!await recordPublishedRender()) throw error;
      return destination;
    }
    await recordPublishedRender();
    return destination;
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}

async function main() {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CHROME_PATH } = process.env;
  if (!SUPABASE_URL || new URL(SUPABASE_URL).origin !== 'http://127.0.0.1:54321' || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Local Supabase worker configuration is incomplete.');
  }
  const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const rpc = async (name, args) => {
    const { data, error } = await client.rpc(name, args);
    if (error) throw new Error('Render checkpoint database request failed. Rerun the render worker to retry.');
    return data;
  };
  const outputs = fileURLToPath(new URL('../../../outputs/', import.meta.url));
  let lastPercent = -1;
  const destination = await renderVideoJob({
    rpc, narrationRoot: join(outputs, 'narration-worker'), renderRoot: join(outputs, 'render-worker'),
    jobId: process.argv[2], browserExecutable: CHROME_PATH || (process.platform === 'win32'
      ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' : undefined),
    onProgress: ({ progress }) => {
      const percent = Math.floor(progress * 10) * 10;
      if (percent !== lastPercent) console.log(`Rendering ${percent}%`);
      lastPercent = percent;
    },
  });
  console.log(`Rendered MP4 and SRT to ${destination}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
