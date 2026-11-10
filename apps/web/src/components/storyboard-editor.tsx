'use client';

import { useEffect, useRef, useState } from 'react';
import type { StoryboardDocument } from '@/lib/storyboard-contract';
import type { StoryboardCandidate } from '@/lib/storyboard-candidate';
import { useDraftNavigation } from './draft-navigation';
import { StoryboardAutosave, type StoryboardAutosaveView } from '@/lib/storyboard-autosave';
import { StoryboardSuggestions } from './storyboard-suggestions';
import { StoryboardApprovalPanel } from './storyboard-approval';

type SceneField = 'title' | 'purpose' | 'narration' | 'motion';
const sceneFields: { field: SceneField; label: string; maxLength: number }[] = [
  { field: 'title', label: 'Scene title', maxLength: 100 },
  { field: 'purpose', label: 'Learning purpose', maxLength: 220 },
  { field: 'narration', label: 'Narration', maxLength: 600 },
  { field: 'motion', label: 'Motion cues', maxLength: 280 },
];
const statusLabels = {
  saved: 'Saved', pending: 'Unsaved edits · autosave pending', saving: 'Saving…',
  offline: 'Offline · edits pending', error: 'Save paused', conflict: 'Save paused · revision conflict',
  recovery: 'Local edits available to recover',
};

function StoryboardCopy({ content, expanded = false }: { content: StoryboardCandidate; expanded?: boolean }) {
  return <details className="storyboard-preview" open={expanded}>
    <summary>{content.title || 'Untitled storyboard'}</summary>
    <p>{content.theme}</p>
    {content.reviewNotes.length > 0 && <>
      <strong>AI review notes</strong>
      <ul>{content.reviewNotes.map((note, index) => <li key={index}>{note}</li>)}</ul>
    </>}
    <ol>{content.scenes.map((scene, index) => <li key={index}>
      <strong>{scene.title || `Scene ${index + 1}`}</strong>
      <p>Scene type: {scene.type}</p>
      <p>{scene.purpose}</p>
      <p className="brainstorm-text">{scene.narration || '(No narration)'}</p>
      <p>{scene.motion}</p>
      <p>Objects: {scene.objects.length ? scene.objects.join(', ') : 'None'}</p>
      <p>Labels: {scene.labels.length ? scene.labels.join(', ') : 'None'}</p>
    </li>)}</ol>
  </details>;
}

