import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sample,validate,captions,timedCaptions,toSrt,hash} from '../lib.mjs';
test('validation rejects unsupported voice and scene types',()=>{assert.throws(()=>validate({...sample,voice:'unknown'}));assert.throws(()=>validate({...sample,scenes:[{...sample.scenes[0],type:'code'},sample.scenes[1]]}));assert.equal(validate(sample).scenes.length,5);});
test('captions cover narration without overlapping adjacent chunks',()=>{const c=captions('One two three four five six seven eight nine',8);assert.equal(c.length,2);assert.equal(c[0].end,c[1].start);assert.equal(c[1].end,8);assert.match(toSrt(c),/00:00:00,000 -->/);});
test('voice revision invalidates content hash',()=>{assert.notEqual(hash(sample),hash({...sample,voice:'male'}));});
test('speech timestamp validation rejects drift outside narration and preserves real boundaries',()=>{assert.throws(()=>timedCaptions([{text:'late',start:3}],2));assert.throws(()=>timedCaptions([{text:'a',start:1},{text:'b',start:0}],2));const words=Array.from({length:8},(_,i)=>({text:String(i),start:i*.25}));const c=timedCaptions(words,2);assert.equal(c[0].end,1.5);assert.equal(c[1].end,2);});
