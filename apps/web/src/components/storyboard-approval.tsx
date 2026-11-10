'use client';

import { useRef, useState } from 'react';
import type { StoryboardApproval, StoryboardDocument } from '@/lib/storyboard-contract';

export function StoryboardApprovalPanel({ document, ready, dirty }: { document: StoryboardDocument; ready: boolean; dirty: boolean }) {
  const [confirmed, setConfirmed] = useState<StoryboardApproval>();
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [stale, setStale] = useState(false);
  const pendingKey = useRef<string | null>(null);
  const sending = useRef(false);
  const approval = confirmed ?? document.approval;
  const settings = document.sourceSettings;

  async function approve() {
    if (!settings || !ready || sending.current || approval || stale) return;
    sending.current = true;
    setBusy(true);
    setNotice('');
    const key = pendingKey.current ?? crypto.randomUUID();
    pendingKey.current = key;
    try {
      const response = await fetch(`/api/v1/storyboards/${document.id}/approve`, {
        method: 'POST', signal: AbortSignal.timeout(15000),
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
        body: JSON.stringify({ expectedRevision: document.revision, revisionId: document.revisionId }),
      });
      const payload = await response.json();
      if (response.status >= 500) throw new Error();
      if (!response.ok) {
        pendingKey.current = null;
        const changed = payload.error?.code === 'REVISION_CONFLICT';
        setStale(changed);
        setNotice(changed ? 'A newer revision was saved. Reopen the storyboard to review it before approving.'
          : payload.error?.message ?? 'Could not approve this revision.');
        return;
      }
      const result = payload.data as StoryboardApproval | undefined;
      if (!result?.id || result.revisionId !== document.revisionId || result.revision !== document.revision) throw new Error();
      setConfirmed(result);
      pendingKey.current = null;
    } catch {
      setNotice('Approval was not confirmed. Retry to check the same request.');
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  return <section className="draft-panel brainstorm-panel" aria-labelledby="storyboard-approval-title">
    <h2 id="storyboard-approval-title">Approve storyboard</h2>
    <p className="muted">Review the narration and scenes before approving this revision for video generation.</p>
    {settings ? <>
      <p className="muted">Settings for this approval come from source draft revision {document.projectRevision}.</p>
      <dl className="preference-summary">
        <div><dt>Narration voice preference</dt><dd>{settings.voice === 'male' ? 'Male' : 'Female'}</dd></div>
        <div><dt>Captions</dt><dd>Included</dd></div>
        <div><dt>Visual style</dt><dd>Topic-adaptive 2D</dd></div>
      </dl>
    </> : <p role="status">Source draft settings are unavailable. Generate a new storyboard to review its settings before approval.</p>}
    <div className="draft-actions brainstorm-actions">
      {approval
        ? <p role="status">{dirty ? `Revision ${document.revision} is approved. New edits need their own approval.` : `Revision ${document.revision} approved.`}</p>
        : <button type="button" className="button primary" disabled={!settings || !ready || busy || stale} onClick={() => void approve()}>
          {busy ? 'Approving…' : pendingKey.current ? 'Retry approval' : `Approve revision ${document.revision}`}
        </button>}
    </div>
    {!ready && !approval && <p className="muted">Finish saving your edits before approving.</p>}
    {notice && <p role="status">{notice}</p>}
  </section>;
}
