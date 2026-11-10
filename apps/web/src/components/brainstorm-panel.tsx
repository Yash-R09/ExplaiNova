'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type PlanningRequest = {
  id: string;
  projectRevision: number;
  message: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  result: { reply: string } | null;
  failureCode?: string;
  canResume?: boolean;
};
type Submission = { key: string; expectedRevision: number; message: string };

const statusLabel = { queued: 'Queued', running: 'Generating reply…', succeeded: 'Reply saved', failed: 'Could not generate a reply' };
const providerMessages: Record<string, string> = {
  PROVIDER_UNAVAILABLE: 'The AI service is unavailable. Try again later.',
  PROVIDER_RATE_LIMITED: 'The AI service is at capacity. Try again later.',
  PROVIDER_BLOCKED: 'The AI service declined this prompt. Edit it and try again.',
  INVALID_PROVIDER_OUTPUT: 'The AI reply could not be read. Try again.',
};

export function BrainstormPanel({ projectId, savedRevision }: { projectId: string; savedRevision: number | null }) {
  const endpoint = `/api/v1/projects/${projectId}/planning-jobs`;
  const [rows, setRows] = useState<PlanningRequest[] | null>(null);
  const [historyError, setHistoryError] = useState(false);
  const [message, setMessage] = useState('');
  const [uncertain, setUncertain] = useState<Submission | null>(null);
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const [pollCycle, setPollCycle] = useState(0);
  const inFlight = useRef(false);
  const historyRead = useRef<AbortController | null>(null);
  const prompt = useRef<HTMLTextAreaElement>(null);

  const refresh = useCallback(async (skipIfReading = false) => {
    if (skipIfReading && historyRead.current) return;
    historyRead.current?.abort();
    const read = new AbortController();
    historyRead.current = read;
    try {
      const response = await fetch(endpoint, { signal: AbortSignal.any([read.signal, AbortSignal.timeout(10_000)]), cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok || !Array.isArray(payload.data)) throw new Error();
      if (read.signal.aborted) return;
      setRows(payload.data);
      setHistoryError(false);
    } catch {
      if (!read.signal.aborted) setHistoryError(true);
    } finally {
      if (historyRead.current === read) historyRead.current = null;
    }
  }, [endpoint]);

  useEffect(() => {
    void refresh();
    return () => historyRead.current?.abort();
  }, [refresh]);

  const active = !!rows?.some(row => row.status === 'queued' || (row.status === 'running' && !row.canResume));
  useEffect(() => {
    if (!active) return;
    let polls = 0;
    const timer = window.setInterval(() => {
      void refresh(true);
      if (++polls === 50) window.clearInterval(timer);
    }, 2500);
    return () => window.clearInterval(timer);
  }, [active, pollCycle, refresh]);

  async function send(submission?: Submission, resumeId?: string) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setFeedback('');
    try {
      const response = await fetch(resumeId ? `${endpoint}/${resumeId}/resume` : endpoint, {
        method: 'POST',
        signal: AbortSignal.timeout(15_000),
        headers: {
          'Content-Type': 'application/json',
          ...(submission ? { 'Idempotency-Key': submission.key } : {}),
        },
        body: JSON.stringify(submission
          ? { mode: 'brainstorm', message: submission.message, expectedRevision: submission.expectedRevision }
          : {}),
      });
      const payload = await response.json();
      if (response.status >= 500 || (response.ok && typeof payload.data?.id !== 'string')) throw new Error();
      if (submission) setUncertain(null);
      if (!response.ok) {
        if (payload.error?.code === 'BRAINSTORM_RATE_LIMITED') {
          const seconds = Number(response.headers.get('Retry-After'));
          const minutes = Math.ceil(seconds / 60);
          setFeedback(seconds > 0
            ? `You’ve reached your brainstorming limit. Try again in about ${minutes} minute${minutes === 1 ? '' : 's'}.`
            : 'You’ve reached your brainstorming limit. Try again later.');
        } else {
          setFeedback(payload.error?.code === 'REVISION_CONFLICT'
            ? 'This draft was saved elsewhere. Reload the saved draft before sending your prompt.'
            : payload.error?.message ?? 'The request could not be submitted.');
        }
        return;
      }
      if (submission) setMessage('');
      setFeedback(resumeId ? 'Resume requested.' : 'Prompt saved.');
      setPollCycle(cycle => cycle + 1);
      await refresh();
    } catch {
      if (submission) setUncertain(submission);
      setFeedback(resumeId ? 'Could not confirm the resume request. Refresh history and try again.'
        : 'This prompt may already be saved. Retry the same submission or dismiss it to keep editing.');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return <section className="draft-panel brainstorm-panel" aria-labelledby="brainstorm-title">
    <p className="eyebrow">OPTIONAL · IDEA WORKSPACE</p>
    <h2 id="brainstorm-title">Brainstorm with AI</h2>
    <p className="muted">Ask for hooks, angles, or ways to explain your idea. Each request uses your saved draft and notes.</p>
    <form onSubmit={event => {
      event.preventDefault();
      if (savedRevision !== null && message.trim() && !uncertain) {
        void send({ key: crypto.randomUUID(), expectedRevision: savedRevision, message: message.trim() });
      }
    }}>
      <label htmlFor="brainstorm-prompt">Your prompt</label>
      <textarea id="brainstorm-prompt" ref={prompt} value={message} maxLength={4000} required
        disabled={busy} readOnly={!!uncertain} onChange={event => setMessage(event.target.value)}
        placeholder="Give me three opening hooks for this explainer…" />
      <div className="draft-actions brainstorm-actions">
        {uncertain
          ? <>
            <button className="button primary" type="button" disabled={busy} onClick={() => void send(uncertain)}>Retry submission</button>
            <button className="button secondary" type="button" disabled={busy} onClick={() => {
              setUncertain(null);
              setFeedback('Prompt unlocked. Check saved history before sending it again.');
              prompt.current?.focus();
            }}>Dismiss and keep editing</button>
          </>
          : <button className="button primary" type="submit" disabled={busy || savedRevision === null || !message.trim()}>Ask AI</button>}
      </div>
      {savedRevision === null && !uncertain && <p className="muted">Save your draft changes before sending a new prompt.</p>}
      <p role="status">{feedback}</p>
    </form>
    <div className="brainstorm-history">
      <div className="brainstorm-history-heading"><h3>Saved brainstorming</h3>
        <button className="button secondary" type="button" onClick={() => void refresh()}>Refresh history</button>
      </div>
      {historyError && <p role="status">Could not load saved brainstorming. Try refreshing history.</p>}
      {rows === null && !historyError && <p role="status">Loading saved brainstorming…</p>}
      {rows?.length === 0 && <p className="muted">Your prompts and replies will appear here.</p>}
      {rows?.length ? <ul>{rows.map(row => <li className="recovery-copy" key={row.id}>
        <p className="muted">Draft revision {row.projectRevision} · <span role="status">{row.canResume ? 'Interrupted' : statusLabel[row.status]}</span></p>
        <p className="brainstorm-text"><strong>You</strong>{'\n'}{row.message}</p>
        {row.result && <p className="brainstorm-text"><strong>AI reply</strong>{'\n'}{row.result.reply}</p>}
        {row.status === 'failed' && <>
          <p>{providerMessages[row.failureCode ?? ''] ?? 'Brainstorming failed. Try again.'}</p>
          <button className="button secondary" type="button" disabled={busy || !!uncertain || !!message} onClick={() => {
            setMessage(row.message);
            setFeedback('');
            prompt.current?.focus();
          }}>Reuse prompt</button>
        </>}
        {(row.status === 'queued' || row.canResume) &&
          <button className="button secondary" type="button" disabled={busy} onClick={() => void send(undefined, row.id)}>Resume request</button>}
      </li>)}</ul> : null}
    </div>
  </section>;
}
