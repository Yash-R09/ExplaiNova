'use client';
import {useEffect,useRef,useState} from 'react';
import {bindSearchHistory} from '@/lib/search-history';

export function TitleSearchInput({id,query}:{id:string;query:string}){
  const [value,setValue]=useState(query),input=useRef<HTMLInputElement>(null);
  useEffect(()=>{setValue(query);if(input.current)input.current.value=query;},[query]);
  useEffect(()=>bindSearchHistory(window,()=>new URLSearchParams(window.location.search).get('q')?.trim()??'',restored=>{
    setValue(restored);
    // Reassert the DOM value even if React's state already equals the query:
    // browsers can restore the DOM independently when reusing a cached page.
    if(input.current)input.current.value=restored;
  }),[]);
  return <input ref={input} id={id} type="search" name="q" value={value} onChange={event=>setValue(event.target.value)} maxLength={140} placeholder="Find an idea by title" />;
}
