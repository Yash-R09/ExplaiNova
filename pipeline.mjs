import fs from 'node:fs/promises';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {bundle} from '@remotion/bundler';
import {selectComposition, renderMedia, renderStill} from '@remotion/renderer';
import {sample,validate,hash,timedCaptions,toSrt} from './lib.mjs';
import {narrateEleven} from './elevenlabs.mjs';
const exec = promisify(execFile);
export const root = path.dirname(fileURLToPath(import.meta.url));
export const out = path.join(root,'outputs');
const chrome = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
export async function writeJSON(file,data) { await fs.mkdir(path.dirname(file),{recursive:true}); await fs.writeFile(file+'.tmp',JSON.stringify(data,null,2)); await fs.rename(file+'.tmp',file); }
export async function readJSON(file) { return JSON.parse(await fs.readFile(file,'utf8')); }
export async function plan(idea,duration,voice,options={}) {
  if (!process.env.GEMINI_API_KEY) throw Error('No Gemini API key configured. Load the offline sample, or add GEMINI_API_KEY to .env and restart.');
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{
    method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':process.env.GEMINI_API_KEY},signal:AbortSignal.timeout(90000),
    body:JSON.stringify({contents:[{parts:[{text:`Create an accurate original English educational explainer for general adult beginners about: ${idea}. Target ${duration} seconds, approximately ${Math.round(duration*2.1)} words total. Return JSON only: {title:string,scenes:[{title:string,type:"diagram"|"process"|"comparison",narration:string,labels:string[]}]}. Use 4–6 scenes and 2–3 labels per scene. Short readable titles under 60 characters. Explain one coherent concept. Labels must describe the actual topic and stay under 30 characters. Do not invent numerical facts or sources. ${options.waterCycle?'This topic is the water cycle. Exactly five custom scene types are available: cycle (overview), evaporation (sun warming water and vapor rising), condensation (cloud droplets), rain (falling droplets), collection (water returning to rivers/oceans). Use these five types in that order instead of generic diagram/process/comparison. Keep total narration to 95–115 words for a 45–55 second finished video. Use a clear opening question and a memorable closing insight.':'Never use water-cycle scene types for unrelated topics. Scene visuals in this prototype are simple animated label diagrams, not custom generated illustrations.'} ${options.instructions||''}` }]}],generationConfig:{responseMimeType:'application/json'}})
  });
  if(!response.ok) {let message='Check model access, key, quota, and network.';try{const data=await response.json();message=String(data.error?.message||message).replaceAll(process.env.GEMINI_API_KEY,'[redacted]');}catch{}throw Error(`Gemini request failed (${response.status}) for ${model}: ${message}`);}
  const result=await response.json();
  const text=result.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('');
  return validate({...JSON.parse(text),duration:Number(duration),voice,source:`Gemini ${model}; creator factual review required`});
}
function wavDuration(buffer) {
  if(buffer.toString('ascii',0,4)!=='RIFF') throw Error('Invalid narration WAV.');
  let rate,bytes;
  for(let at=12;at+8<=buffer.length;) { const id=buffer.toString('ascii',at,at+4),size=buffer.readUInt32LE(at+4); if(id==='fmt ') rate=buffer.readUInt32LE(at+16); if(id==='data') bytes=size; at+=8+size+(size%2); }
  if(!rate||!bytes) throw Error('Missing WAV data.');
  return bytes/rate;
}
export async function render(id,board,progress=()=>{}) {
  board=validate(board);
  const dir=path.join(out,id); await fs.mkdir(dir,{recursive:true});
  const version=hash(board).slice(0,16), vdir=path.join(dir,version);
  await fs.mkdir(vdir,{recursive:true});
  const statusFile=path.join(dir,'status.json');
  const update=async(stage,extra={})=>{await writeJSON(statusFile,{id,stage,version,updatedAt:new Date().toISOString(),...extra});progress(stage);};
  try {
    await writeJSON(path.join(vdir,'storyboard.json'),board);
    const scenes=[];let total=0;const allCaptions=[];
    for(let i=0;i<board.scenes.length;i++) {
      await update(`Narrating scene ${i+1}/${board.scenes.length}`);
      const scene=board.scenes[i];
      const provider=board.speechProvider||'windows';
      const audioHash=hash({narration:scene.narration,voice:board.voice,provider:provider==='elevenlabs'?'elevenlabs-pcm16k-v1':'windows-speech-v3-pcm16k',config:board.voiceConfig});
      const cache=path.join(out,'audio-cache',audioHash);await fs.mkdir(cache,{recursive:true});
      const wav=path.join(cache,'speech.wav'), input=path.join(cache,'text.txt');
      await fs.writeFile(input,scene.narration,'utf8');
      let seconds;
      try { seconds=wavDuration(await fs.readFile(wav));await readJSON(wav+'.json'); } catch {
        if(provider==='elevenlabs')await narrateEleven(scene.narration,board.voiceConfig,wav);
        else await exec('powershell.exe',['-NoProfile','-File',path.join(root,'scripts','speech.ps1'),'-InputPath',input,'-OutputPath',wav,'-Gender',board.voice],{timeout:60000,windowsHide:true});
        seconds=wavDuration(await fs.readFile(wav));
      }
      const assetDir=path.join(root,'public','generated',id,version);await fs.mkdir(assetDir,{recursive:true});
      await fs.copyFile(wav,path.join(assetDir,`${i}.wav`));
      const duration=Math.ceil((seconds+0.45)*30)/30;
      const cc=timedCaptions(await readJSON(wav+'.json'),seconds);
      for(const c of cc) allCaptions.push({...c,start:c.start+total,end:c.end+total});
      scenes.push({...scene,audio:`generated/${id}/${version}/${i}.wav`,seconds:duration,captions:cc,startFrame:Math.round(total*30),durationInFrames:Math.round(duration*30)});
      total+=duration;
      await writeJSON(path.join(vdir,'checkpoint.json'),{completedAudioScenes:i+1,version});
    }
    if(total<30||total>90) throw Error(`Narration is ${total.toFixed(1)} seconds; revise narration to fit 30–90 seconds. Previous outputs remain available.`);
    const props={...board,scenes,totalFrames:Math.round(total*30)};
    await writeJSON(path.join(vdir,'composition.json'),props);
    await fs.writeFile(path.join(vdir,'captions.srt'),toSrt(allCaptions));
    await update('Bundling animation');
    const serveUrl=await bundle({entryPoint:path.join(root,'video','index.jsx'),publicDir:path.join(root,'public')});
    const composition=await selectComposition({serveUrl,id:'Explainer',inputProps:props,browserExecutable:chrome,chromeMode:'chrome-for-testing'});
    await update('Rendering video');
    let last=-1;
    await renderMedia({composition,serveUrl,codec:'h264',outputLocation:path.join(vdir,'video.mp4'),inputProps:props,browserExecutable:chrome,chromeMode:'chrome-for-testing',concurrency:2,crf:21,onProgress:({progress:p})=>{const percent=Math.floor(p*100/10)*10;if(percent!==last){last=percent;progress(`Rendering ${percent}%`);}}});
    await renderStill({composition,serveUrl,output:path.join(vdir,'preview.png'),inputProps:props,browserExecutable:chrome,chromeMode:'chrome-for-testing',frame:80});
    await update('ready',{seconds:total,video:`/outputs/${id}/${version}/video.mp4`,captions:`/outputs/${id}/${version}/captions.srt`,preview:`/outputs/${id}/${version}/preview.png`,captionTiming:board.speechProvider==='elevenlabs'?'ElevenLabs character alignment grouped into captions; scene-driven animation.':'Windows speech word-event timestamps; animations are scene-driven, not yet phrase-aligned.'});
    return await readJSON(statusFile);
  } catch(e) { await update('failed',{error:e.message});throw e; }
}
if(process.argv[1]===fileURLToPath(import.meta.url) && process.argv[2]==='sample') {
  try { await writeJSON(path.join(out,'sample','storyboard.json'),sample);console.log(await render('sample',sample,console.log)); } catch(e) {console.error(e.message);process.exitCode=1;}
}
