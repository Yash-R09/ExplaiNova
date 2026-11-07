'use client';
import {useRef,useState} from 'react';
import {uuidPattern} from '@/lib/project-contract';

export function DuplicateDraftButton({id,title,revision}:{id:string;title:string;revision:number}){
  const command=useRef({key:'',busy:false}),[busy,setBusy]=useState(false),[error,setError]=useState(''),[stale,setStale]=useState(false);
  async function duplicate(){
    if(command.current.busy)return;
    command.current.busy=true;command.current.key ||= crypto.randomUUID();setBusy(true);setError('');setStale(false);
    const abort=new AbortController(),timeout=setTimeout(()=>abort.abort(),30000);
    try{
      const response=await fetch(`/api/v1/projects/${id}/duplicate`,{method:'POST',signal:abort.signal,headers:{'Content-Type':'application/json','Idempotency-Key':command.current.key},body:JSON.stringify({expectedRevision:revision})}),result=await response.json();
      if(!response.ok){setStale(result.error?.code==='REVISION_CONFLICT');throw Error(result.error?.code==='REVISION_CONFLICT'?'This draft changed. Refresh the library before copying it.':result.error?.message||'The copy could not be created. Retry to check the same request.');}
      if(!uuidPattern.test(result.data?.id)||result.data.id===id)throw Error('The copy could not be confirmed. Retry to check the same request.');
      window.location.assign(`/projects/${result.data.id}`);
    }catch(error){setError(error instanceof Error&&error.name!=='AbortError'?error.message:'The copy could not be confirmed. Retry to check the same request.');command.current.busy=false;setBusy(false);}
    finally{clearTimeout(timeout);}
  }
  return <div className="draft-card-actions"><button className="button secondary" type="button" aria-label={`Duplicate ${title}`} disabled={busy} onClick={()=>void duplicate()}>{busy?'Creating copy…':'Duplicate draft'}</button>{error?<div role="alert" className="draft-error"><p>{error}</p>{stale?<button type="button" className="button secondary" onClick={()=>location.reload()}>Refresh library</button>:null}</div>:null}</div>;
}
