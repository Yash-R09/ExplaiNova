'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { StoryboardCandidate } from '@/lib/storyboard-candidate';

type PlanningMode = 'brainstorm' | 'storyboard';
type PlanningRequest = {
  id: string;
  projectRevision: number;
  message: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  mode: PlanningMode;
  result: { reply: string } | { storyboardId: string; storyboard: StoryboardCandidate } | null;
  failureCode?: string;
  canResume?: boolean;
};
type Submission = { key: string; expectedRevision: number } &
  ({ mode: 'brainstorm'; message: string } | { mode: 'storyboard' });

const statusLabel = { queued: 'Queued', running: 'Generating reply…', succeeded: 'Reply saved', failed: 'Could not generate a reply' };
const providerMessages: Record<string, string> = {
  PROVIDER_UNAVAILABLE: 'The AI service is unavailable. Try again later.',
  PROVIDER_RATE_LIMITED: 'The AI service is at capacity. Try again later.',
  PROVIDER_BLOCKED: 'The AI service declined this prompt. Edit it and try again.',
  INVALID_PROVIDER_OUTPUT: 'The AI reply could not be read. Try again.',
};

export function PlanningPanel({ projectId, savedRevision }: { projectId: string; savedRevision: number | null }) {
  const endpoint = `/api/v1/projects/${projectId}/planning-jobs`;
  const [rows, setRows] = useState<PlanningRequest[] | null>(null);
  const [historyError, setHistoryError] = useState(false);
  const [message, setMessage] = useState('');
  const [uncertain, setUncertain] = useState<Submission | null>(null);
  const [feedback, setFeedback] = useState('');
  const [feedbackMode, setFeedbackMode] = useState<PlanningMode>('brainstorm');
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

  async function send(submission?: Submission, resume?: PlanningRequest) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setFeedback('');
    const mode = submission?.mode ?? resume?.mode ?? 'brainstorm';
    setFeedbackMode(mode);
    try {
      const response = await fetch(resume ? `${endpoint}/${resume.id}/resume` : endpoint, {
        method: 'POST',
        signal: AbortSignal.timeout(15_000),
        headers: {
          'Content-Type': 'application/json',
          ...(submission ? { 'Idempotency-Key': submission.key } : {}),
        },
        body: JSON.stringify(submission
          ? { mode: submission.mode, expectedRevision: submission.expectedRevision,
            ...(submission.mode === 'brainstorm' ? { message: submission.message } : {}) }
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
            ? `You’ve reached your planning limit. Try again in about ${minutes} minute${minutes === 1 ? '' : 's'}.`
            : 'You’ve reached your planning limit. Try again later.');
        } else {
          setFeedback(payload.error?.code === 'REVISION_CONFLICT'
            ? 'This draft was saved elsewhere. Reload the saved draft before trying again.'
            : payload.error?.message ?? 'The request could not be submitted.');
        }
        return;
      }
      if (submission?.mode === 'brainstorm') setMessage('');
      setFeedback(resume ? 'Resume requested.' : mode === 'storyboard' ? 'Storyboard request saved.' : 'Prompt saved.');
      setPollCycle(cycle => cycle + 1);
      await refresh();
    } catch {
      if (submission) setUncertain(submission);
      setFeedback(resume ? 'Could not confirm the resume request. Refresh history and try again.'
        : 'This request may already be saved. Retry the same submission or dismiss it and check history.');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const brainstorms = rows?.filter(row => row.mode === 'brainstorm');
  const storyboards = rows?.filter(row => row.mode === 'storyboard');
  const storyboardPending = storyboards?.some(row => row.projectRevision === savedRevision && (row.status === 'queued' || row.status === 'running'));
  const uncertainActions = uncertain && <>
    <button className="button primary" type="button" disabled={busy} onClick={() => void send(uncertain)}>Retry submission</button>
    <button className="button secondary" type="button" disabled={busy} onClick={() => {
      setUncertain(null);
      setFeedback('Submission dismissed. Check saved history before sending it again.');
      if (uncertain.mode === 'brainstorm') prompt.current?.focus();
    }}>{uncertain.mode === 'brainstorm' ? 'Dismiss and keep editing' : 'Dismiss submission'}</button>
  </>;

  return <><section className="draft-panel brainstorm-panel" aria-labelledby="storyboard-title">
    <p className="eyebrow">NEXT · STORYBOARD</p>
    <h2 id="storyboard-title">Create a storyboard</h2>
    <p className="muted">Turn your saved idea into scenes with narration, motion cues, and estimated timing.</p>
    <div className="draft-actions brainstorm-actions">
      {uncertain?.mode === 'storyboard' ? uncertainActions
        : <button className="button primary" type="button" disabled={busy || !!uncertain || savedRevision === null || storyboardPending}
          onClick={() => {
            if (savedRevision !== null) void send({ key: crypto.randomUUID(), mode: 'storyboard', expectedRevision: savedRevision });
          }}>Generate storyboard</button>}
      <button className="button secondary" type="button" onClick={() => void refresh()}>Refresh storyboard history</button>
    </div>
    {savedRevision === null && <p className="muted">Save the draft before generating a storyboard.</p>}
    {feedbackMode === 'storyboard' && <p role="status">{feedback}</p>}
    {historyError && <p role="status">Could not load storyboard history. Try refreshing.</p>}
    {storyboards?.map(row => <div className="recovery-copy" key={row.id}>
      <p className="muted">Draft revision {row.projectRevision} · <span role="status">{
        row.canResume ? 'Interrupted' : row.status === 'succeeded' ? 'Storyboard saved' : row.status === 'running' ? 'Generating storyboard…'
          : row.status === 'failed' ? 'Could not generate a storyboard' : 'Queued'
      }</span>{savedRevision !== null && row.projectRevision !== savedRevision && ' · Earlier draft'}</p>
      {row.status === 'failed' && <p>{providerMessages[row.failureCode ?? ''] ?? 'Try generating again.'}</p>}
      {(row.status === 'queued' || row.canResume) &&
        <button className="button secondary" type="button" disabled={busy} onClick={() => void send(undefined, row)}>Resume storyboard</button>}
      {row.result && 'storyboard' in row.result && <StoryboardPreview storyboard={row.result.storyboard} />}
    </div>)}
  </section>
  <section className="draft-panel brainstorm-panel" aria-labelledby="brainstorm-title">
    <p className="eyebrow">OPTIONAL · IDEA WORKSPACE</p>
    <h2 id="brainstorm-title">Brainstorm with AI</h2>
    <p className="muted">Ask for hooks, angles, or ways to explain your idea. Each request uses your saved draft and notes.</p>
    <form onSubmit={event => {
      event.preventDefault();
      if (savedRevision !== null && message.trim() && !uncertain) {
        void send({ key: crypto.randomUUID(), mode: 'brainstorm', expectedRevision: savedRevision, message: message.trim() });
      }
    }}>
      <label htmlFor="brainstorm-prompt">Your prompt</label>
      <textarea id="brainstorm-prompt" ref={prompt} value={message} maxLength={4000} required
        disabled={busy} readOnly={uncertain?.mode === 'brainstorm'} onChange={event => setMessage(event.target.value)}
        placeholder="Give me three opening hooks for this explainer…" />
      <div className="draft-actions brainstorm-actions">
        {uncertain?.mode === 'brainstorm' ? uncertainActions
          : <button className="button primary" type="submit" disabled={busy || !!uncertain || savedRevision === null || !message.trim()}>Ask AI</button>}
      </div>
      {savedRevision === null && !uncertain && <p className="muted">Save your draft changes before sending a new prompt.</p>}
      {feedbackMode === 'brainstorm' && <p role="status">{feedback}</p>}
    </form>
    <div className="brainstorm-history">
      <div className="brainstorm-history-heading"><h3>Saved brainstorming</h3>
        <button className="button secondary" type="button" onClick={() => void refresh()}>Refresh history</button>
      </div>
      {historyError && <p role="status">Could not load saved brainstorming. Try refreshing history.</p>}
      {rows === null && !historyError && <p role="status">Loading saved brainstorming…</p>}
      {brainstorms?.length === 0 && <p className="muted">Your prompts and replies will appear here.</p>}
      {brainstorms?.length ? <ul>{brainstorms.map(row => <li className="recovery-copy" key={row.id}>
        <p className="muted">Draft revision {row.projectRevision} · <span role="status">{row.canResume ? 'Interrupted' : statusLabel[row.status]}</span></p>
        <p className="brainstorm-text"><strong>You</strong>{'\n'}{row.message}</p>
        {row.result && 'reply' in row.result && <p className="brainstorm-text"><strong>AI reply</strong>{'\n'}{row.result.reply}</p>}
        {row.status === 'failed' && <>
          <p>{providerMessages[row.failureCode ?? ''] ?? 'Brainstorming failed. Try again.'}</p>
          <button className="button secondary" type="button" disabled={busy || !!uncertain || !!message} onClick={() => {
            setMessage(row.message);
            setFeedback('');
            setFeedbackMode('brainstorm');
            prompt.current?.focus();
          }}>Reuse prompt</button>
        </>}
        {(row.status === 'queued' || row.canResume) &&
          <button className="button secondary" type="button" disabled={busy} onClick={() => void send(undefined, row)}>Resume request</button>}
      </li>)}</ul> : null}
    </div>
  </section></>;
}

function StoryboardPreview({ storyboard }: { storyboard: StoryboardCandidate }) {
  return <details className="storyboard-preview">
    <summary>{storyboard.title} · {storyboard.scenes.length} scenes · {storyboard.targetDurationMs / 1000}s</summary>
    <p>{storyboard.theme}</p>
    {storyboard.reviewNotes.length > 0 && <><strong>Review notes</strong><ul>{storyboard.reviewNotes.map((note, index) => <li key={index}>{note}</li>)}</ul></>}
    <ol>{storyboard.scenes.map(scene => <li key={scene.startMs}>
      <h3>{scene.title}</h3>
      <p className="muted">{(scene.durationMs / 1000).toFixed(1)}s estimated · {scene.type} · {scene.purpose}</p>
      <p className="brainstorm-text"><strong>Narration</strong>{'\n'}{scene.narration}</p>
      <p className="brainstorm-text"><strong>Motion</strong>{'\n'}{scene.motion}</p>
      {scene.objects.length > 0 && <p>Objects: {scene.objects.join(', ')}</p>}
      {scene.labels.length > 0 && <p>Labels: {scene.labels.join(', ')}</p>}
    </li>)}</ol>
  </details>;
}
