import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {localAuthHarness} from './local-form-support.mjs';
import {DraftAutosave} from '../src/lib/draft-autosave.ts';
import {makeProjectCursor} from '../src/lib/project-contract.ts';
const {admin,request,browserSession}=localAuthHarness(),users=[],controllers=[];let passed=0;
const check=(value,message)=>{assert.ok(value,message);passed++;};
async function call(path,jar,method='GET',body,key=randomUUID(),headers={}){
 const response=await request(path,jar,{method,...(method==='GET'?{}:{body:JSON.stringify(body),headers:{'Content-Type':'application/json','Idempotency-Key':key,...headers}})});
 check(response.headers.get('cache-control')?.includes('no-store'),'private lifecycle response not cached');
 return {response,json:await response.json()};
}
const root='/api/v1/projects';
try{
 for(let n=0;n<2;n++){const email=`trash-qa-${randomUUID()}@example.test`,password=randomUUID()+'aA1!';const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true});assert.ifError(error);const user={id:data.user.id,jar:null};users.push(user);user.jar=await browserSession(email,password);}
 const [alice,bob]=users;
 check((await call(root+'?view=trash',new Map())).response.status===401,'anonymous Trash denied');
 for(const query of ['?view=all','?view=trash&view=drafts','?view=trash&limit=51','?view=trash&owner_id='+alice.id])check((await call(root+query,alice.jar)).response.status===400,'invalid Trash query rejected');
 const source=(await call(root,alice.jar,'POST',{title:'Lifecycle test',brief:'Original idea marker',referenceText:'Private original notes marker'})).json.data,path=`${root}/${source.id}`;
 check((await call(path,bob.jar,'DELETE',{expectedRevision:1})).response.status===404,'foreign delete concealed');
 check((await call(path,new Map(),'DELETE',{expectedRevision:1})).response.status===401,'anonymous delete denied');
 for(const [body,key,headers,status] of [[{expectedRevision:1},randomUUID(),{Origin:'https://other.test'},403],[{expectedRevision:1},'',{},400],[{expectedRevision:'1'},randomUUID(),{},422],[{expectedRevision:1,deletedAt:null},randomUUID(),{},422],[{expectedRevision:2147483647},randomUUID(),{},422]])check((await call(path,alice.jar,'DELETE',body,key,headers)).response.status===status,'invalid delete rejected');
 const local=new Map(),storage={get length(){return local.size;},key:i=>[...local.keys()][i]??null,getItem:k=>local.get(k)??null,setItem:(k,v)=>local.set(k,v),removeItem:k=>local.delete(k)};
 const pending=new DraftAutosave({project:source,ownerId:alice.id,storage,online:false,notify:()=>{},transport:(url,options)=>request(url,alice.jar,options)});controllers.push(pending);pending.change({referenceText:'Unsynced old tab notes'});pending.dispose();
 const deleteKey=randomUUID(),deletions=await Promise.all([1,2,3,4].map(()=>call(path,alice.jar,'DELETE',{expectedRevision:1},deleteKey)));
 check(deletions.every(r=>r.response.status===202&&r.json.data.revision===2&&r.json.data.status==='trashed'),'parallel same-key deletes advance exactly one revision');
 check((await call(path,alice.jar)).response.status===404,'trashed detail hidden');
 check((await request('/projects/'+source.id,alice.jar)).status===404,'trashed editor unavailable');
 check((await call(path,alice.jar,'PATCH',{expectedRevision:1,brief:'Stale save'})).response.status===404,'autosave cannot edit Trash');
 check((await call(path+'/duplicate',alice.jar,'POST',{expectedRevision:2})).response.status===404,'Trash cannot be copied');
 check((await call(root,alice.jar)).json.data.length===0,'active list omits Trash');
 const trash=(await call(root+'?view=trash',alice.jar)).json.data;
 check(trash.length===1&&trash[0].id===source.id&&trash[0].revision===2&&!!trash[0].deletedAt,'owned Trash summary available');
 check(Object.keys(trash[0]).sort().join(',')==='deletedAt,id,revision,title,updatedAt','Trash response limited to summary');
 check((await call(root+'?view=trash',bob.jar)).json.data.length===0,'foreign Trash invisible');
 const html=await (await request('/projects/trash',alice.jar)).text();check(html.includes('Lifecycle test')&&html.includes('Restore draft')&&!html.includes('Private original notes marker'),'Trash UI contains own summary without creative body');
 check((await call(path+'/restore',bob.jar,'POST',{expectedRevision:2})).response.status===404,'foreign restore concealed');
 check((await call(path+'/restore',new Map(),'POST',{expectedRevision:2})).response.status===401,'anonymous restore denied');
 check((await call(path+'/restore',alice.jar,'POST',{expectedRevision:2},randomUUID(),{Origin:'https://other.test'})).response.status===403,'restore origin checked');
 check((await request(path+'/restore',alice.jar)).status===405,'GET never restores');
 const staleRestore=await call(path+'/restore',alice.jar,'POST',{expectedRevision:1});check(staleRestore.response.status===409&&staleRestore.json.error.details.currentRevision===2,'stale restore receives current revision');
 const restoreKey=randomUUID(),restorations=await Promise.all([1,2,3,4].map(()=>call(path+'/restore',alice.jar,'POST',{expectedRevision:2},restoreKey))),restored=restorations[0].json.data;
 check(restorations.every(r=>r.response.status===200&&r.json.data.revision===3),'parallel restore replay advances one revision');
 check(restored.brief===source.brief&&restored.referenceText===source.referenceText&&JSON.stringify(restored.settings)===JSON.stringify(source.settings),'restored content preserved');
 check((await call(root+'?view=trash',alice.jar)).json.data.length===0,'restored draft leaves Trash');
 check((await call(path,alice.jar,'PATCH',{expectedRevision:1,referenceText:'Old overwrite'})).response.status===409,'pre-delete autosave fenced after restore');
 check((await call(path,alice.jar,'DELETE',{expectedRevision:1})).response.status===409,'pre-restore delete fenced');
 check((await call(path,alice.jar,'DELETE',{expectedRevision:1},deleteKey)).json.data.revision===2,'delete replay returns original acknowledgement');
 check((await call(path,alice.jar)).json.data.revision===3,'old delete replay leaves restored project active');
 check((await call(path,alice.jar,'DELETE',{expectedRevision:3},deleteKey)).response.status===409,'key body mismatch rejected');
 const recovery=new DraftAutosave({project:restored,ownerId:alice.id,storage,online:true,notify:()=>{},transport:(url,options)=>request(url,alice.jar,options)});controllers.push(recovery);
 recovery.restore(recovery.view().recoveries[0].key);check(recovery.view().status==='conflict'&&recovery.view().fields.referenceText==='Unsynced old tab notes','old local edits offered without silently overwriting restored state');await recovery.compare();recovery.resolve('remote');check(local.size===0&&recovery.view().status==='saved','explicitly choosing restored server copy clears local fixture');
 const {data:history,error}=await admin.from('project_revisions').select('revision,brief,reference_text,content_hash').eq('project_id',source.id).order('revision');assert.ifError(error);
 check(history.length===3&&new Set(history.map(row=>row.content_hash)).size===1&&history.every(row=>row.reference_text===source.referenceText),'history and creative hash preserved through lifecycle');
 await call(path,alice.jar,'DELETE',{expectedRevision:3});
 check((await call(path+'/restore',alice.jar,'POST',{expectedRevision:2},restoreKey)).json.data.revision===3,'old restore replay returns original acknowledgement');
 check((await call(path,alice.jar)).response.status===404,'old restore replay leaves newly trashed draft trashed');
 check((await call(path+'/restore',alice.jar,'POST',{expectedRevision:2})).response.status===409,'fresh stale restore rejected');
 await call(path+'/restore',alice.jar,'POST',{expectedRevision:4});
 for(let n=0;n<3;n++){const p=(await call(root,alice.jar,'POST',{title:`Trash page ${n}`})).json.data;await call(`${root}/${p.id}`,alice.jar,'DELETE',{expectedRevision:1});}
 const first=await call(root+'?view=trash&limit=2',alice.jar),second=await call(root+'?view=trash&limit=2&cursor='+first.json.meta.nextCursor,alice.jar);
 check(first.json.data.length===2&&second.json.data.length===1&&new Set([...first.json.data,...second.json.data].map(p=>p.id)).size===3,'Trash keyset paging covers owned rows without overlap');
 check((await call(root+'?cursor='+first.json.meta.nextCursor,alice.jar)).response.status===400,'Trash cursor rejected in active list');
 check((await call(root+'?view=trash&cursor='+makeProjectCursor(source),alice.jar)).response.status===400,'active cursor rejected in Trash');
 check((await call(root+'?view=trash&cursor='+first.json.meta.nextCursor,bob.jar)).json.data.length===0,'cursor never changes owner scope');
 const race=(await call(root,alice.jar,'POST',{title:'Lifecycle race'})).json.data,racePath=`${root}/${race.id}`;
 const outcomes=await Promise.all([call(racePath,alice.jar,'PATCH',{expectedRevision:1,brief:'Concurrent save'}),call(racePath,alice.jar,'DELETE',{expectedRevision:1})]);
 check((outcomes[0].response.status===200&&outcomes[1].response.status===409)||(outcomes[0].response.status===404&&outcomes[1].response.status===202),'save/delete race cannot delete a newer revision');
 const final=await admin.from('projects').select('edit_version').eq('id',race.id).single();assert.ifError(final.error);check(final.data.edit_version===2,'race commits exactly one state change');
 assert.ifError((await admin.from('profiles').update({deletion_status:'pending'}).eq('owner_id',alice.id)).error);
 check((await call(root+'?view=trash',alice.jar)).response.status===403,'inactive Trash access denied');
 check((await call(path,alice.jar,'DELETE',{expectedRevision:5})).response.status===403,'inactive deletion denied');
 check((await call(path+'/restore',alice.jar,'POST',{expectedRevision:5})).response.status===403,'inactive restore denied');
 console.log(`Passed ${passed} local Trash/restore assertions.`);
}finally{
 for(const controller of controllers)controller.dispose();
 for(const user of users){assert.ifError((await admin.from('projects').delete().eq('owner_id',user.id)).error);assert.ifError((await admin.from('profiles').delete().eq('owner_id',user.id)).error);assert.ifError((await admin.auth.admin.deleteUser(user.id)).error);}
}
