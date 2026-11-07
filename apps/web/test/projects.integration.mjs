// Disposable local users only; credentials/tokens remain in memory.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {localAuthHarness} from './local-form-support.mjs';
import {DraftAutosave} from '../src/lib/draft-autosave.ts';
const {admin,request,browserSession,base}=localAuthHarness();
const users=[];let passed=0;
const check=(condition,message)=>{assert.ok(condition,message);passed++;};
async function call(path,jar,method='GET',body,key=randomUUID(),extra={}){
 const response=await request(path,jar,{method,...(method==='GET'?{}:{body:typeof body==='string'?body:JSON.stringify(body),headers:{'Content-Type':'application/json','Idempotency-Key':key,...extra}})});
 check(response.headers.get('cache-control')?.includes('no-store'),'private API must not cache');
 return {response,json:await response.json()};
}
try{
 for(let n=0;n<2;n++){
  const email=`draft-qa-${randomUUID()}@example.test`,password=randomUUID()+'aA1!';
  const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true});assert.ifError(error);users.push({id:data.user.id,jar:await browserSession(email,password)});
 }
 const [alice,bob]=users,path='/api/v1/projects';
 check((await call(path,new Map())).response.status===401,'anonymous denied');
 for(const [body,key,extra,status]of [[{},randomUUID(),{Origin:'https://other.test'},403],[{},'',{},400],['{',randomUUID(),{},400],[{owner_id:bob.id},randomUUID(),{},422],[{targetDurationMs:45000},randomUUID(),{},422],[' '.repeat(65537),randomUUID(),{},413]]){const result=await call(path,alice.jar,'POST',body,key,extra);check(result.response.status===status,`invalid write: expected ${status}, received ${result.response.status} (${result.json.error?.code})`);}
 const key=randomUUID(),created=await call(path,alice.jar,'POST',{title:'Why do magnets attract?',brief:'Explain magnetism.'},key),draft=created.json.data;
 check(created.response.status===201&&draft.revision===1,'create acknowledged');check(created.response.headers.get('location')===`${path}/${draft.id}`,'location points to owned draft');
 check((await call(path,alice.jar,'POST',{title:'Why do magnets attract?',brief:'Explain magnetism.'},key)).json.data.id===draft.id,'create retry returns original');
 check((await call(path,alice.jar,'POST',{title:'different'},key)).response.status===409,'changed idempotent body rejected');
 check((await call(`${path}/${draft.id}`,bob.jar)).response.status===404,'foreign read concealed');
 check((await call(`${path}/${draft.id}`,bob.jar,'PATCH',{expectedRevision:1,title:'stolen'})).response.status===404,'foreign write concealed');
 check((await call(path,bob.jar)).json.data.length===0,'foreign list empty');
 const update={expectedRevision:1,title:'Magnetism explained',brief:'A different explanation.',referenceText:'Source notes'},saveKey=randomUUID();
 const saved=await call(`${path}/${draft.id}`,alice.jar,'PATCH',update,saveKey);
 check(saved.json.data.revision===2&&saved.json.data.referenceText==='Source notes','save returns persisted revision');
 check((await call(`${path}/${draft.id}`,alice.jar,'PATCH',update,saveKey)).json.data.revision===2,'save retry precedes stale check');
 const stale=await call(`${path}/${draft.id}`,alice.jar,'PATCH',{expectedRevision:1,title:'old tab'});
 check(stale.response.status===409&&stale.json.error.details.currentRevision===2,'stale tab receives revision conflict');
 const race=await Promise.all(['first','second'].map(title=>call(`${path}/${draft.id}`,alice.jar,'PATCH',{expectedRevision:2,title})));
 check(race.map(r=>r.response.status).sort().join(',')==='200,409','concurrent writes accept exactly one revision');
 const {data:history,error}=await admin.from('project_revisions').select('revision,title,brief').eq('project_id',draft.id).order('revision');assert.ifError(error);
 check(history.length===3&&history[0].title==='Why do magnets attract?'&&history[0].brief==='Explain magnetism.','prior snapshots retained');
 const parallelKey=randomUUID(),parallel=await Promise.all([1,2,3,4].map(()=>call(path,alice.jar,'POST',{title:'One logical draft'},parallelKey)));
 check(new Set(parallel.map(r=>r.json.data.id)).size===1&&parallel.every(r=>r.response.status===201),'parallel retries create one project');
 check((await call(path,bob.jar,'POST',{title:'One logical draft'},parallelKey)).json.data.id!==parallel[0].json.data.id,'idempotency scoped per owner');
 await call(path,alice.jar,'POST',{title:'Pagination fixture'});
 const first=await call(path+'?limit=2',alice.jar),second=await call(path+'?limit=2&cursor='+first.json.meta.nextCursor,alice.jar);
 check(first.json.meta.hasMore&&first.json.data.length===2&&second.json.data.length===1,'keyset pages cover full library');
 check(new Set([...first.json.data,...second.json.data].map(p=>p.id)).size===3,'pages do not repeat drafts');
 for(const query of ['?limit=51','?cursor=bad','?owner_id='+bob.id,'?limit=1&limit=2'])check((await call(path+query,alice.jar)).response.status===400,'invalid list query rejected');
 const reopened=await call(`${path}/${draft.id}`,alice.jar);check(reopened.json.data.revision===3,'reopening returns current revision');
 const page=await request(`/projects/${draft.id}`,alice.jar);check(page.status===200&&(await page.text()).includes('Save now'),'server editor loads owned draft');
 check((await request(`/projects/${draft.id}`,bob.jar)).status===404,'foreign editor concealed');
 const before=(await admin.from('projects').select('id',{count:'exact',head:true}).eq('owner_id',alice.id)).count;
 await request('/create',alice.jar);await request('/projects',alice.jar);
 check((await admin.from('projects').select('id',{count:'exact',head:true}).eq('owner_id',alice.id)).count===before,'GET navigation does not create projects');
 // Exercise the actual browser save controller against the real API, including
 // a response consumed after a successful commit and replayed on retry.
 const pending=new Map(),storage={get length(){return pending.size;},key:i=>[...pending.keys()][i]??null,getItem:key=>pending.get(key)??null,setItem:(key,value)=>pending.set(key,value),removeItem:key=>pending.delete(key)};
 const controllers=[];let drop=true;
 try{
  const autosave=new DraftAutosave({project:reopened.json.data,ownerId:alice.id,storage,online:true,notify:()=>{},debounceMs:60000,transport:async(url,options)=>{
   const response=await request(url,alice.jar,options);
   if(drop&&options?.method==='PATCH'){drop=false;check(response.status===200,'ambiguous save really committed');await response.json();throw Error('Simulated lost response');}return response;
  }});controllers.push(autosave);
  autosave.change({brief:'Autosaved first snapshot'});await autosave.flush();check(autosave.view().status==='error','dropped response remains unconfirmed');
  autosave.change({brief:'New edits after uncertain save'});await autosave.flush();await autosave.flush();
  check(autosave.view().status==='saved'&&autosave.view().revision===5,'idempotent retry plus queued edits produce exactly two revisions');
  const latest=(await call(`${path}/${draft.id}`,alice.jar)).json.data;check(latest.brief==='New edits after uncertain save','newest controller text persists in PostgreSQL');
  autosave.connectivity(false);autosave.change({referenceText:'Offline recovery notes'});autosave.dispose();
  const restored=new DraftAutosave({project:latest,ownerId:alice.id,storage,online:true,notify:()=>{},debounceMs:60000,transport:(url,options)=>request(url,alice.jar,options)});controllers.push(restored);
  check(restored.view().status==='recovery','reopening offers persisted pending copy');restored.restore(restored.view().recoveries[0].key);await restored.flush();
  check(restored.view().status==='saved'&&restored.view().revision===6&&pending.size===0,'explicit recovery saves one revision and clears local copies');
  check((await call(`${path}/${draft.id}`,alice.jar)).json.data.referenceText==='Offline recovery notes','recovered notes persist on server');
 }finally{for(const controller of controllers)controller.dispose();}
 const source=(await call(`${path}/${draft.id}`,alice.jar)).json.data,duplicatePath=`${path}/${draft.id}/duplicate`;
 check((await call(duplicatePath,new Map(),'POST',{expectedRevision:6})).response.status===401,'anonymous duplication denied');
 check((await call(duplicatePath,bob.jar,'POST',{expectedRevision:6})).response.status===404,'foreign duplication concealed');
 for(const [body,key,headers,status] of [[{expectedRevision:6},randomUUID(),{Origin:'https://other.test'},403],[{expectedRevision:6},'',{},400],[{expectedRevision:'6'},randomUUID(),{},422],[{expectedRevision:6,ownerId:bob.id},randomUUID(),{},422]])check((await call(duplicatePath,alice.jar,'POST',body,key,headers)).response.status===status,'invalid duplicate request rejected');
 check((await request(duplicatePath,alice.jar)).status===405,'GET cannot duplicate');
 const duplicateKey=randomUUID(),copies=await Promise.all([1,2,3,4].map(()=>call(duplicatePath,alice.jar,'POST',{expectedRevision:6},duplicateKey))),copy=copies[0].json.data;
 check(copies.every(r=>r.response.status===201)&&new Set(copies.map(r=>r.json.data.id)).size===1,'parallel duplicate retries create one copy');
 check(copy.id!==draft.id&&copy.revision===1&&copy.title==='Copy of '+source.title,'copy has separate identity and fresh revision');
 check(copies[0].response.headers.get('location')===`${path}/${copy.id}`,'copy location is owned resource');
 for(const field of ['brief','referenceText','targetDurationMs','audienceLevel','tone'])check(copy[field]===source[field],`copy retains ${field}`);
 check(JSON.stringify(copy.settings)===JSON.stringify(source.settings),'copy retains settings snapshot');
 check((await call(`${path}/${draft.id}`,alice.jar)).json.data.revision===6,'duplication does not edit source');
 const {data:copyHistory,error:historyError}=await admin.from('project_revisions').select('revision').eq('project_id',copy.id);assert.ifError(historyError);check(copyHistory.length===1,'source revision history not duplicated');
 check((await call(duplicatePath,alice.jar,'POST',{expectedRevision:7},duplicateKey)).response.status===409,'changed body cannot reuse duplicate key');
 await call(`${path}/${copy.id}`,alice.jar,'PATCH',{expectedRevision:1,referenceText:'Copy-only notes'});
 check((await call(`${path}/${draft.id}`,alice.jar)).json.data.referenceText==='Offline recovery notes','copy edits independent of source');
 await call(`${path}/${draft.id}`,alice.jar,'PATCH',{expectedRevision:6,brief:'Changed source',targetDurationMs:90000});
 check((await call(`${path}/${copy.id}`,alice.jar)).json.data.brief===source.brief,'source edits independent of copy');
 const replay=await call(duplicatePath,alice.jar,'POST',{expectedRevision:6},duplicateKey);check(replay.json.data.id===copy.id&&replay.json.data.revision===1,'retry after source/copy edits returns original copy acknowledgement');
 check((await call(duplicatePath,alice.jar,'POST',{expectedRevision:6})).response.status===409,'stale source revision rejected');
 const two=await Promise.all([1,2].map(()=>call(duplicatePath,alice.jar,'POST',{expectedRevision:7})));
 check(new Set(two.map(r=>r.json.data.id)).size===2&&two.every(r=>r.json.data.targetDurationMs===90000),'distinct commands create independent current-input copies');
 const sourceAndCopy=await Promise.all([call(`${path}/${draft.id}`,alice.jar,'PATCH',{expectedRevision:7,brief:'Concurrent source change'}),call(duplicatePath,alice.jar,'POST',{expectedRevision:7})]);
 check(sourceAndCopy[0].response.status===200&&[201,409].includes(sourceAndCopy[1].response.status),'save/copy race is serialized around source revision');
 if(sourceAndCopy[1].response.status===201)check(sourceAndCopy[1].json.data.brief==='Changed source','racing copy represents exact approved input revision');
 const copiedPage=await request(`/projects/${copy.id}`,alice.jar);check(copiedPage.status===200&&(await copiedPage.text()).includes('Copy of '),'copied draft opens editor');
 assert.ifError((await admin.from('profiles').update({deletion_status:'pending'}).eq('owner_id',alice.id)).error);
 check((await call(duplicatePath,alice.jar,'POST',{expectedRevision:8})).response.status===403,'inactive owner cannot duplicate');
 check((await call(path,alice.jar,'POST',{})).response.status===403,'inactive owner cannot write');
 console.log(`Passed ${passed} local project integration assertions.`);
}finally{
 for(const user of users){assert.ifError((await admin.from('projects').delete().eq('owner_id',user.id)).error);assert.ifError((await admin.from('profiles').delete().eq('owner_id',user.id)).error);assert.ifError((await admin.auth.admin.deleteUser(user.id)).error);}
}
