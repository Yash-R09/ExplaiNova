'use client';
import { useEffect,useRef,useState } from 'react';
import type { IdeaProject } from '@/lib/project-contract';
import { DraftAutosave,type AutosaveView } from '@/lib/draft-autosave';
import type {DraftPreferences} from '@/lib/draft-preferences';
import { useDraftNavigation } from './draft-navigation';

function PreferenceSummary({value}:{value:DraftPreferences}){
  return <dl className="preference-summary"><div><dt>Target length</dt><dd>{value.targetDurationMs/1000}s</dd></div><div><dt>Audience</dt><dd>{value.audienceLevel}</dd></div><div><dt>Tone</dt><dd>{value.tone}</dd></div><div><dt>Voice</dt><dd>{value.settings.voice==='male'?'Male':'Female'}</dd></div><div><dt>Visuals</dt><dd>Topic-adaptive 2D</dd></div><div><dt>Captions</dt><dd>Included</dd></div></dl>;
}

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
    {view?.status==='recovery'?<section className="draft-recovery" aria-labelledby="recovery-title"><h2 id="recovery-title">You have local edits.</h2><p>These edits were kept in this browser for your account. Review a copy before continuing; autosave is paused.</p>{view.recoveries.map(source=><div className="recovery-copy" key={source.key}><strong>{source.backup.fields.title||'Untitled local draft'}</strong><p className="muted">{source.backup.updatedAt.replace('T',' ').slice(0,19)} UTC · based on revision {source.backup.revision}</p><p className="muted">Your idea</p><p className="recovery-preview">{source.backup.fields.brief||'(No idea text)'}</p><p className="muted">Reference notes</p><p className="recovery-preview">{source.backup.fields.referenceText||'(No reference notes)'}</p><PreferenceSummary value={source.backup.fields} />{source.backup.legacyTextOnly?<p className="muted">This older copy kept text only. These preferences come from the saved draft.</p>:null}<button type="button" className="button secondary" onClick={()=>controller.current?.restore(source.key)}>Restore this copy</button></div>)}<button type="button" className="button secondary" onClick={()=>controller.current?.discardRecoveries()}>Discard listed local copies and use saved draft</button></section>:null}
    <div className="draft-panel"><p className="eyebrow">YOUR IDEA, IN YOUR WORDS</p><h2>What do you want to explain?</h2>
      <fieldset disabled={!view||view.status==='recovery'}>
        <label htmlFor="draft-title">Draft title</label><input id="draft-title" value={fields.title} onChange={e=>controller.current?.change({title:e.target.value})} maxLength={140} required />
        <label htmlFor="draft-brief">Your idea</label><textarea id="draft-brief" value={fields.brief} onChange={e=>controller.current?.change({brief:e.target.value})} maxLength={6000} placeholder="Start with a question, a concept, or something you wish more people understood…" />
        <div className="field-meta"><span>A rough thought is a good start.</span><span>{fields.brief.length}/6,000</span></div>
        <label htmlFor="draft-notes">Reference notes <span className="muted">(optional)</span></label><textarea className="reference-notes" id="draft-notes" value={fields.referenceText} onChange={e=>controller.current?.change({referenceText:e.target.value})} maxLength={20000} placeholder="Keep useful facts and source notes with your idea." />
      </fieldset>
      <details className="draft-preferences"><summary>Video preferences <span>{fields.targetDurationMs/1000}s · {fields.settings.voice==='male'?'Male':'Female'} voice</span></summary>
        <fieldset disabled={!view||view.status==='recovery'}><div className="preference-controls">
          <div><label htmlFor="draft-duration">Target length</label><select id="draft-duration" value={fields.targetDurationMs} onChange={e=>controller.current?.change({targetDurationMs:Number(e.target.value)})}><option value={30000}>30 seconds</option><option value={60000}>60 seconds</option><option value={90000}>90 seconds</option></select></div>
          <div><label htmlFor="draft-audience">Audience level</label><select id="draft-audience" value={fields.audienceLevel} onChange={e=>controller.current?.change({audienceLevel:e.target.value})}><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></div>
          <div><label htmlFor="draft-tone">Tone</label><select id="draft-tone" value={fields.tone} onChange={e=>controller.current?.change({tone:e.target.value})}><option value="clear">Clear</option><option value="conversational">Conversational</option><option value="direct">Direct</option></select></div>
          <div><label htmlFor="draft-voice">Narration voice</label><select id="draft-voice" value={fields.settings.voice} onChange={e=>controller.current?.change({settings:{...fields.settings,voice:e.target.value as 'male'|'female'}})}><option value="female">Female</option><option value="male">Male</option></select></div>
        </div><p className="muted">Captions included · Topic-adaptive 2D visuals.</p><p className="muted">Voice type is a saved preference. Available voices and samples will appear when narration is connected.</p></fieldset>
      </details>
    </div>
    <aside className="draft-aside"><span className="tag lime">IDEA DRAFT</span><h3>Keep a good thought.</h3><p>This is your private starting point. Your edits save automatically after a short pause.</p><div className="draft-facts"><span>Target length</span><strong>{fields.targetDurationMs/1000} seconds</strong><span>Stage</span><strong>Plan</strong></div><p className="muted">AI brainstorming and storyboard generation are coming next.</p></aside>
    <div className="draft-save-bar"><div><p role="status" aria-live="polite">{status}</p><p className="muted">Autosave on · pending edits stay in this browser until confirmed.</p></div><button className="button primary" type="submit" disabled={!view||!view.dirty||['saving','conflict','recovery'].includes(view.status)}>{view?.status==='error'?'Retry save':view?.status==='saving'?'Saving…':'Save now'}</button></div>
    {view?.storageWarning?<p className="draft-error" role="alert">Local recovery is unavailable. Keep this tab open until the server confirms your save.</p>:null}
    {view?.message?<p className="draft-error" role="alert">{view.message}</p>:null}
    {view?.status==='offline'?<p className="draft-error" role="status">You’re offline. Keep editing; saving will resume when the connection returns.</p>:null}
    {view?.status==='conflict'?<section className="draft-recovery" aria-labelledby="conflict-title"><h2 id="conflict-title">Keep the version you want.</h2><p>Your local text is still in the editor. Load the latest saved copy to compare before choosing.</p><button type="button" className="button secondary" disabled={view.comparing} onClick={()=>void controller.current?.compare()}>{view.comparing?'Loading…':'Load saved version to compare'}</button>{view.remote?<><div className="recovery-copy"><h3>Saved · revision {view.remote.revision}</h3><strong>{view.remote.title}</strong><p className="recovery-preview">{view.remote.brief}</p><p className="recovery-preview">{view.remote.referenceText}</p><PreferenceSummary value={view.remote} /></div><div className="draft-actions"><button type="button" className="button secondary" onClick={()=>controller.current?.resolve('remote')}>Discard my edits and use this saved version</button><button type="button" className="button primary" onClick={()=>controller.current?.resolve('local')}>Replace saved version with my edits</button></div></>:null}</section>:null}
  </form>;
}
