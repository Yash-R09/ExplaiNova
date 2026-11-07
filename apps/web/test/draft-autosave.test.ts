import test,{afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {setTimeout as delay,setImmediate as turn} from 'node:timers/promises';
import {DraftAutosave} from '../src/lib/draft-autosave.ts';
import type {IdeaProject} from '../src/lib/project-contract.ts';

const project:IdeaProject={id:'11111111-1111-4111-8111-111111111111',title:'First',brief:'Original',referenceText:'',revision:1,targetDurationMs:60000,audienceLevel:'beginner',tone:'clear',settings:{voice:'female',captions:true,theme:'topic'},status:'draft',createdAt:'2026-11-07T00:00:00Z',updatedAt:'2026-11-07T00:00:00Z'};
class MemoryStorage{
  items=new Map<string,string>();get length(){return this.items.size;}
  key(i:number){return [...this.items.keys()][i]??null;}getItem(k:string){return this.items.get(k)??null;}
  setItem(k:string,v:string){this.items.set(k,v);}removeItem(k:string){this.items.delete(k);}
}
const reply=(status:number,body:unknown)=>({status,ok:status<300,json:async()=>body});
function backend(){
 let saved={...project};const calls:{key:string;body:string}[]=[],acks=new Map<string,IdeaProject>();
 return {calls,get saved(){return saved;},advance(){saved={...saved,revision:saved.revision+1,brief:'Saved elsewhere'};},
  async send(_url:string,options?:RequestInit){
   if(!options?.method)return reply(200,{data:saved});
   const key=(options.headers as Record<string,string>)['Idempotency-Key'],body=String(options.body);calls.push({key,body});
   if(acks.has(key))return reply(200,{data:acks.get(key)});
   const {expectedRevision,...fields}=JSON.parse(body);
   if(expectedRevision!==saved.revision)return reply(409,{error:{code:'REVISION_CONFLICT',message:'Newer saved version.'}});
   saved={...saved,...fields,title:fields.title.trim(),revision:saved.revision+1};acks.set(key,saved);return reply(200,{data:saved});
  }};
}
const editors:DraftAutosave[]=[];
function editor(options:Partial<ConstructorParameters<typeof DraftAutosave>[0]>={}){
 const api=backend(),storage=new MemoryStorage();
 const instance=new DraftAutosave({project,ownerId:'alice',storage,online:true,notify:()=>{},transport:api.send,debounceMs:60000,...options});editors.push(instance);return {instance,api,storage};
}
afterEach(()=>{for(const instance of editors.splice(0))instance.dispose();});

test('debounces rapid edits and only marks a confirmed snapshot saved',async()=>{
 const {instance,api,storage}=editor({debounceMs:15});instance.change({brief:'One'});instance.change({brief:'Latest'});
 assert.equal(instance.view().status,'pending');assert.equal(api.calls.length,0);assert.equal(storage.length,1);
 await delay(60);assert.equal(api.calls.length,1);assert.equal(api.saved.brief,'Latest');assert.equal(instance.view().status,'saved');assert.equal(storage.length,0);
});
test('serializes saves while retaining edits made during a request',async()=>{
 const api=backend();let release!:()=>void;const gate=new Promise<void>(resolve=>release=resolve);
 const {instance}=editor({transport:async(url,options)=>{if(api.calls.length===0){await gate;}return api.send(url,options);}});
 instance.change({brief:'Snapshot A'});const first=instance.flush();instance.change({brief:'Typed during save'});await instance.flush();
 assert.equal(instance.view().status,'saving');release();await first;
 assert.equal(instance.view().fields.brief,'Typed during save');assert.equal(instance.view().dirty,true);
 await instance.flush();assert.equal(api.calls.length,2);assert.equal(api.saved.revision,3);assert.equal(api.saved.brief,'Typed during save');assert.equal(instance.view().dirty,false);
});
test('reverting text during an in-flight save queues a compensating save',async()=>{
 const api=backend();let release!:()=>void;const gate=new Promise<void>(resolve=>release=resolve);
 const {instance}=editor({transport:async(u,o)=>{await gate;return api.send(u,o);}});
 instance.change({brief:'Temporary'});const flight=instance.flush();instance.change({brief:'Original'});assert.equal(instance.view().dirty,true);release();await flight;
 await instance.flush();assert.equal(api.saved.brief,'Original');assert.equal(api.saved.revision,3);
});
test('ambiguous response retries the same key/body before sending newer edits',async()=>{
 const api=backend();let dropped=false;
 const {instance}=editor({transport:async(u,o)=>{const result=await api.send(u,o);if(!dropped){dropped=true;throw Error('Dropped after commit');}return result;}});
 instance.change({brief:'Committed but unconfirmed'});await instance.flush();assert.equal(instance.view().status,'error');
 instance.change({brief:'Newer local edits'});await instance.flush();assert.deepEqual(api.calls[1],api.calls[0]);assert.equal(instance.view().fields.brief,'Newer local edits');
 await instance.flush();assert.equal(api.saved.revision,3);assert.equal(api.saved.brief,'Newer local edits');
});
test('reopening an uncertain operation replays its original key even after the server advanced',async()=>{
 const api=backend(),storage=new MemoryStorage();
 const {instance:first}=editor({storage,transport:async(u,o)=>{await api.send(u,o);throw Error('Lost');}});
 first.change({brief:'Unconfirmed'});await first.flush();first.change({brief:'Even newer'});first.dispose();
 const {instance:reopened}=editor({storage,project:api.saved,transport:api.send});assert.equal(reopened.view().status,'recovery');
 reopened.restore(reopened.view().recoveries[0].key);await reopened.flush();assert.deepEqual(api.calls[1],api.calls[0]);assert.equal(reopened.view().fields.brief,'Even newer');
 await reopened.flush();assert.equal(api.saved.revision,3);assert.equal(storage.length,0);
});
test('offline edits survive dispose and only sync after explicit restore and reconnect',async()=>{
 const api=backend(),storage=new MemoryStorage();const {instance:first}=editor({online:false,storage,transport:api.send});
 first.change({brief:'Offline idea'});await first.flush();assert.equal(api.calls.length,0);first.dispose();
 const {instance:reopened}=editor({online:false,storage,transport:api.send});await reopened.flush();assert.equal(api.calls.length,0);
 reopened.restore(reopened.view().recoveries[0].key);assert.equal(reopened.view().status,'offline');reopened.connectivity(true);await reopened.flush();
 assert.equal(api.saved.brief,'Offline idea');assert.equal(storage.length,0);
});
test('pending copies are isolated by owner/project and simultaneous editors retain separate copies',()=>{
 const storage=new MemoryStorage(),{instance:a}=editor({storage,online:false}),{instance:b}=editor({storage,online:false});
 a.change({brief:'Tab A'});b.change({brief:'Tab B'});assert.equal(storage.length,2);
 assert.equal(editor({storage,ownerId:'bob'}).instance.view().recoveries.length,0);
 assert.equal(editor({storage,project:{...project,id:'22222222-2222-4222-8222-222222222222'}}).instance.view().recoveries.length,0);
 assert.equal(editor({storage}).instance.view().recoveries.length,2);
});
test('stale recovery stays paused across another reload until explicitly resolved',async()=>{
 const storage=new MemoryStorage(),api=backend(),{instance:first}=editor({storage,online:false});first.change({brief:'Old local edit'});first.dispose();api.advance();
 const {instance:second}=editor({storage,project:api.saved,transport:api.send});second.restore(second.view().recoveries[0].key);assert.equal(second.view().status,'conflict');await second.flush();assert.equal(api.calls.length,0);second.dispose();
 const {instance:third}=editor({storage,project:api.saved,transport:api.send});third.restore(third.view().recoveries[0].key);assert.equal(third.view().status,'conflict');
});
test('conflict comparison keeps both versions and replacing local text requires an explicit choice',async()=>{
 const api=backend(),{instance}=editor({transport:api.send});instance.change({brief:'Mine'});api.advance();await instance.flush();assert.equal(instance.view().status,'conflict');
 await instance.compare();assert.equal(instance.view().remote?.brief,'Saved elsewhere');assert.equal(instance.view().fields.brief,'Mine');
 instance.resolve('remote');assert.equal(instance.view().fields.brief,'Saved elsewhere');assert.equal(instance.view().dirty,false);
});
test('explicit keep-mine uses a fresh revision check and never blindly overwrites a third save',async()=>{
 const api=backend(),{instance}=editor({transport:api.send});instance.change({brief:'Mine'});api.advance();await instance.flush();await instance.compare();api.advance();instance.resolve('local');await turn();
 assert.equal(instance.view().status,'conflict');assert.equal(api.saved.brief,'Saved elsewhere');assert.equal(instance.view().fields.brief,'Mine');
});
test('a successful explicit keep-mine resolution advances from the compared revision',async()=>{
 const api=backend(),{instance}=editor({transport:api.send});instance.change({brief:'Mine'});api.advance();await instance.flush();await instance.compare();instance.resolve('local');await turn();
 assert.equal(api.saved.brief,'Mine');assert.equal(api.saved.revision,3);assert.equal(instance.view().status,'saved');
});
test('storage failure does not prevent server saving and exposes a recovery warning',async()=>{
 const storage=new MemoryStorage();storage.setItem=()=>{throw Error('Quota');};const {instance}=editor({storage});instance.change({brief:'Important'});assert.equal(instance.view().storageWarning,true);await instance.flush();assert.equal(instance.view().status,'saved');
});
test('blank title pauses saves; correcting it resumes without retaining the error',async()=>{
 const {instance,api}=editor();instance.change({title:' '});await instance.flush();assert.equal(instance.view().status,'error');assert.equal(api.calls.length,0);
 instance.change({title:'Corrected'});await instance.flush();assert.equal(instance.view().message,'');assert.equal(instance.view().status,'saved');
});
test('disposed editors keep recovery data and do not publish late responses',async()=>{
 const api=backend(),storage=new MemoryStorage();let release!:()=>void,notifications=0;const gate=new Promise<void>(resolve=>release=resolve);
 const {instance}=editor({storage,notify:()=>notifications++,transport:async(u,o)=>{await gate;return api.send(u,o);}});
 instance.change({brief:'Leaving'});const pending=instance.flush();instance.dispose();const before=notifications;release();await pending;
 assert.equal(notifications,before);assert.equal(storage.length,1);assert.equal(editor({storage,project:api.saved}).instance.view().status,'recovery');
});
test('discard only removes listed unchanged copies and never another owner’s data',()=>{
 const storage=new MemoryStorage(),{instance:first}=editor({storage,online:false});first.change({brief:'Discardable'});
 const {instance:other}=editor({storage,ownerId:'bob',online:false});other.change({brief:'Bob'});
 const {instance:reopened}=editor({storage});reopened.discardRecoveries();assert.equal(storage.length,1);assert.equal(reopened.view().status,'saved');
});
test('network retries stop after four attempts until the user retries again',async(t)=>{
 t.mock.timers.enable({apis:['setTimeout']});let attempts=0;
 const {instance}=editor({transport:async()=>{attempts++;throw Error('Network');}});instance.change({brief:'Retry me'});await instance.flush();
 for(const wait of [1000,2000,4000]){t.mock.timers.tick(wait);await turn();}
 assert.equal(attempts,4);t.mock.timers.tick(60000);await turn();assert.equal(attempts,4);assert.equal(instance.view().dirty,true);
 await instance.flush();assert.equal(attempts,5);
});
test('authentication errors pause automatic retry without marking text saved',async(t)=>{
 t.mock.timers.enable({apis:['setTimeout']});let attempts=0;
 const {instance}=editor({transport:async()=>{attempts++;return reply(401,{error:{code:'SESSION_REQUIRED',message:'Please sign in.'}});}});
 instance.change({brief:'Private edits'});await instance.flush();t.mock.timers.tick(60000);await turn();
 assert.equal(attempts,1);assert.equal(instance.view().status,'error');assert.equal(instance.view().dirty,true);
});
test('a timed-out request retains its uncertain command for idempotent recovery',async(t)=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const {instance,storage}=editor({transport:async(_url,options)=>new Promise((_resolve,reject)=>options?.signal?.addEventListener('abort',()=>reject(Error('Timeout'))))});
 instance.change({brief:'Slow request'});const pending=instance.flush();t.mock.timers.tick(30000);await pending;
 assert.equal(instance.view().status,'error');assert.ok(JSON.parse([...storage.items.values()][0]).operation.key);
});
test('malformed or mismatched backups never hydrate editor fields',()=>{
 const storage=new MemoryStorage(),prefix=`explainova:idea:v1:alice:${project.id}:`;
 storage.setItem(prefix+'bad','{');storage.setItem(prefix+'other',JSON.stringify({schema:1,ownerId:'bob',projectId:project.id,fields:{title:'Injected',brief:'x',referenceText:''},revision:1,operation:null,updatedAt:new Date().toISOString()}));
 const {instance}=editor({storage});assert.equal(instance.view().status,'saved');assert.equal(instance.view().fields.title,'First');
});
test('failed replacement storage leaves the original recovered copy available',()=>{
 const storage=new MemoryStorage(),{instance:first}=editor({storage,online:false});first.change({brief:'Safe source'});first.dispose();
 const sourceKey=storage.key(0)!;storage.setItem=()=>{throw Error('Quota');};
 const {instance:restored}=editor({storage,online:false});restored.restore(sourceKey);assert.ok(storage.getItem(sourceKey));assert.equal(restored.view().storageWarning,true);
});
test('a malformed success acknowledgement cannot mark unpersisted text saved',async()=>{
 const {instance,storage}=editor({transport:async()=>reply(200,{data:project})});instance.change({brief:'Must persist'});await instance.flush();
 assert.equal(instance.view().status,'error');assert.equal(instance.view().dirty,true);assert.equal(instance.view().fields.brief,'Must persist');assert.ok(JSON.parse([...storage.items.values()][0]).operation);
});
test('preference-only edits save with text, and later text changes retain those preferences',async()=>{
 const {instance,api}=editor();instance.change({targetDurationMs:90000,audienceLevel:'advanced',tone:'direct',settings:{voice:'male',captions:true,theme:'topic'}});
 assert.equal(instance.view().dirty,true);await instance.flush();assert.equal(api.saved.settings.voice,'male');assert.equal(api.saved.targetDurationMs,90000);assert.equal(api.saved.brief,'Original');
 instance.change({brief:'New text'});await instance.flush();assert.equal(api.saved.settings.voice,'male');assert.equal(api.saved.audienceLevel,'advanced');assert.equal(instance.view().status,'saved');
});
test('changing preferences during a save retains the newer selection for the next revision',async()=>{
 const api=backend();let release!:()=>void;const gate=new Promise<void>(r=>release=r);
 const {instance}=editor({transport:async(u,o)=>{await gate;return api.send(u,o);}});
 instance.change({targetDurationMs:30000,settings:{voice:'male',captions:true,theme:'topic'}});const first=instance.flush();
 instance.change({targetDurationMs:90000,settings:{voice:'female',captions:true,theme:'topic'}});release();await first;
 assert.equal(instance.view().fields.targetDurationMs,90000);assert.equal(instance.view().fields.settings.voice,'female');assert.equal(instance.view().dirty,true);
 await instance.flush();assert.equal(api.saved.targetDurationMs,90000);assert.equal(api.saved.settings.voice,'female');assert.equal(api.saved.revision,3);
});
test('preference-only pending copies are independently recoverable',async()=>{
 const storage=new MemoryStorage(),api=backend(),{instance:a}=editor({storage,online:false,transport:api.send}),{instance:b}=editor({storage,online:false,transport:api.send});
 a.change({targetDurationMs:30000});b.change({targetDurationMs:90000,settings:{voice:'male',captions:true,theme:'topic'}});a.dispose();b.dispose();
 const {instance:reopened}=editor({storage,transport:api.send});assert.equal(reopened.view().recoveries.length,2);
 const selected=reopened.view().recoveries.find(r=>r.backup.fields.targetDurationMs===90000)!;reopened.restore(selected.key);await reopened.flush();assert.equal(api.saved.targetDurationMs,90000);assert.equal(api.saved.settings.voice,'male');assert.equal(storage.length,1);
});
test('preference conflicts expose the saved selection before explicit resolution',async()=>{
 const api=backend(),{instance}=editor({transport:api.send});instance.change({settings:{voice:'male',captions:true,theme:'topic'}});api.advance();await instance.flush();await instance.compare();
 assert.equal(instance.view().remote?.settings.voice,'female');assert.equal(instance.view().fields.settings.voice,'male');instance.resolve('remote');assert.equal(instance.view().fields.settings.voice,'female');assert.equal(instance.view().dirty,false);
});
test('legacy text-only recovery inherits saved preferences and identifies that limitation',async()=>{
 const storage=new MemoryStorage(),saved={...project,targetDurationMs:90000,settings:{voice:'male' as const,captions:true as const,theme:'topic' as const}};
 storage.setItem(`explainova:idea:v1:alice:${project.id}:old`,JSON.stringify({schema:1,ownerId:'alice',projectId:project.id,revision:1,fields:{title:'First',brief:'Legacy text',referenceText:''},operation:null,updatedAt:new Date().toISOString()}));
 const api=backend(),{instance}=editor({project:saved,storage,transport:api.send});const recovery=instance.view().recoveries[0];assert.equal(recovery.backup.legacyTextOnly,true);instance.restore(recovery.key);
 assert.equal(instance.view().fields.settings.voice,'male');await instance.flush();assert.equal(api.saved.brief,'Legacy text');assert.equal(api.saved.targetDurationMs,90000);
});
test('legacy uncertain requests retain their exact body across migration and another reopening',async()=>{
 const api=backend(),storage=new MemoryStorage(),key='legacy-operation-key-0001',fields={title:'First',brief:'Legacy committed',referenceText:''},body=JSON.stringify({expectedRevision:1,...fields});
 await api.send('/unused',{method:'PATCH',headers:{'Idempotency-Key':key},body});
 storage.setItem(`explainova:idea:v1:alice:${project.id}:old`,JSON.stringify({schema:1,ownerId:'alice',projectId:project.id,revision:1,fields:{...fields,brief:'Newer local text'},operation:{key,revision:1,fields},updatedAt:new Date().toISOString()}));
 const {instance:first}=editor({project:api.saved,storage,online:false,transport:api.send});first.restore(first.view().recoveries[0].key);first.change({targetDurationMs:30000,settings:{voice:'male',captions:true,theme:'topic'}});first.dispose();
 const {instance:second}=editor({project:api.saved,storage,transport:api.send});second.restore(second.view().recoveries[0].key);await second.flush();assert.deepEqual(api.calls[1],api.calls[0]);assert.equal(second.view().fields.settings.voice,'male');assert.equal(second.view().fields.brief,'Newer local text');
 await second.flush();assert.equal(api.saved.revision,3);assert.equal(api.saved.targetDurationMs,30000);assert.equal(storage.length,0);
});
test('recovery rejects unsupported preference values and view snapshots do not expose mutable settings',()=>{
 const storage=new MemoryStorage();storage.setItem(`explainova:idea:v1:alice:${project.id}:bad`,JSON.stringify({schema:2,ownerId:'alice',projectId:project.id,revision:1,fields:{...project,settings:{voice:'paid-id',captions:true,theme:'topic'}},operation:null,updatedAt:new Date().toISOString()}));
 const {instance}=editor({storage});assert.equal(instance.view().recoveries.length,0);const view=instance.view();view.fields.settings.voice='male';assert.equal(instance.view().fields.settings.voice,'female');assert.equal(instance.view().dirty,false);
});
