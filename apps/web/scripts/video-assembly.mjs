import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { timedCaptions, toSrt } from '../../../lib.mjs';

const fps = 30;
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const contentHashPattern = /^[0-9a-f]{64}$/;

function readAudioTiming(audio, entry, narration) {
  if (typeof audio?.wavBase64 !== 'string' || audio.wavBase64.length > 8_001_000) throw new Error('Invalid WAV checkpoint.');
  const wav = Buffer.from(audio.wavBase64, 'base64');
  const pcmLength = wav.length - 44;
  if (pcmLength <= 0 || pcmLength % 2 || wav.toString('ascii', 0, 4) !== 'RIFF'
    || wav.toString('ascii', 8, 12) !== 'WAVE' || wav.readUInt16LE(20) !== 1
    || wav.readUInt16LE(22) !== 1 || wav.readUInt32LE(24) !== 16000
    || wav.readUInt16LE(34) !== 16 || wav.toString('ascii', 36, 40) !== 'data'
    || wav.readUInt32LE(40) !== pcmLength || wav.toString('base64') !== audio.wavBase64) {
    throw new Error('Invalid WAV checkpoint.');
  }
  const duration = pcmLength / 32000;
  if (audio.durationSeconds !== duration || entry.durationSeconds !== duration) throw new Error('Narration checkpoint duration differs from its WAV.');
  const captions = timedCaptions(audio.words, duration);
  if (duration - captions[0].start < 0.001) throw new Error('Narration is too short to create captions.');
  if (audio.words.map(word => word.text).join(' ').normalize() !== narration.trim().replace(/\s+/g, ' ').normalize()) {
    throw new Error('Narration checkpoint does not match the approved scene.');
  }
  return { captions, audioFrames: Math.ceil(pcmLength * fps / 32000), sha256: createHash('sha256').update(wav).digest('hex') };
}

function sceneCaptions(captions, startFrame) {
  const result = [];
  let pending = '';
  for (const caption of captions) {
    const offset = startFrame / fps;
    const start = Math.round((offset + caption.start) * 1000) / 1000;
    const end = Math.round((offset + caption.end) * 1000) / 1000;
    pending = pending ? pending + ' ' + caption.text : caption.text;
    if (end > start) {
      result.push({ start, end, text: pending });
      pending = '';
    }
  }
  if (pending) {
    if (!result.length) throw new Error('Narration is too short to create captions.');
    result.at(-1).text += ' ' + pending;
  }
  return result;
}

export async function assembleVideoJob({ rpc, outputRoot, jobId }) {
  if (!uuid.test(jobId)) throw new Error('Provide a video job UUID.');
  const inputs = await rpc('read_video_assembly_inputs', { p_job_id: jobId });
  if (!inputs) throw new Error('This job is not ready for scene assembly.');
  const { contentHash, storyboard, narration, settings } = inputs;
  const approvedScenes = storyboard?.scenes;
  async function failAssembly(code) {
    if (!await rpc('fail_video_assembly', { p_job_id: jobId, p_error_code: code })) {
      throw new Error('The job changed during scene assembly.');
    }
  }
  let audio;
  try {
    if (!contentHashPattern.test(contentHash) || narration?.contentHash !== contentHash || narration.version !== 1
      || ![30000, 60000, 90000].includes(storyboard?.targetDurationMs) || settings?.captions !== true
      || !Array.isArray(approvedScenes) || approvedScenes.length < 1 || approvedScenes.length > 10
      || !Array.isArray(narration.scenes) || narration.scenes.length !== approvedScenes.length) {
      throw new Error('Narration manifest does not match the approved storyboard.');
    }
    audio = await Promise.all(approvedScenes.map(async (scene, index) => {
      const entry = narration.scenes[index];
      if (entry?.scene !== index + 1 || !/^[0-9a-f]{64}\.json$/.test(entry.file)
        || typeof scene.narration !== 'string' || !Number.isInteger(scene.durationMs) || scene.durationMs <= 0) {
        throw new Error('Invalid narration scene reference.');
      }
      const checkpoint = JSON.parse(await readFile(join(outputRoot, jobId, entry.file), 'utf8'));
      return { file: entry.file, ...readAudioTiming(checkpoint, entry, scene.narration) };
    }));
  } catch (error) {
    await failAssembly('VIDEO_NARRATION_CHECKPOINT_INVALID');
    throw new Error('A narration checkpoint is missing or invalid. Submit a new video job to regenerate narration.', { cause: error });
  }

  const durationFrames = storyboard.targetDurationMs * fps / 1000;
  const minimumFrames = audio.reduce((sum, scene) => sum + scene.audioFrames, 0);
  const spareFrames = durationFrames - minimumFrames;
  if (spareFrames < 0) {
    await failAssembly('VIDEO_NARRATION_TOO_LONG');
    throw new Error('Narration exceeds the approved duration. Revise and approve a shorter script or a longer target.');
  }
  const weights = approvedScenes.map((scene, index) => Math.max(0, scene.durationMs * fps / 1000 - audio[index].audioFrames));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  let elapsed = 0;
  let distributed = 0;
  let cumulativeWeight = 0;
  const scenes = approvedScenes.map(({ startMs, durationMs, ...visual }, index) => {
    cumulativeWeight += weights[index];
    const next = index === audio.length - 1 ? spareFrames : totalWeight ? Math.floor(spareFrames * cumulativeWeight / totalWeight) : 0;
    const length = audio[index].audioFrames + next - distributed;
    const scene = {
      ...visual, startFrame: elapsed, durationFrames: length,
      audio: { file: audio[index].file, sha256: audio[index].sha256, durationFrames: audio[index].audioFrames },
      captions: sceneCaptions(audio[index].captions, elapsed),
    };
    elapsed += length;
    distributed = next;
    return scene;
  });
  const manifest = {
    version: 1, contentHash, fps, durationFrames, title: storyboard.title, theme: storyboard.theme,
    scenes, srt: toSrt(scenes.flatMap(scene => scene.captions)),
  };
  if (!await rpc('complete_video_assembly', { p_job_id: jobId, p_manifest: manifest })) {
    throw new Error('Scene assembly could not be saved for this job.');
  }
  return manifest;
}

async function main() {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || new URL(SUPABASE_URL).origin !== 'http://127.0.0.1:54321' || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Local Supabase worker configuration is incomplete.');
  }
  const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const rpc = async (name, args) => {
    const { data, error } = await client.rpc(name, args);
    if (error) throw new Error('Worker database request failed.');
    return data;
  };
  const outputRoot = fileURLToPath(new URL('../../../outputs/narration-worker/', import.meta.url));
  const result = await assembleVideoJob({ rpc, outputRoot, jobId: process.argv[2] });
  console.log(`Assembly ready: ${result.scenes.length} scenes, ${result.durationFrames / result.fps} seconds.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(error.code ? 'Could not read a local narration checkpoint.' : error.message);
    process.exitCode = 1;
  });
}
