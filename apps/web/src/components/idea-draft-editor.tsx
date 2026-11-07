'use client';
import { useEffect,useRef,useState } from 'react';
import type { IdeaProject } from '@/lib/project-contract';
import { DraftAutosave,type AutosaveView } from '@/lib/draft-autosave';
import { useDraftNavigation } from './draft-navigation';

export function IdeaDraftEditor({project,ownerId}:{project:IdeaProject;ownerId:string}){
  const [view,setView]=useState<AutosaveView|null>(null),controller=useRef<DraftAutosave|null>(null);
  const navigation=useDraftNavigation();
  useEffect(()=>{
    let storage:Storage|null=null;try{storage=window.localStorage;}catch{}
    const editor=new DraftAutosave({project,ownerId,storage,online:navigator.onLine,transport:(url,options)=>fetch(url,options),notify:setView});
    controller.current=editor;setView(editor.view());
    const online=()=>editor.connectivity(navigator.onLine);
    window.addEventListener('online',online);window.addEventListener('offline',online);
    return()=>{editor.dispose();controller.current=null;window.removeEventListener('online',online);window.removeEventListener('offline',online);};
    // Keep a same-project server refresh from replacing pending browser text.
    // Each editor is keyed by its owner and project on the server page.
  },[ownerId,project.id]);
  useEffect(()=>{navigation.setDirty(!!view?.dirty);return()=>navigation.setDirty(false);},[view?.dirty,navigation]);
  const fields=view?.fields??project;
  const status=!view?'Opening draft…':({saved:`Saved · revision ${view.revision}`,pending:'Unsaved changes · autosave pending',saving:'Saving…',offline:'Offline · changes pending',error:'Not saved · needs attention',conflict:'Save paused · version conflict',recovery:'Local edits available to recover'}[view.status]);
  return <form onSubmit={event=>{event.preventDefault();void controller.current?.flush();}} className="draft-editor">
    {view?.status==='recovery'?<section className="draft-recovery" aria-labelledby="recovery-title"><h2 id="recovery-title">You have local edits.</h2><p>These edits were kept in this browser for your account. Review a copy before continuing; autosave is paused.</p>{view.recoveries.map(source=><div className="recovery-copy" key={source.key}><strong>{source.backup.fields.title||'Untitled local draft'}</strong><p className="muted">{source.backup.updatedAt.replace('T',' ').slice(0,19)} UTC · based on revision {source.backup.revision}</p><p className="muted">Your idea</p><p className="recovery-preview">{source.backup.fields.brief||'(No idea text)'}</p><p className="muted">Reference notes</p><p className="recovery-preview">{source.backup.fields.referenceText||'(No reference notes)'}</p><button type="button" className="button secondary" onClick={()=>controller.current?.restore(source.key)}>Restore this copy</button></div>)}<button type="button" className="button secondary" onClick={()=>controller.current?.discardRecoveries()}>Discard listed local copies and use saved draft</button></section>:null}
    <div className="draft-panel"><p className="eyebrow">YOUR IDEA, IN YOUR WORDS</p><h2>What do you want to explain?</h2>
      <fieldset disabled={!view||view.status==='recovery'}>
        <label htmlFor="draft-title">Draft title</label><input id="draft-title" value={fields.title} onChange={e=>controller.current?.change({title:e.target.value})} maxLength={140} required />
        <label htmlFor="draft-brief">Your idea</label><textarea id="draft-brief" value={fields.brief} onChange={e=>controller.current?.change({brief:e.target.value})} maxLength={6000} placeholder="Start with a question, a concept, or something you wish more people understood…" />
        <div className="field-meta"><span>A rough thought is a good start.</span><span>{fields.brief.length}/6,000</span></div>
        <label htmlFor="draft-notes">Reference notes <span className="muted">(optional)</span></label><textarea className="reference-notes" id="draft-notes" value={fields.referenceText} onChange={e=>controller.current?.change({referenceText:e.target.value})} maxLength={20000} placeholder="Keep useful facts and source notes with your idea." />
      </fieldset>
    </div>
    <aside className="draft-aside"><span className="tag lime">IDEA DRAFT</span><h3>Keep a good thought.</h3><p>This is your private starting point. Your edits save automatically after a short pause.</p><div className="draft-facts"><span>Target length</span><strong>{project.targetDurationMs/1000} seconds</strong><span>Stage</span><strong>Plan</strong></div><p className="muted">AI brainstorming and storyboard generation are coming next.</p></aside>
    <div className="draft-save-bar"><div><p role="status" aria-live="polite">{status}</p><p className="muted">Autosave on · pending edits stay in this browser until confirmed.</p></div><button className="button primary" type="submit" disabled={!view||!view.dirty||['saving','conflict','recovery'].includes(view.status)}>{view?.status==='error'?'Retry save':view?.status==='saving'?'Saving…':'Save now'}</button></div>
    {view?.storageWarning?<p className="draft-error" role="alert">Local recovery is unavailable. Keep this tab open until the server confirms your save.</p>:null}
    {view?.message?<p className="draft-error" role="alert">{view.message}</p>:null}
    {view?.status==='offline'?<p className="draft-error" role="status">You’re offline. Keep editing; saving will resume when the connection returns.</p>:null}
    {view?.status==='conflict'?<section className="draft-recovery" aria-labelledby="conflict-title"><h2 id="conflict-title">Keep the version you want.</h2><p>Your local text is still in the editor. Load the latest saved copy to compare before choosing.</p><button type="button" className="button secondary" disabled={view.comparing} onClick={()=>void controller.current?.compare()}>{view.comparing?'Loading…':'Load saved version to compare'}</button>{view.remote?<><div className="recovery-copy"><h3>Saved · revision {view.remote.revision}</h3><strong>{view.remote.title}</strong><p className="recovery-preview">{view.remote.brief}</p><p className="recovery-preview">{view.remote.referenceText}</p></div><div className="draft-actions"><button type="button" className="button secondary" onClick={()=>controller.current?.resolve('remote')}>Discard my edits and use this saved version</button><button type="button" className="button primary" onClick={()=>controller.current?.resolve('local')}>Replace saved version with my edits</button></div></>:null}</section>:null}
  </form>;
}
