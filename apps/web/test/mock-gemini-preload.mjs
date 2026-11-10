const send = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  if (url.hostname !== 'generativelanguage.googleapis.com') return send(input, init);

  const request = JSON.parse(init.body);
  const context = JSON.parse(request.contents[0].parts[0].text);
  if (context.message === 'Simulate quota') return Promise.resolve(new Response(null, { status: 429 }));
  if (context.title !== 'Orbit') return Promise.resolve(new Response(null, { status: 400 }));
  return Promise.resolve(Response.json({
    candidates: [{
      finishReason: 'STOP',
      content: { parts: [{ text: JSON.stringify({ reply: 'Open with a falling satellite.' }) }] },
    }],
  }));
};
