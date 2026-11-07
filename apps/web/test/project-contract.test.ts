import test from 'node:test';
import assert from 'node:assert/strict';
import {projectInput,commandKey,parseProjectCursor,makeProjectCursor,duplicateProjectInput,lifecycleProjectInput,type IdeaProject} from '../src/lib/project-contract.ts';
test('lifecycle commands require a revision with room for a transition',()=>{
 assert.deepEqual(lifecycleProjectInput({expectedRevision:2147483646}),{expectedRevision:2147483646});
 for(const value of [{},{expectedRevision:'1'},{expectedRevision:0},{expectedRevision:1.5},{expectedRevision:2147483647},{expectedRevision:1,ownerId:'other'},{expectedRevision:1,deletedAt:null},null,[]])assert.throws(()=>lifecycleProjectInput(value));
});
test('active and Trash cursor fingerprints cannot be mixed',()=>{
 const project={id:'11111111-1111-4111-8111-111111111111',updatedAt:'2026-11-07T10:20:30.123456Z'};
 const trash=makeProjectCursor(project,'trash');assert.equal(parseProjectCursor(trash,'trash')?.filter,'trash-v1');assert.throws(()=>parseProjectCursor(trash));
 assert.throws(()=>parseProjectCursor(makeProjectCursor(project),'trash'));
});
test('duplicate commands require only an exact saved revision',()=>{
 assert.deepEqual(duplicateProjectInput({expectedRevision:1}),{expectedRevision:1});
 assert.equal(duplicateProjectInput({expectedRevision:2147483647}).expectedRevision,2147483647);
 for(const value of [{},{expectedRevision:'1'},{expectedRevision:0},{expectedRevision:1.5},{expectedRevision:2147483648},{expectedRevision:1,title:'x'},{expectedRevision:1,ownerId:'other'},null,[]])assert.throws(()=>duplicateProjectInput(value));
});
test('draft input defaults and explicit changes preserve content without accepting ownership',()=>{
 assert.equal(projectInput({}).targetDurationMs,60000);
 assert.deepEqual(projectInput({title:'  Why rain? ',brief:'  A thought\n',expectedRevision:2},true),{title:'Why rain?',brief:'  A thought\n',expectedRevision:2});
 for(const input of [{owner_id:'someone'},{settings:{voice:'other'}},{title:' '},{brief:'a'.repeat(6001)},{referenceText:'a'.repeat(20001)},{targetDurationMs:'60000'},{targetDurationMs:45000},{tone:'unknown'},null,[]])assert.throws(()=>projectInput(input));
 assert.equal(projectInput({brief:'a'.repeat(6000),referenceText:'a'.repeat(20000)}).brief.length,6000);
});
test('updates require a bounded integer revision and a change',()=>{
 for(const input of [{title:'x'},{expectedRevision:1},{expectedRevision:'1',title:'x'},{expectedRevision:0,title:'x'},{expectedRevision:2147483647,title:'x'}])assert.throws(()=>projectInput(input,true));
 assert.equal(projectInput({expectedRevision:1,brief:''},true).brief,'');
});
test('request keys reject malformed and unbounded input',()=>{
 assert.equal(commandKey('a'.repeat(16)),'a'.repeat(16));
 for(const value of [null,'short','a'.repeat(129),'a'.repeat(16)+'\n','é'.repeat(16)])assert.throws(()=>commandKey(value));
});
test('library cursors retain database microseconds and reject foreign shapes or invalid dates',()=>{
 const project={id:'11111111-1111-4111-8111-111111111111',updatedAt:'2026-11-07T10:20:30.123456+00:00'} as IdeaProject;
 const cursor=parseProjectCursor(makeProjectCursor(project));assert.equal(cursor?.updatedAt,project.updatedAt);assert.equal(cursor?.id,project.id);
 const encode=(value:unknown)=>Buffer.from(JSON.stringify(value)).toString('base64url');
 for(const value of ['', '!',encode(null),encode({...cursor,owner:'other'}),encode({...cursor,filter:'other'}),encode({...cursor,updatedAt:'2026-02-31T10:20:30Z'}),encode({...cursor,id:'bad'})])assert.throws(()=>parseProjectCursor(value));
});
