import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {sample} from '../lib.mjs';
test('local HTTP workflow persists storyboard and rejects foreign origins and invalid input',async()=>{
 const child=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:'4311'},stdio:['ignore','pipe','pipe']});
 try{
  await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject);child.once('exit',code=>reject(Error('Server exited '+code)));setTimeout(()=>reject(Error('Server startup timeout')),8000).unref();});
  const base='http://127.0.0.1:4311';
  const post=(route,data,origin=base)=>fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(data)});
  assert.equal((await fetch(base)).status,200);
  assert.equal((await post('/api/save',{board:sample},'https://untrusted.example')).status,403);
  assert.equal((await post('/api/save',{board:{...sample,voice:'invalid'}})).status,400);
  const r=await post('/api/save',{board:sample});assert.equal(r.status,200);const {id}=await r.json();
  const project=await (await fetch(base+'/api/project/'+id)).json();assert.equal(project.board.title,sample.title);
  assert.equal((await post('/api/render',{id,approved:false})).status,400);
 }finally{child.kill();}
});
