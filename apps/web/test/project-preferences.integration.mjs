import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {localAuthHarness} from './local-form-support.mjs';
import {DraftAutosave} from '../src/lib/draft-autosave.ts';
const {admin,request,browserSession}=localAuthHarness(),users=[],controllers=[];let passed=0;
const check=(condition,message)=>{assert.ok(condition,message);passed++;};
async function call(path,jar,method='GET',body,key=randomUUID()){
 const response=await request(path,jar,{method,...(method==='GET'?{}:{body:JSON.stringify(body),headers:{'Content-Type':'application/json','Idempotency-Key':key}})});
 check(response.headers.get('cache-control')?.includes('no-store'),'preference responses are private');return {response,json:await response.json()};
}
function memory(){const map=new Map();return {get length(){return map.size;},key:i=>[...map.keys()][i]??null,getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};}
try{
 for(let n=0;n<2;n++){const email=`prefs-qa-${randomUUID()}@example.test`,password=randomUUID()+'aA1!';const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true});assert.ifError(error);const user={id:data.user.id,jar:null};users.push(user);user.jar=await browserSession(email,password);}
 const [alice,bob]=users,root='/api/v1/projects';
 const source=(await call(root,alice.jar,'POST',{title:'Preferences test',brief:'An idea',targetDurationMs:30000,audienceLevel:'advanced',tone:'conversational',settings:{voice:'male'}})).json.data,path=`${root}/${source.id}`;
 check(source.settings.voice==='male'&&source.settings.captions===true&&source.settings.theme==='topic','create saves preference and mandatory defaults');
 for(const settings of [{voice:'paid-id'},{voiceId:'provider-id'},{captions:false},{captions:'true'},{theme:'other'},null])check((await call(path,alice.jar,'PATCH',{expectedRevision:1,settings})).response.status===422,'unsupported settings rejected');
 check((await call(path,bob.jar,'PATCH',{expectedRevision:1,settings:{voice:'female'}})).response.status===404,'foreign preference edit denied');
 const storage=memory();let drop=true;
 const editor=new DraftAutosave({project:source,ownerId:alice.id,storage,online:true,notify:()=>{},debounceMs:60000,transport:async(u,o)=>{const response=await request(u,alice.jar,o);if(drop&&o?.method==='PATCH'){drop=false;check(response.status===200,'dropped preference save committed');await response.json();throw Error('Dropped response');}return response;}});controllers.push(editor);
 editor.change({targetDurationMs:90000,tone:'direct',settings:{voice:'female',captions:true,theme:'topic'}});await editor.flush();check(editor.view().status==='error','unconfirmed preference snapshot stays pending');
 editor.change({targetDurationMs:60000,settings:{voice:'male',captions:true,theme:'topic'}});await editor.flush();await editor.flush();
 check(editor.view().status==='saved'&&editor.view().revision===3,'uncertain replay and newer preferences create exactly two revisions');
 let saved=(await call(path,alice.jar)).json.data;check(saved.targetDurationMs===60000&&saved.settings.voice==='male'&&saved.tone==='direct'&&saved.audienceLevel==='advanced','new preferences persisted');
 const text=await call(path,alice.jar,'PATCH',{expectedRevision:3,referenceText:'Text-only update'});check(text.json.data.settings.voice==='male'&&text.json.data.targetDurationMs===60000,'partial text save preserves preferences');
 const partial=await call(path,alice.jar,'PATCH',{expectedRevision:4,settings:{voice:'female'}});check(partial.json.data.settings.captions===true&&partial.json.data.targetDurationMs===60000,'partial nested settings merge with saved inputs');
 saved=partial.json.data;
 const offlineStorage=memory(),offline=new DraftAutosave({project:saved,ownerId:alice.id,storage:offlineStorage,online:false,notify:()=>{},transport:(u,o)=>request(u,alice.jar,o)});controllers.push(offline);offline.change({targetDurationMs:90000,audienceLevel:'intermediate',settings:{voice:'male',captions:true,theme:'topic'}});offline.dispose();
 const recovered=new DraftAutosave({project:saved,ownerId:alice.id,storage:offlineStorage,online:true,notify:()=>{},debounceMs:60000,transport:(u,o)=>request(u,alice.jar,o)});controllers.push(recovered);
 check(recovered.view().recoveries[0].backup.fields.targetDurationMs===90000&&recovered.view().recoveries[0].backup.fields.settings.voice==='male','pending preferences visible before restore');recovered.restore(recovered.view().recoveries[0].key);await recovered.flush();
 check(recovered.view().revision===6&&recovered.view().status==='saved'&&offlineStorage.length===0,'offline preference recovery saves one revision');
 const copy=(await call(path+'/duplicate',alice.jar,'POST',{expectedRevision:6})).json.data;check(copy.settings.voice==='male'&&copy.targetDurationMs===90000&&copy.audienceLevel==='intermediate','duplicate retains current preferences');
 await call(path,alice.jar,'DELETE',{expectedRevision:6});const restored=(await call(path+'/restore',alice.jar,'POST',{expectedRevision:7})).json.data;check(restored.settings.voice==='male'&&restored.targetDurationMs===90000,'Trash/restore retain preferences');
 check((await call(path,alice.jar,'PATCH',{expectedRevision:6,settings:{voice:'female'}})).response.status===409,'stale preference updates cannot overwrite restored draft');
 // Compatibility with a text-only operation created by the previous editor.
 const legacy=(await call(root,alice.jar,'POST',{title:'Legacy draft'})).json.data,legacyPath=`${root}/${legacy.id}`,key=randomUUID(),fields={title:legacy.title,brief:'Old committed text',referenceText:''},legacyBody={expectedRevision:1,...fields};
 const acknowledged=(await call(legacyPath,alice.jar,'PATCH',legacyBody,key)).json.data,legacyStorage=memory();
 legacyStorage.setItem(`explainova:idea:v1:${alice.id}:${legacy.id}:old`,JSON.stringify({schema:1,ownerId:alice.id,projectId:legacy.id,revision:1,fields:{...fields,brief:'New local text'},operation:{key,revision:1,fields},updatedAt:new Date().toISOString()}));
 const replayed=[];const upgraded=new DraftAutosave({project:acknowledged,ownerId:alice.id,storage:legacyStorage,online:true,notify:()=>{},debounceMs:60000,transport:(u,o)=>{if(o?.method==='PATCH')replayed.push(JSON.parse(o.body));return request(u,alice.jar,o);}});controllers.push(upgraded);
 upgraded.restore(upgraded.view().recoveries[0].key);upgraded.change({targetDurationMs:30000,settings:{voice:'male',captions:true,theme:'topic'}});await upgraded.flush();
 check(JSON.stringify(replayed[0])===JSON.stringify(legacyBody),'upgrade replays exact old text-only request body');check(upgraded.view().fields.settings.voice==='male','old acknowledgement retains newer local preference');await upgraded.flush();
 check(upgraded.view().revision===3&&upgraded.view().status==='saved'&&legacyStorage.length===0,'legacy replay then new preferences create only one additional revision');
 const final=(await call(legacyPath,alice.jar)).json.data;check(final.settings.voice==='male'&&final.targetDurationMs===30000&&final.brief==='New local text','upgraded edits persist in actual database');
 const {data:history,error}=await admin.from('project_revisions').select('revision,settings').eq('project_id',source.id).order('revision');assert.ifError(error);check(history[0].settings.voice==='male'&&history[1].settings.voice==='female'&&history[2].settings.voice==='male','prior preference snapshots retained');
 console.log(`Passed ${passed} local preference assertions.`);
}finally{for(const controller of controllers)controller.dispose();for(const user of users){assert.ifError((await admin.from('projects').delete().eq('owner_id',user.id)).error);assert.ifError((await admin.from('profiles').delete().eq('owner_id',user.id)).error);assert.ifError((await admin.auth.admin.deleteUser(user.id)).error);}}