export function StoryboardEditor({ initial, ownerId }: { initial: StoryboardDocument; ownerId: string }) {
  const [view, setView] = useState<StoryboardAutosaveView | null>(null);
  const controller = useRef<StoryboardAutosave | null>(null);
  const { setDirty } = useDraftNavigation();

  useEffect(() => {
    let storage: Storage | null = null;
    try { storage = window.localStorage; } catch {}
    const editor = new StoryboardAutosave({ initial, ownerId, storage, online: navigator.onLine,
      transport: (input, init) => fetch(input, init), notify: setView });
    controller.current = editor;
    setView(editor.view());
    const connectivity = () => editor.connectivity(navigator.onLine);
    window.addEventListener('online', connectivity);
    window.addEventListener('offline', connectivity);
    return () => {
      editor.dispose();
      controller.current = null;
      window.removeEventListener('online', connectivity);
      window.removeEventListener('offline', connectivity);
    };
    // The server keys this editor by owner and storyboard. Preserve same-page local edits.
  }, [ownerId, initial.id]);

  useEffect(() => {
    setDirty(!!view?.dirty);
    return () => setDirty(false);
  }, [view?.dirty, setDirty]);

  const saved = view?.saved ?? initial;
  const content = view?.content ?? initial.content;
  function editScene(index: number, field: SceneField, value: string) {
    controller.current?.change(current => ({
      ...current, scenes: current.scenes.map((scene, sceneIndex) => sceneIndex === index ? { ...scene, [field]: value } : scene),
    }));
  }

  return <><form className="draft-panel storyboard-editor" noValidate onSubmit={event => {
    event.preventDefault();
    void controller.current?.flush();
  }}>
    {view?.status === 'recovery' && <section className="draft-recovery" aria-labelledby="storyboard-recovery">
      <h2 id="storyboard-recovery">Recover storyboard edits</h2>
      <p>These copies were kept in this browser. Choose one before autosave resumes.</p>
      {view.recoveries.map(source => <div className="recovery-copy" key={source.key}>
        <p className="muted">Based on revision {source.backup.revision} · {new Date(source.backup.updatedAt).toLocaleString()}</p>
        <StoryboardCopy content={source.backup.content} />
        <button type="button" className="button secondary" onClick={() => controller.current?.restore(source.key)}>Restore this copy</button>
      </div>)}
      <button type="button" className="button secondary" onClick={() => controller.current?.discardRecoveries()}>
        Discard listed copies and open the saved storyboard
      </button>
    </section>}
    <p className="muted">Source draft revision {saved.projectRevision} · {content.targetDurationMs / 1000}s target</p>
    <fieldset disabled={!view || view.status === 'recovery'}>
      <label htmlFor="storyboard-name">Storyboard title</label>
      <input id="storyboard-name" value={content.title} required maxLength={140}
        onChange={event => controller.current?.change(current => ({ ...current, title: event.target.value }))} />
      <label htmlFor="storyboard-theme">Visual theme</label>
      <input id="storyboard-theme" value={content.theme} required maxLength={250}
        onChange={event => controller.current?.change(current => ({ ...current, theme: event.target.value }))} />
      <ol className="storyboard-scene-list">
        {content.scenes.map((scene: StoryboardCandidate['scenes'][number], index) => (
          <li key={index} className="recovery-copy">
            <h2>Scene {index + 1}</h2>
            <p className="muted">{scene.type} · {((saved.content.scenes[index]?.durationMs ?? scene.durationMs) / 1000).toFixed(1)}s estimated from the saved version</p>
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
    {view?.status === 'conflict' && <section className="draft-recovery" aria-labelledby="storyboard-conflict">
      <h2 id="storyboard-conflict">Compare storyboard versions</h2>
      <p>Your local edits are still in the editor. Review the saved version before choosing.</p>
      <button type="button" className="button secondary" disabled={view.comparing} onClick={() => void controller.current?.compare()}>
        {view.comparing ? 'Loading…' : 'Load latest saved version'}
      </button>
      {view.remote && <div className="recovery-copy">
        <p className="muted">Saved revision {view.remote.revision}</p>
        <StoryboardCopy content={view.remote.content} expanded />
        <div className="draft-actions">
          <button type="button" className="button secondary" disabled={view.comparing} onClick={() => controller.current?.resolve('saved')}>
            Discard my edits and use this version
          </button>
          <button type="button" className="button primary" disabled={view.comparing} onClick={() => controller.current?.resolve('local')}>
            Save my edits over this version
          </button>
        </div>
      </div>}
    </section>}
    <div className="draft-save-bar storyboard-save">
      <div><p role="status">{!view ? 'Opening storyboard…' : view.status === 'saved' ? `Saved · revision ${view.revision}` : statusLabels[view.status]}</p>
        <p className="muted">Autosave on · timing updates after each confirmed save.</p>
        {view?.message && <p role="status">{view.message}</p>}
        {view?.storageWarning && <p role="alert">Local recovery is unavailable. Keep this tab open until the save is confirmed.</p>}
      </div>
      <button className="button primary" type="submit"
        disabled={!view?.dirty || ['saving', 'conflict', 'recovery', 'offline'].includes(view.status)}>
        {view?.status === 'error' ? 'Retry save' : 'Save storyboard'}
      </button>
    </div>
  </form>
  <StoryboardApprovalPanel key={saved.revisionId} document={saved} ready={view?.status === 'saved' && !view.dirty} dirty={!!view?.dirty} />
  <StoryboardSuggestions id={initial.id} projectId={initial.projectId} revision={saved.revision} savedContent={saved.content}
    ready={view?.status === 'saved' && !view.dirty}
    preview={proposal => <StoryboardCopy content={proposal} expanded />}
    apply={(base, proposal) => void controller.current?.applyProposal(base, proposal)} />
  </>;
}
