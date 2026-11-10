import assert from 'node:assert/strict';
import test from 'node:test';
import { brainstormWithGemini } from '../src/lib/gemini-brainstorm.ts';

const model = 'gemini-test';
const result = (reply: string) => Response.json({
  candidates: [{ finishReason: 'STOP', content: { parts: [{ thought: true, text: 'private' }, { text: JSON.stringify({ reply }) }] } }],
});

test('sends saved context in structured Gemini requests and returns only the validated reply', async () => {
  const context = { message: 'Find an opening hook', title: 'Orbit' };
  const outcome = await brainstormWithGemini('test-key', model, context, async (url, init) => {
    assert.equal(String(url), 'https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent');
    assert.equal(new Headers(init?.headers).get('x-goog-api-key'), 'test-key');
    const body = JSON.parse(String(init?.body));
    assert.deepEqual(JSON.parse(body.contents[0].parts[0].text), context);
    assert.equal(body.generationConfig.responseMimeType, 'application/json');
    return result('  Start with a falling satellite.  ');
  });
  assert.deepEqual(outcome, { reply: 'Start with a falling satellite.', failureCode: null });
});

test('returns sanitized failure codes for quotas, safety blocks, and invalid output', async () => {
  const cases = [
    [new Response('provider details', { status: 429 }), 'PROVIDER_RATE_LIMITED'],
    [new Response('provider details', { status: 503 }), 'PROVIDER_UNAVAILABLE'],
    [Response.json({ promptFeedback: { blockReason: 'SAFETY' } }), 'PROVIDER_BLOCKED'],
    [Response.json({ candidates: [{ finishReason: 'MAX_TOKENS' }] }), 'INVALID_PROVIDER_OUTPUT'],
    [result(' \t\n '), 'INVALID_PROVIDER_OUTPUT'],
    [result('a'.repeat(4001)), 'INVALID_PROVIDER_OUTPUT'],
  ] as const;
  for (const [response, failureCode] of cases) {
    assert.deepEqual(await brainstormWithGemini('test-key', model, {}, async () => response), { reply: null, failureCode });
  }
});
