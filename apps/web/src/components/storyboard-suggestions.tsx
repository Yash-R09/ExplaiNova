'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { StoryboardCandidate } from '@/lib/storyboard-candidate';
import { sameStoryboardContent } from '@/lib/storyboard-autosave';

type Suggestion = {
  id: string; message: string; baseRevision: number;
  status: 'queued' | 'running' | 'succeeded' | 'failed'; canResume: boolean; content: StoryboardCandidate | null;
};
type Submission = { key: string; expectedRevision: number; message: string };
const labels = { queued: 'Queued', running: 'Preparing suggestion…', succeeded: 'Proposal ready', failed: 'Could not generate proposal' };

export function StoryboardSuggestions({ id, projectId, revision, savedContent, ready, preview, apply }: {
  id: string; projectId: string; revision: number; savedContent: StoryboardCandidate; ready: boolean;
  preview: (content: StoryboardCandidate) => ReactNode; apply: (base: number, content: StoryboardCandidate) => void;
}) {
  const endpoint = `/api/v1/storyboards/${id}/suggestions`;
  const [rows, setRows] = useState<Suggestion[] | null>(null);
  const [message, setMessage] = useState('');
  const [notice, setNotice] = useState('');
  const [readError, setReadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState<Submission | null>(null);
  const [pollCycle, setPollCycle] = useState(0);
  const reading = useRef<AbortController | null>(null);
  const submitting = useRef(false);

  const refresh = useCallback(async (skipIfReading = false) => {
    if (skipIfReading && reading.current) return;
    reading.current?.abort();
    const controller = new AbortController();
    reading.current = controller;
    try {
      const response = await fetch(endpoint, { cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]) });
      const payload = await response.json();
      if (!response.ok || !Array.isArray(payload.data)) throw new Error();
      if (!controller.signal.aborted) { setRows(payload.data); setReadError(false); }
    } catch {
      if (!controller.signal.aborted) setReadError(true);
    } finally { if (reading.current === controller) reading.current = null; }
  }, [endpoint]);

  useEffect(() => { void refresh(); return () => reading.current?.abort(); }, [refresh]);
  const pending = rows?.some(row => row.status === 'queued' || (row.status === 'running' && !row.canResume));
  useEffect(() => {
    if (!pending) return;
    let polls = 0;
    const timer = window.setInterval(() => {
      void refresh(true);
      if (++polls === 50) window.clearInterval(timer);
    }, 2500);
    return () => window.clearInterval(timer);
  }, [pending, pollCycle, refresh]);

  async function send(submission?: Submission, resumeId?: string) {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setNotice('');
    try {
      const response = await fetch(resumeId ? `/api/v1/projects/${projectId}/planning-jobs/${resumeId}/resume` : endpoint, {
        method: 'POST', signal: AbortSignal.timeout(15000),
        headers: { 'Content-Type': 'application/json', ...(submission ? { 'Idempotency-Key': submission.key } : {}) },
        body: JSON.stringify(submission ? { expectedRevision: submission.expectedRevision, message: submission.message } : {}),
      });
      const payload = await response.json();
      if (response.status >= 500 || (response.ok && typeof payload.data?.id !== 'string')) throw new Error();
      if (submission) setUncertain(null);
      if (!response.ok) {
        setNotice(payload.error?.code === 'REVISION_CONFLICT' ? 'A newer revision exists. Reload the saved storyboard and try again.'
          : payload.error?.code === 'BRAINSTORM_RATE_LIMITED' ? 'You’ve reached your hourly planning limit. Try again later.'
          : payload.error?.message ?? 'Could not request a proposal.');
        return;
      }
      if (submission) setMessage('');
      setNotice(resumeId ? 'Resume requested.' : 'Revision request saved.');
      setPollCycle(cycle => cycle + 1);
      await refresh();
    } catch {
      if (submission) setUncertain(submission);
      setNotice(submission ? 'This request may already be saved. Retry the same request or dismiss it and check history.'
        : 'Could not confirm the resume request. Refresh history and try again.');
    } finally { submitting.current = false; setBusy(false); }
  }

  return <section className="draft-panel brainstorm-panel" aria-labelledby="storyboard-suggestions">
    <h2 id="storyboard-suggestions">Ask AI for changes</h2>
    <p className="muted">Describe a change to the saved storyboard. Review the proposal before applying it.</p>
    <form onSubmit={event => {
      event.preventDefault();
      if (ready && !uncertain && message.trim()) void send({ key: crypto.randomUUID(), expectedRevision: revision, message: message.trim() });
    }}>
      <label htmlFor="storyboard-change-prompt">What should change?</label>
      <textarea id="storyboard-change-prompt" value={message} maxLength={4000} disabled={busy} readOnly={!!uncertain}
        onChange={event => setMessage(event.target.value)} placeholder="Make the opening scene easier for beginners to follow…" />
      <div className="draft-actions brainstorm-actions">
        {uncertain ? <>
          <button type="button" className="button primary" disabled={busy} onClick={() => void send(uncertain)}>Retry request</button>
          <button type="button" className="button secondary" disabled={busy} onClick={() => {
            setUncertain(null); setNotice('Request dismissed. Check history before sending again.');
          }}>Dismiss and keep editing</button>
        </> : <button type="submit" className="button primary" disabled={busy || !ready || !message.trim()}>Request AI revision</button>}
        <button type="button" className="button secondary" onClick={() => void refresh()}>Refresh proposals</button>
      </div>
      {!ready && <p className="muted">Finish saving your storyboard before requesting or applying a proposal.</p>}
      {notice && <p role="status">{notice}</p>}
    </form>
    {readError && <p role="status">Could not load proposals. Try refreshing.</p>}
    {rows === null && !readError && <p role="status">Loading proposals…</p>}
    {rows?.map(row => {
      const matches = row.content !== null && row.baseRevision === revision && sameStoryboardContent(row.content, savedContent);
      return <div className="recovery-copy" key={row.id}>
        <p className="muted">Based on revision {row.baseRevision} · <span role="status">{labels[row.status]}</span></p>
        <p className="brainstorm-text">{row.message}</p>
        {row.canResume && <button type="button" className="button secondary" disabled={busy} onClick={() => void send(undefined, row.id)}>Resume proposal</button>}
        {row.content && <>{preview(row.content)}
          {row.baseRevision === revision
            ? <>
              {matches && <p className="muted">This proposal matches the saved revision.</p>}
              <button type="button" className="button secondary" disabled={!ready || busy || matches}
                onClick={() => { if (row.content) apply(row.baseRevision, row.content); }}>Apply proposal</button>
            </>
            : <p className="muted">This proposal is for an earlier revision. Request a new proposal to revise the current storyboard.</p>}
        </>}
      </div>;
    })}
  </section>;
}
