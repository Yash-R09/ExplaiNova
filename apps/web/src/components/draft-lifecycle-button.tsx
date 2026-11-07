'use client';
import {useRef,useState} from 'react';
export function DraftLifecycleButton({id,title,revision,mode,returnTo}:{id:string;title:string;revision:number;mode:'trash'|'restore';returnTo?:string}){
 const [confirm,setConfirm]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[stale,setStale]=useState(false);
 const operation=useRef({key:'',busy:false});
 async function run(){
  if(operation.current.busy)return;
  operation.current.busy=true;operation.current.key ||= crypto.randomUUID();setBusy(true);setError('');setStale(false);
  const abort=new AbortController(),timeout=setTimeout(()=>abort.abort(),30000);
  try{
   const response=await fetch(`/api/v1/projects/${id}${mode==='restore'?'/restore':''}`,{method:mode==='restore'?'POST':'DELETE',signal:abort.signal,headers:{'Content-Type':'application/json','Idempotency-Key':operation.current.key},body:JSON.stringify({expectedRevision:revision})}),result=await response.json();
   if(!response.ok){setStale([404,409].includes(response.status));throw Error(response.status===409?'This draft changed. Refresh before trying again.':response.status===404?'This draft is no longer in this view. Refresh to see its current state.':result.error?.message||'The change could not be confirmed. Retry the same request.');}
   if(result.data?.id!==id||result.data?.revision!==revision+1||(mode==='trash'?result.data?.status!=='trashed':result.data?.status!=='draft'))throw Error('The change could not be confirmed. Retry the same request.');
   window.location.assign(returnTo??(mode==='trash'?'/projects':'/projects/trash'));
  }catch(error){setError(error instanceof Error&&error.name!=='AbortError'?error.message:'The change could not be confirmed. Retry the same request.');operation.current.busy=false;setBusy(false);}
  finally{clearTimeout(timeout);}
 }
 return <div className="draft-card-actions lifecycle-action">
  {mode==='trash'&&!confirm?<button type="button" className="button secondary" aria-label={`Move ${title} to Trash`} onClick={()=>setConfirm(true)}>Move to Trash</button>:<>
   {mode==='trash'?<p className="muted">Move “{title}” to Trash? Its saved content can be restored.</p>:null}
   <button type="button" className={`button ${mode==='trash'?'secondary':'primary'}`} aria-label={mode==='restore'?`Restore ${title}`:undefined} disabled={busy||stale} onClick={()=>void run()}>{busy?'Working…':mode==='restore'?'Restore draft':'Confirm move to Trash'}</button>
   {mode==='trash'&&!busy&&!operation.current.key?<button type="button" className="button secondary" onClick={()=>setConfirm(false)}>Cancel</button>:null}
  </>}
  {error?<div className="draft-error" role="alert"><p>{error}</p>{stale?<button type="button" className="button secondary" onClick={()=>location.reload()}>Refresh view</button>:null}</div>:null}
 </div>;
}
