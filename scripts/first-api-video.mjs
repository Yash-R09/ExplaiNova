import fs from 'node:fs/promises';
import path from 'node:path';
import {out,plan,render,readJSON,writeJSON} from '../pipeline.mjs';
const dir=path.join(out,'api-first'),boardPath=path.join(dir,'storyboard.json');
try {
 if(process.argv[3])process.env.GEMINI_MODEL=process.argv[3];
 if(process.argv[2]==='plan'){
   const catalog=await readJSON(path.join(dir,'voices.json'));
   const voice=catalog.voices.find(v=>v.category==='premade'&&v.labels?.gender==='female'&&v.name.startsWith('Alice'));
   if(!voice)throw Error('Expected account-listed premade Alice voice unavailable; choose another supported free voice explicitly.');
   const board=await plan('How does water return to the sky? Explain the water cycle, including invisible vapor, condensation into cloud droplets, precipitation, and collection. Sunlight supplies energy and gravity brings water downward.',45,'female',{waterCycle:true});
   board.speechProvider='elevenlabs';board.voiceConfig={voiceId:voice.voice_id,name:voice.name,category:voice.category,modelId:'eleven_flash_v2_5'};
   await writeJSON(boardPath,board);console.log(JSON.stringify(board,null,2));
 }else if(process.argv[2]==='render'){
   const board=await readJSON(boardPath);console.log('Rendering Gemini storyboard with ElevenLabs:',board.voiceConfig.name);
   console.log(await render('api-first',board,console.log));
 }else throw Error('Use plan or render.');
}catch(e){console.error(e.message);process.exitCode=1;}
