const sceneTypes = ['illustration', 'process', 'comparison', 'sequence', 'chart', 'keyword'] as const;
const textSchema = { type: 'STRING' };
const listSchema = { type: 'ARRAY', items: textSchema, maxItems: 6 };
const sceneProperties = {
  title: textSchema, type: { type: 'STRING', enum: sceneTypes }, purpose: textSchema,
  narration: textSchema, objects: listSchema, labels: listSchema, motion: textSchema,
};

export const storyboardSchema = {
  type: 'OBJECT',
  properties: {
    title: textSchema, theme: textSchema, reviewNotes: listSchema,
    scenes: {
      type: 'ARRAY', minItems: 4, maxItems: 10,
      items: { type: 'OBJECT', properties: sceneProperties, required: Object.keys(sceneProperties) },
    },
  },
  required: ['title', 'theme', 'reviewNotes', 'scenes'],
};

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(value: unknown, max: number) {
  if (typeof value !== 'string' || value.length > max || value.includes('\0') || !value.isWellFormed()) return null;
  return value.trim() || null;
}

function list(value: unknown, max: number) {
  if (!Array.isArray(value) || value.length > 6) return null;
  const entries = value.map(entry => text(entry, max));
  return entries.every(entry => entry !== null) ? entries : null;
}

export function validateStoryboardCandidate(value: unknown, targetDurationMs: number) {
  if (![30000, 60000, 90000].includes(targetDurationMs)) return null;
  const source = object(value);
  const title = text(source.title, 140);
  const theme = text(source.theme, 250);
  const reviewNotes = list(source.reviewNotes, 250);
  if (!title || !theme || !reviewNotes || !Array.isArray(source.scenes) || source.scenes.length < 4 || source.scenes.length > 10) return null;

  const scenes = [];
  for (const entry of source.scenes) {
    const scene = object(entry);
    const type = sceneTypes.find(type => type === scene.type);
    const sceneTitle = text(scene.title, 100);
    const purpose = text(scene.purpose, 220);
    const narration = text(scene.narration, 600);
    const objects = list(scene.objects, 80);
    const labels = list(scene.labels, 80);
    const motion = text(scene.motion, 280);
    if (!type || !sceneTitle || !purpose || !narration || !objects || !labels || !motion) return null;
    scenes.push({ title: sceneTitle, type, purpose, narration, objects, labels, motion });
  }

  // Allow at most three words per second and at least two seconds for every scene.
  const words = scenes.map(scene => scene.narration.split(/\s+/u).length);
  const totalWords = words.reduce((sum, count) => sum + count, 0);
  const minimums = words.map(count => Math.max(2000, Math.ceil(count * 1000 / 3)));
  const remaining = targetDurationMs - minimums.reduce((sum, duration) => sum + duration, 0);
  if (remaining < 0) return null;
  let elapsed = 0;
  let distributed = 0;
  let narratedWords = 0;
  return {
    title, theme, targetDurationMs, reviewNotes,
    scenes: scenes.map((scene, index) => {
      narratedWords += words[index];
      const nextDistributed = Math.floor(remaining * narratedWords / totalWords);
      const durationMs = minimums[index] + nextDistributed - distributed;
      const timed = { ...scene, startMs: elapsed, durationMs };
      elapsed += durationMs;
      distributed = nextDistributed;
      return timed;
    }),
  };
}

export type StoryboardCandidate = NonNullable<ReturnType<typeof validateStoryboardCandidate>>;
