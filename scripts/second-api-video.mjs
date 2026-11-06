import path from 'node:path';
import {out,plan,render,readJSON,writeJSON} from '../pipeline.mjs';
const id='api-headphones',dir=path.join(out,id),file=path.join(dir,'storyboard.json');
try{
 process.env.GEMINI_MODEL='gemini-3.1-flash-lite';
 if(process.argv[2]==='plan'){
  const voice=(await readJSON(path.join(out,'api-first','voices.json'))).voices.find(v=>v.category==='premade'&&v.name.startsWith('Alice')&&v.labels?.gender==='female');
  if(!voice)throw Error('Previously tested free-access premade Alice voice unavailable.');
  const board=await plan('How active noise-cancelling headphones reduce unwanted sound. Explain with sound waves, microphones, inverse waveforms, destructive interference near the ear, and limits. General adult beginners, clear and accurate.',45,'female',{instructions:'Exactly FIVE scenes in this order: 1 opening question about quiet headphones; 2 microphones detect outside noise; 3 electronics produce an opposing waveform through the speakers; 4 pressure waves overlap at the ear, reducing unwanted sound; 5 works best for steady low-frequency noise, not perfect silence. Use diagram/process/comparison scene types. Total narration 95–115 words, 18–23 per scene, natural conversational English. Do not claim ambient noise stops existing, every frequency cancels perfectly, microphones remove sound, or all headphones use the same microphone layout. No advertising. Scene titles under 38 characters. Avoid talking about music being cancelled. Labels should be short; no tabs will be displayed.'});
  board.theme='audio';board.showTabs=false;board.speechProvider='elevenlabs';board.voiceConfig={voiceId:voice.voice_id,name:voice.name,category:'premade',modelId:'eleven_flash_v2_5'};
  await writeJSON(file,board);console.log(JSON.stringify(board,null,2));
 }else if(process.argv[2]==='render'){console.log(await render(id,await readJSON(file),console.log));}
 else throw Error('Use plan or render.');
}catch(e){console.error(e.message);process.exitCode=1;}
