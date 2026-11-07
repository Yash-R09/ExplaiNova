import test from 'node:test';
import assert from 'node:assert/strict';
import {bindSearchHistory} from '../src/lib/search-history.ts';
function host(){
  const events=new Map<string,()=>void>(),frames=new Map<number,()=>void>();let next=0;
  return {events,frames,addEventListener:(type:string,fn:()=>void)=>{events.set(type,fn);},removeEventListener:(type:string)=>{events.delete(type);},requestAnimationFrame:(fn:()=>void)=>{frames.set(++next,fn);return next;},cancelAnimationFrame:(id:number)=>{frames.delete(id);},paint(){const pending=[...frames.values()];frames.clear();for(const fn of pending)fn();}};
}
test('history restores the applied query again after the browser restores an edited input',()=>{
  const page=host();let query='Ocean',input='Lunar';const stop=bindSearchHistory(page,()=>query,value=>{input=value;});
  page.events.get('pageshow')!();assert.equal(input,'Ocean');input='Lunar';page.events.get('popstate')!();input='Lunar';page.paint();assert.equal(input,'Ocean');
  query='Lunar';page.events.get('popstate')!();page.paint();assert.equal(input,'Lunar');stop();
});
test('unsubmitted edits are retained when no history event occurs',()=>{
  const page=host();let input='Ocean';const stop=bindSearchHistory(page,()=>'Ocean',value=>{input=value;});input='Unsubmitted Saturn';page.paint();assert.equal(input,'Unsubmitted Saturn');stop();
});
test('rapid navigation reads the latest URL and cleanup cancels late resets',()=>{
  const page=host();let query='Ocean',input='Typed';const stop=bindSearchHistory(page,()=>query,value=>{input=value;});
  page.events.get('popstate')!();query='';page.events.get('pageshow')!();assert.equal(page.frames.size,1);page.paint();assert.equal(input,'');
  page.events.get('popstate')!();stop();input='A different page';page.paint();assert.equal(input,'A different page');assert.equal(page.events.size,0);assert.equal(page.frames.size,0);
});
