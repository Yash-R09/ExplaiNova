import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {once} from 'node:events';
import {sample,hash} from '../lib.mjs';
import {writeJSON,readJSON} from '../pipeline.mjs';
import {createLocalServer} from '../server.mjs';
async function withServer(run,renderVideo=()=>{throw Error('Unexpected render in test');}){
 const outputDir=await fs.mkdtemp(path.join(os.tmpdir(),'explainova-http-'));
 const server=createLocalServer({outputDir,renderVideo:(...args)=>renderVideo(outputDir,...args)});
 server.listen(0,'127.0.0.1');await once(server,'listening');
 const base=`http://127.0.0.1:${server.address().port}`;
 const post=(route,data,origin=base)=>fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(data)});
 const get=id=>fetch(`${base}/api/project/${id}`).then(r=>r.json());
 try{await run({post,get,outputDir,base});}
 finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));assert.equal(path.dirname(outputDir),os.tmpdir());await fs.rm(outputDir,{recursive:true,force:true});}
}

test('local HTTP workflow persists storyboard and rejects foreign origins and invalid input',()=>withServer(async({post,get,base})=>{
  assert.equal((await fetch(base)).status,200);
  assert.equal((await post('/api/save',{board:sample},'https://untrusted.example')).status,403);
  assert.equal((await post('/api/save',{board:{...sample,voice:'invalid'}})).status,400);
  const r=await post('/api/save',{board:sample});assert.equal(r.status,200);const {id}=await r.json();
  const project=await get(id);assert.equal(project.board.title,sample.title);
  assert.equal((await post('/api/render',{id,approved:false})).status,400);
}));

test('concurrent project saves succeed and an acknowledged latest revision survives reload',()=>withServer(async({post,get,outputDir})=>{
 const {id}=await (await post('/api/save',{board:sample})).json();
 const responses=await Promise.all(Array.from({length:8},(_,i)=>post('/api/save',{id,board:{...sample,title:`Concurrent ${i}`}})));
 assert.ok(responses.every(r=>r.status===200));
 await post('/api/save',{id,board:{...sample,title:'Final acknowledged revision'}});
 assert.equal((await get(id)).board.title,'Final acknowledged revision');
 assert.deepEqual(await fs.readdir(path.join(outputDir,id)),['storyboard.json']);
}));

test('render freshness follows storyboard content and new drafts cannot inherit old outputs',()=>withServer(async({post,get,outputDir})=>{
 const {id}=await (await post('/api/save',{board:sample})).json();
 const version=hash(sample).slice(0,16),status={id,stage:'ready',version,video:`/outputs/${id}/${version}/video.mp4`,captions:`/outputs/${id}/${version}/captions.srt`,preview:`/outputs/${id}/${version}/preview.png`};
 await writeJSON(path.join(outputDir,id,'status.json'),status);
 assert.equal((await get(id)).status.stage,'ready');
 const changed=structuredClone(sample);changed.scenes[0].narration+=' A changed explanation.';
 const result=await (await post('/api/save',{id,board:changed})).json();
 assert.equal(result.status.stage,'stale');assert.equal(result.status.renderedVersion,version);
 assert.equal(result.status.currentVersion,hash(changed).slice(0,16));
 const stale=await get(id);assert.equal(stale.board.scenes[0].narration,changed.scenes[0].narration);
 assert.equal(stale.status.stage,'stale');
 for(const field of ['video','captions','preview'])assert.equal(stale.status[field],undefined);
 assert.equal((await readJSON(path.join(outputDir,id,'status.json'))).video,status.video,'Original render history is preserved');
 await post('/api/save',{id,board:sample});assert.equal((await get(id)).status.stage,'ready','Restoring exact rendered content restores freshness');
 await post('/api/save',{id,board:{...sample,voice:'male'}});assert.equal((await get(id)).status.stage,'stale');
 const draft=await (await post('/api/save',{board:sample})).json();assert.notEqual(draft.id,id);assert.equal(draft.status.stage,'draft');assert.equal(draft.status.video,undefined);
}));

test('render admission locks saves and competing render starts without live providers',async()=>{
 let entered,release,finished;
 const started=new Promise(resolve=>{entered=resolve;}),held=new Promise(resolve=>{release=resolve;}),done=new Promise(resolve=>{finished=resolve;});
 await withServer(async({post,get})=>{
  const {id}=await (await post('/api/save',{board:sample})).json();
  const other=await (await post('/api/save',{board:sample})).json();
  const rendering=await post('/api/render',{id,approved:true});assert.equal(rendering.status,202);await started;
  try{
   assert.equal((await get(id)).status.stage,'queued');
   assert.equal((await post('/api/save',{id,board:{...sample,title:'Must not replace render input'}})).status,409);
   assert.equal((await post('/api/render',{id:other.id,approved:true})).status,409);
   assert.equal((await get(id)).board.title,sample.title);
  }finally{release();await done;}
 },async(outputDir,id,board)=>{
  entered();await held;
  await writeJSON(path.join(outputDir,id,'status.json'),{stage:'failed',error:'Test renderer completed without media',version:hash(board).slice(0,16)});finished();
 });
});

test('polling through a fast render completion never labels the job interrupted',async()=>{
 let completed;
 await withServer(async({post,get})=>{
 const {id}=await (await post('/api/save',{board:sample})).json();
 for(let attempt=0;attempt<8;attempt++){
  const done=new Promise(resolve=>{completed=resolve;});
  assert.equal((await post('/api/render',{id,approved:true})).status,202);
  const polls=await Promise.all(Array.from({length:8},()=>get(id)));
  assert.ok(polls.every(p=>['queued','ready'].includes(p.status.stage)));
  await done;
  assert.equal((await get(id)).status.stage,'ready');
 }
},async(outputDir,id,board)=>{
 await writeJSON(path.join(outputDir,id,'status.json'),{stage:'ready',version:hash(board).slice(0,16),video:'/outputs/test/video.mp4',captions:'/outputs/test/captions.srt'});
 completed();
 });
});
