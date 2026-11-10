const send = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  if (url.hostname !== 'generativelanguage.googleapis.com') return send(input, init);

  const request = JSON.parse(init.body);
  const context = JSON.parse(request.contents[0].parts[0].text);
  if (context.message === 'Simulate quota') return Promise.resolve(new Response(null, { status: 429 }));
  if (context.title !== 'Orbit') return Promise.resolve(new Response(null, { status: 400 }));
  const storyboard = request.generationConfig.responseSchema.properties.scenes;
  const value = storyboard ? {
    title: 'How orbits work', theme: 'Deep blue diagrams', reviewNotes: ['Verify altitude examples before publishing.'],
    scenes: Array.from({ length: 4 }, (_, index) => ({
      title: `Orbit scene ${index + 1}`, type: 'illustration', purpose: 'Explain motion',
      narration: 'A satellite keeps falling around Earth.', objects: ['Earth', 'Satellite'],
      labels: ['Gravity'], motion: 'Trace the orbit path.',
    })),
  } : { reply: 'Open with a falling satellite.' };
  if (storyboard && context.message === 'Simulate invalid storyboard') value.scenes = [];
  if (storyboard && context.baseStoryboard) {
    value.title = context.baseStoryboard.title;
    value.scenes = context.baseStoryboard.scenes.map((scene, index) => index === 0
      ? { ...scene, narration: 'Imagine throwing a ball fast enough to circle Earth.' } : scene);
  }
  return Promise.resolve(Response.json({
    candidates: [{
      finishReason: 'STOP',
      content: { parts: [{ text: JSON.stringify(value) }] },
    }],
  }));
};
