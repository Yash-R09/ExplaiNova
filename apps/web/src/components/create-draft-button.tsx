'use client';
import { useRef,useState } from 'react';
import { Icon } from './icon';
import { useDraftNavigation } from './draft-navigation';
export function CreateDraftButton({children='New draft',className='button primary'}:{children?:React.ReactNode;className?:string}){
  const operation=useRef({key:'',busy:false}),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const navigation=useDraftNavigation();
  async function create(){
    if(operation.current.busy||!navigation.confirmLeave())return;
    operation.current.busy=true;operation.current.key ||= crypto.randomUUID();setBusy(true);setError('');
    try{
      const response=await fetch('/api/v1/projects',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':operation.current.key},body:'{}'}),result=await response.json();
      if(!response.ok)throw Error(result.error?.message||'The draft could not be created. Please try again.');
      navigation.setDirty(false);window.location.assign(`/projects/${result.data.id}`);
    }catch(error){setError(error instanceof Error?error.message:'The draft could not be created. Please try again.');operation.current.busy=false;setBusy(false);}
  }
  return <div className="create-draft-control"><button type="button" className={className} disabled={busy} onClick={create}><Icon name="plus" />{busy?'Creating draft…':children}</button>{error?<p role="alert" className="draft-error">{error}</p>:null}</div>;
}
