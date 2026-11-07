'use client';
import { useEffect,useRef,useState } from 'react';
import type { IdeaProject } from '@/lib/project-contract';
import { useDraftNavigation } from './draft-navigation';

export function IdeaDraftEditor({project}:{project:IdeaProject}){
  const [title,setTitle]=useState(project.title),[brief,setBrief]=useState(project.brief),[notes,setNotes]=useState(project.referenceText);
  const [saved,setSaved]=useState(project),[saving,setSaving]=useState(false),[error,setError]=useState(''),[conflict,setConflict]=useState(false);
  const pending=useRef<{key:string;body:string}|null>(null),inFlight=useRef(false),navigation=useDraftNavigation();
  const dirty=title!==saved.title||brief!==saved.brief||notes!==saved.referenceText;
  useEffect(()=>{navigation.setDirty(dirty);return()=>navigation.setDirty(false);},[dirty,navigation]);
  async function save(event:React.FormEvent){
    event.preventDefault();if(inFlight.current||!dirty)return;inFlight.current=true;setSaving(true);setError('');setConflict(false);
    const body=JSON.stringify({expectedRevision:saved.revision,title,brief,referenceText:notes});
    if(!pending.current||pending.current.body!==body)pending.current={key:crypto.randomUUID(),body};
    try{
      const response=await fetch(`/api/v1/projects/${project.id}`,{method:'PATCH',headers:{'Content-Type':'application/json','Idempotency-Key':pending.current.key},body}),result=await response.json();
      if(!response.ok){setConflict(result.error?.code==='REVISION_CONFLICT');throw Error(result.error?.message||'The draft could not be saved.');}
      setSaved(result.data);setTitle(result.data.title);setBrief(result.data.brief);setNotes(result.data.referenceText);pending.current=null;navigation.setDirty(false);
    }catch(error){setError(error instanceof Error?error.message:'The draft could not be saved. Your text is still here.');}
    finally{inFlight.current=false;setSaving(false);}
  }
  return <form onSubmit={save} className="draft-editor">
    <div className="draft-panel"><p className="eyebrow">YOUR IDEA, IN YOUR WORDS</p><h2>What do you want to explain?</h2>
      <fieldset disabled={saving}>
        <label htmlFor="draft-title">Draft title</label><input id="draft-title" value={title} onChange={e=>setTitle(e.target.value)} maxLength={140} required />
        <label htmlFor="draft-brief">Your idea</label><textarea id="draft-brief" value={brief} onChange={e=>setBrief(e.target.value)} maxLength={6000} placeholder="Start with a question, a concept, or something you wish more people understood…" />
        <div className="field-meta"><span>A rough thought is a good start.</span><span>{brief.length}/6,000</span></div>
        <label htmlFor="draft-notes">Reference notes <span className="muted">(optional)</span></label><textarea className="reference-notes" id="draft-notes" value={notes} onChange={e=>setNotes(e.target.value)} maxLength={20000} placeholder="Keep useful facts and source notes with your idea." />
      </fieldset>
    </div>
    <aside className="draft-aside"><span className="tag lime">IDEA DRAFT</span><h3>Keep a good thought.</h3><p>This is your private starting point. Save it now and come back when you’re ready to shape the explanation.</p><div className="draft-facts"><span>Target length</span><strong>{project.targetDurationMs/1000} seconds</strong><span>Stage</span><strong>Plan</strong></div><p className="muted">AI brainstorming and storyboard generation are coming next.</p></aside>
    <div className="draft-save-bar"><div><p role="status" aria-live="polite">{saving?'Saving…':dirty?'Unsaved changes · choose Save draft':`Saved · revision ${saved.revision}`}</p><p className="muted">Manual saving for now. Autosave is the next update.</p></div><button className="button primary" type="submit" disabled={saving||!dirty}>{saving?'Saving…':'Save draft'}</button></div>
    {error?<div className="draft-error" role="alert"><p>{error}</p>{conflict?<><p>Copy any text you want to keep before reloading. Reloading replaces these fields with the saved version.</p><button className="button secondary" type="button" onClick={()=>{if(navigation.confirmLeave()){navigation.setDirty(false);location.reload();}}}>Reload saved version</button></>:null}</div>:null}
  </form>;
}
