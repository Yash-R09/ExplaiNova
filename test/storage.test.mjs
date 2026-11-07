import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {writeJSON,readJSON} from '../pipeline.mjs';

test('overlapping atomic writes preserve invocation order and leave no shared temporary files',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'explainova-writes-'));
 try{
  const file=path.join(dir,'storyboard.json'),pending=[];
  for(let revision=0;revision<64;revision++){
   const data={revision,payload:'x'.repeat(4096)};
   pending.push(writeJSON(file,data));data.revision=-1;
  }
  const reads=(async()=>{for(let i=0;i<64;i++){try{assert.ok(Number.isInteger((await readJSON(file)).revision));}catch(e){if(e.code!=='ENOENT')throw e;}}})();
  await Promise.all([...pending,reads]);
  assert.equal((await readJSON(file)).revision,63);
  assert.deepEqual(await fs.readdir(dir),['storyboard.json']);
 }finally{assert.equal(path.dirname(dir),os.tmpdir());await fs.rm(dir,{recursive:true,force:true});}
});

test('a failed atomic write is cleaned up and does not poison subsequent saves',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'explainova-recovery-'));
 try{
  const file=path.join(dir,'storyboard.json');await fs.mkdir(file);
  await assert.rejects(writeJSON(file,{revision:1}));
  assert.deepEqual(await fs.readdir(dir),['storyboard.json']);
  await fs.rmdir(file);await writeJSON(file,{revision:2});
  assert.equal((await readJSON(file)).revision,2);
 }finally{assert.equal(path.dirname(dir),os.tmpdir());await fs.rm(dir,{recursive:true,force:true});}
});
