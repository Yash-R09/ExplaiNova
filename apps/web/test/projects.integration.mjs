// Disposable local users only; credentials/tokens remain in memory.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {localAuthHarness} from './local-form-support.mjs';
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
 const page=await request(`/projects/${draft.id}`,alice.jar);check(page.status===200&&(await page.text()).includes('Save draft'),'server editor loads owned draft');
 check((await request(`/projects/${draft.id}`,bob.jar)).status===404,'foreign editor concealed');
 const before=(await admin.from('projects').select('id',{count:'exact',head:true}).eq('owner_id',alice.id)).count;
 await request('/create',alice.jar);await request('/projects',alice.jar);
 check((await admin.from('projects').select('id',{count:'exact',head:true}).eq('owner_id',alice.id)).count===before,'GET navigation does not create projects');
 assert.ifError((await admin.from('profiles').update({deletion_status:'pending'}).eq('owner_id',alice.id)).error);
 check((await call(path,alice.jar,'POST',{})).response.status===403,'inactive owner cannot write');
 console.log(`Passed ${passed} local project integration assertions.`);
}finally{
 for(const user of users){assert.ifError((await admin.from('projects').delete().eq('owner_id',user.id)).error);assert.ifError((await admin.from('profiles').delete().eq('owner_id',user.id)).error);assert.ifError((await admin.auth.admin.deleteUser(user.id)).error);}
}
