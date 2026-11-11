import { createHash, randomUUID } from 'node:crypto';
import { link, mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { alignmentWords, pcmWav, synthesizeEleven } from '../../../elevenlabs.mjs';

const modelId = 'eleven_flash_v2_5';
const sha256 = value => createHash('sha256').update(value).digest('hex');
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export function narrationAudio(data, text) {
  const { audio_base64: audio, alignment } = data ?? {};
  if (typeof audio !== 'string' || audio.length > 8_000_000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(audio)) {
    throw new Error('Invalid narration audio.');
  }
  const pcm = Buffer.from(audio, 'base64');
  if (!pcm.length || pcm.length % 2 || pcm.toString('base64') !== audio) throw new Error('Invalid PCM audio.');
  const durationSeconds = pcm.length / 32000;
  const { characters, character_start_times_seconds: starts, character_end_times_seconds: ends } = alignment ?? {};
  if (!Array.isArray(characters) || !Array.isArray(starts) || !Array.isArray(ends)
    || starts.length !== characters.length || ends.length !== characters.length
    || characters.some(character => typeof character !== 'string' || !character)
    || characters.join('').normalize() !== text.normalize()
    || starts.some((start, index) => !Number.isFinite(start) || !Number.isFinite(ends[index])
      || start < (starts[index - 1] ?? 0) || ends[index] < start || ends[index] > durationSeconds + 0.05)) {
    throw new Error('Invalid narration timing.');
  }
  const words = alignmentWords(alignment);
  if (!words.length) throw new Error('Narration timing contains no words.');
  return { durationSeconds, words, wavBase64: pcmWav(pcm).toString('base64') };
}

async function sceneCheckpoint(directory, key, generate) {
  const file = join(directory, key + '.json');
  try { return JSON.parse(await readFile(file, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const temporary = join(directory, randomUUID() + '.tmp');
  const scene = await generate();
  try {
    await writeFile(temporary, JSON.stringify(scene), { flag: 'wx', mode: 0o600 });
    await link(temporary, file);
    return scene;
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    return JSON.parse(await readFile(file, 'utf8'));
  } finally {
    await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; });
  }
}

export async function runNarrationJob({ rpc, outputRoot, voices, apiKey, send = fetch }) {
  const result = await rpc('claim_video_job');
  if (!result) return 'idle';
  const { jobId, leaseToken, contentHash, settings, storyboard } = result;
  const lease = { p_job_id: jobId, p_lease_token: leaseToken };
  const ensureLease = async () => {
    const expiry = await rpc('renew_video_job_lease', lease).catch(() => null);
    if (!expiry) throw Object.assign(new Error('Worker lease could not be confirmed.'), { leaseLost: true });
  };
  let manifest;
  try {
    if (!uuid.test(jobId) || !uuid.test(leaseToken) || !/^[0-9a-f]{64}$/.test(contentHash)
      || !Array.isArray(storyboard?.scenes) || !storyboard.scenes.length || storyboard.scenes.length > 10
      || storyboard.scenes.some(scene => typeof scene?.narration !== 'string' || !scene.narration.trim() || scene.narration.length > 600)
      || !Object.hasOwn(voices, settings?.voice)) throw new Error('Invalid approved narration inputs.');
    const voice = voices[settings.voice];
    const directory = join(outputRoot, jobId);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const scenes = [];
    for (const [index, scene] of storyboard.scenes.entries()) {
      const text = scene.narration;
      const key = sha256(JSON.stringify([contentHash, index, voice.voiceId, modelId, text]));
      const audio = await sceneCheckpoint(directory, key, async () => {
        await ensureLease();
        const data = await synthesizeEleven(text, { ...voice, modelId }, { apiKey, send });
        await ensureLease();
        return narrationAudio(data, text);
      });
      scenes.push({ file: key + '.json', durationSeconds: audio.durationSeconds, scene: index + 1 });
    }
    manifest = { version: 1, contentHash, voiceId: voice.voiceId, modelId, scenes };
  } catch (error) {
    if (error.leaseLost) return 'lease_lost';
    // Only retry known transient provider responses. An ambiguous request may already have consumed quota.
    const retryable = error.status === 429 || error.status === 503;
    return await rpc('report_video_job_failure', { ...lease, p_retryable: retryable }) ? 'failure_recorded' : 'lease_lost';
  }
  return await rpc('complete_video_narration', { ...lease, p_manifest: manifest }) ? 'narration_ready' : 'lease_lost';
}

async function main() {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ELEVENLABS_API_KEY, ELEVENLABS_MALE_VOICE_ID, ELEVENLABS_FEMALE_VOICE_ID } = process.env;
  const url = new URL(SUPABASE_URL);
  if (url.origin !== 'http://127.0.0.1:54321' || !SUPABASE_SERVICE_ROLE_KEY || !ELEVENLABS_API_KEY
    || !ELEVENLABS_MALE_VOICE_ID || !ELEVENLABS_FEMALE_VOICE_ID) {
    throw new Error('Local worker configuration is incomplete.');
  }
  const response = await fetch('https://api.elevenlabs.io/v2/voices?page_size=100&include_total_count=false', {
    headers: { 'xi-api-key': ELEVENLABS_API_KEY }, signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error('ElevenLabs voice catalog unavailable.');
  const catalog = (await response.json()).voices;
  const voices = {};
  for (const [gender, voiceId] of [['male', ELEVENLABS_MALE_VOICE_ID], ['female', ELEVENLABS_FEMALE_VOICE_ID]]) {
    if (!catalog?.some(voice => voice.voice_id === voiceId && voice.category === 'premade' && voice.labels?.gender === gender)) {
      throw new Error('Configured voice is unavailable in the account catalog.');
    }
    voices[gender] = { voiceId, category: 'premade' };
  }
  const client = createClient(url.origin, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const rpc = async (name, args) => {
    const { data, error } = await client.rpc(name, args);
    if (error) throw new Error('Worker database request failed.');
    return data;
  };
  const outputRoot = fileURLToPath(new URL('../../../outputs/narration-worker/', import.meta.url));
  console.log(await runNarrationJob({ rpc, outputRoot, voices, apiKey: ELEVENLABS_API_KEY }));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => {
    console.error('Narration worker could not run. Check local Supabase, worker configuration, and ElevenLabs voice access.');
    process.exitCode = 1;
  });
}
