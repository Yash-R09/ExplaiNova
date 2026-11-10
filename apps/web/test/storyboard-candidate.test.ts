import assert from 'node:assert/strict';
import test from 'node:test';
import { validateStoryboardCandidate } from '../src/lib/storyboard-candidate.ts';

const scene = {
  title: 'See the orbit', type: 'illustration', purpose: 'Introduce gravity', narration: 'Gravity bends the satellite path.',
  objects: ['Earth'], labels: ['Gravity'], motion: 'Trace the orbit.',
};
const source = { title: 'Orbits', theme: 'Indigo diagrams', reviewNotes: [], scenes: Array.from({ length: 4 }, () => ({ ...scene })) };

test('validates scene fields and gives every supported duration contiguous estimated timings', () => {
  for (const duration of [30000, 60000, 90000]) {
    const result = validateStoryboardCandidate(source, duration);
    assert.ok(result);
    let elapsed = 0;
    for (const timed of result.scenes) {
      assert.equal(timed.startMs, elapsed);
      assert.ok(timed.durationMs > 0);
      elapsed += timed.durationMs;
    }
    assert.equal(elapsed, duration);
  }
});

test('rejects malformed storyboards and narration too long for the target', () => {
  assert.equal(validateStoryboardCandidate({ ...source, scenes: [] }, 60000), null);
  assert.equal(validateStoryboardCandidate({ ...source, scenes: [...source.scenes.slice(1), { ...scene, type: 'unrecognized' }] }, 60000), null);
  assert.equal(validateStoryboardCandidate({ ...source, scenes: source.scenes.map(entry => ({ ...entry, narration: 'word '.repeat(30) })) }, 30000), null);
});

test('rejects an uneven storyboard when per-scene minimums exceed the target', () => {
  const scenes = Array.from({ length: 10 }, (_, index) => ({
    ...scene, narration: index === 0 ? 'word '.repeat(81).trim() : 'word',
  }));
  assert.equal(validateStoryboardCandidate({ ...source, scenes }, 30000), null);
});

test('allocates enough time for each scene in a feasible uneven storyboard', () => {
  const scenes = Array.from({ length: 10 }, (_, index) => ({
    ...scene, narration: index === 0 ? 'word '.repeat(30).trim() : 'word',
  }));
  const result = validateStoryboardCandidate({ ...source, scenes }, 30000);
  assert.ok(result);
  assert.ok(result.scenes[0].durationMs >= 10000);
  assert.ok(result.scenes.every(scene => scene.durationMs >= 2000));
  assert.equal(result.scenes.reduce((sum, scene) => sum + scene.durationMs, 0), 30000);
});
