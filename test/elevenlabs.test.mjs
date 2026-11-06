import {test} from 'node:test';
import assert from 'node:assert/strict';
import {alignmentWords,pcmWav} from '../elevenlabs.mjs';
test('character alignment keeps word punctuation and speech timestamps',()=>{
 const chars=Array.from('Hello, world.');const words=alignmentWords({characters:chars,character_start_times_seconds:chars.map((_,i)=>i*.1)});
 assert.deepEqual(words.map(w=>w.text),['Hello,','world.']);assert.ok(Math.abs(words[1].start-.7)<1e-10);
});
test('PCM wrapper declares mono 16 kHz audio with correct length',()=>{
 const wav=pcmWav(Buffer.alloc(32000));assert.equal(wav.toString('ascii',0,4),'RIFF');assert.equal(wav.readUInt32LE(24),16000);assert.equal(wav.readUInt32LE(40),32000);assert.equal(wav.length,32044);
});
