'use client';

import { useEffect, useRef, useState } from 'react';
import type { StoryboardDocument } from '@/lib/storyboard-contract';
import type { StoryboardCandidate } from '@/lib/storyboard-candidate';
import { useDraftNavigation } from './draft-navigation';

type SceneField = 'title' | 'purpose' | 'narration' | 'motion';
const sceneFields: { field: SceneField; label: string; maxLength: number }[] = [
  { field: 'title', label: 'Scene title', maxLength: 100 },
  { field: 'purpose', label: 'Learning purpose', maxLength: 220 },
  { field: 'narration', label: 'Narration', maxLength: 600 },
  { field: 'motion', label: 'Motion cues', maxLength: 280 },
];
type SaveRequest = { key: string; body: string };

export function StoryboardEditor({ initial }: { initial: StoryboardDocument }) {
  const [saved, setSaved] = useState(initial);
  const [content, setContent] = useState(initial.content);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState<SaveRequest | null>(null);
  const [conflict, setConflict] = useState(false);
  const [notice, setNotice] = useState('');
  const inFlight = useRef(false);
  const { setDirty } = useDraftNavigation();
  const endpoint = `/api/v1/storyboards/${initial.id}`;
  const dirty = JSON.stringify(content) !== JSON.stringify(saved.content);

  useEffect(() => {
    setDirty(dirty || !!uncertain);
    return () => setDirty(false);
  }, [dirty, uncertain, setDirty]);

  function accept(document: StoryboardDocument) {
    setSaved(document);
    setContent(document.content);
    setConflict(false);
    setUncertain(null);
  }

  async function save(command: SaveRequest) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setNotice('');
    try {
      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': command.key },
        body: command.body,
        signal: AbortSignal.timeout(15_000),
      });
      const payload = await response.json();
      if (response.status >= 500) throw new Error();
      if (!response.ok) {
        setUncertain(null);
        setConflict(payload.error?.code === 'REVISION_CONFLICT');
        setNotice(payload.error?.message ?? 'Could not save the storyboard.');
        return;
      }
      if (payload.data?.id !== initial.id || payload.data?.revision !== saved.revision + 1) throw new Error();
      accept(payload.data);
      setNotice('Storyboard saved.');
    } catch {
      setUncertain(command);
      setNotice('Could not confirm the save. Retry it or dismiss the pending save and keep editing.');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function loadLatest() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setNotice('');
    try {
      const response = await fetch(endpoint, { cache: 'no-store', signal: AbortSignal.timeout(10_000) });
      const payload = await response.json();
      if (!response.ok || payload.data?.id !== initial.id) throw new Error();
      accept(payload.data);
      setNotice('Latest saved version loaded.');
    } catch {
      setNotice('Could not load the saved storyboard. Your edits are still here.');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  function editScene(index: number, field: SceneField, value: string) {
    setContent(current => ({
      ...current,
      scenes: current.scenes.map((scene, sceneIndex) => sceneIndex === index ? { ...scene, [field]: value } : scene),
    }));
  }

  return <form className="draft-panel storyboard-editor" onSubmit={event => {
    event.preventDefault();
    if (dirty && !conflict && !uncertain) {
      void save({ key: crypto.randomUUID(), body: JSON.stringify({ expectedRevision: saved.revision, content }) });
    }
  }}>
    <p className="muted">Source draft revision {saved.projectRevision} · {content.targetDurationMs / 1000}s target</p>
    <fieldset disabled={busy || !!uncertain}>
      <label htmlFor="storyboard-name">Storyboard title</label>
      <input id="storyboard-name" value={content.title} required maxLength={140}
        onChange={event => setContent({ ...content, title: event.target.value })} />
      <label htmlFor="storyboard-theme">Visual theme</label>
      <input id="storyboard-theme" value={content.theme} required maxLength={250}
        onChange={event => setContent({ ...content, theme: event.target.value })} />
      <ol className="storyboard-scene-list">
        {content.scenes.map((scene: StoryboardCandidate['scenes'][number], index) => (
          <li key={index} className="recovery-copy">
            <h2>Scene {index + 1}</h2>
            <p className="muted">{scene.type} · {(scene.durationMs / 1000).toFixed(1)}s estimated from the saved version</p>
            {sceneFields.map(({ field, label, maxLength }) => {
              const id = `storyboard-scene-${index}-${field}`;
              return <div key={field}>
                <label htmlFor={id}>{label}</label>
                {field === 'narration'
                  ? <textarea id={id} value={scene[field]} required maxLength={maxLength}
                    onChange={event => editScene(index, field, event.target.value)} />
                  : <input id={id} value={scene[field]} required maxLength={maxLength}
                    onChange={event => editScene(index, field, event.target.value)} />}
              </div>;
            })}
            {scene.objects.length > 0 && <p>Objects: {scene.objects.join(', ')}</p>}
            {scene.labels.length > 0 && <p>Labels: {scene.labels.join(', ')}</p>}
          </li>
        ))}
      </ol>
    </fieldset>
    {content.reviewNotes.length > 0 && <details><summary>AI review notes</summary>
      <ul>{content.reviewNotes.map((note, index) => <li key={index}>{note}</li>)}</ul></details>}
    <div className="draft-save-bar storyboard-save">
      <div><p role="status">{busy ? 'Working…' : dirty ? `Unsaved edits · based on revision ${saved.revision}` : `Saved · revision ${saved.revision}`}</p>
        {notice && <p role="status">{notice}</p>}</div>
      <div className="draft-actions">
        {conflict ? <button type="button" className="button secondary" disabled={busy}
          onClick={() => { if (window.confirm('Replace your unsaved edits with the latest saved storyboard?')) void loadLatest(); }}>
          Load latest saved version
        </button> : uncertain ? <>
          <button type="button" className="button primary" disabled={busy} onClick={() => void save(uncertain)}>Retry save</button>
          <button type="button" className="button secondary" disabled={busy} onClick={() => {
            setUncertain(null);
            setNotice('Pending save dismissed. Your edits are still here.');
          }}>Dismiss and keep editing</button>
        </> : <button className="button primary" type="submit" disabled={busy || !dirty}>Save storyboard</button>}
      </div>
    </div>
  </form>;
}
