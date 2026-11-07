'use client';
import { createContext,useContext,useEffect,useRef,type ReactNode } from 'react';
import { guardDraftLinkClick } from '@/lib/draft-navigation';
const Context=createContext<{setDirty:(value:boolean)=>void;confirmLeave:()=>boolean}>({setDirty:()=>{},confirmLeave:()=>true});
export const useDraftNavigation=()=>useContext(Context);
export function DraftNavigation({children}:{children:ReactNode}){
  const dirty=useRef(false);
  const value={setDirty:(next:boolean)=>{dirty.current=next;},confirmLeave:()=>!dirty.current||window.confirm('You have unsaved changes. Leave without saving?')};
  useEffect(()=>{const before=(event:BeforeUnloadEvent)=>{if(dirty.current){event.preventDefault();event.returnValue='';}};window.addEventListener('beforeunload',before);return()=>window.removeEventListener('beforeunload',before);},[]);
  return <Context.Provider value={value}><div onClickCapture={event=>{
    const anchor=(event.target as HTMLElement).closest('a[href]') as HTMLAnchorElement|null;
    if(!anchor||(anchor.target&&anchor.target.toLowerCase()!=='_self')||anchor.hasAttribute('download')||anchor.hash&&anchor.pathname===location.pathname)return;
    guardDraftLinkClick(event,value.confirmLeave);
  }} onSubmitCapture={event=>{if((event.target as HTMLFormElement).hasAttribute('data-leaves-draft')&&!value.confirmLeave()){event.preventDefault();event.stopPropagation();}}}>{children}</div></Context.Provider>;
}
