import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {root,out,readJSON,writeJSON,withProjectLock,plan,render} from './pipeline.mjs';
import {sample,validate,hash} from './lib.mjs';
const send=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};
const idOk=id=>/^[a-zA-Z0-9-]{1,60}$/.test(id);
async function body(req) {let text='';for await(const b of req){text+=b;if(text.length>64000)throw Error('Request too large.');}return JSON.parse(text||'{}');}
export function createLocalServer({outputDir=out,renderVideo=render}={}) {
 const running=new Set();
 const projectPath=id=>path.join(outputDir,id);
 async function projectStatus(id,board) {
  let status={stage:'draft'};
  try{status=await readJSON(path.join(projectPath(id),'status.json'));}catch(e){if(e.code!=='ENOENT')throw e;}
  const currentVersion=hash(board).slice(0,16);
  if(status.stage==='ready'&&status.version!==currentVersion) {
   const {video,captions,preview,...previous}=status;
   return {...previous,stage:'stale',currentVersion,renderedVersion:status.version||null,error:'The storyboard has changed since this video was rendered. Review and render again; previous outputs remain on disk.'};
  }
  if(!running.has(id)&&!['draft','ready','failed'].includes(status.stage))return {...status,stage:'interrupted',error:'Local runner stopped. Approve and render again to resume cached narration.'};
  return status;
 }
 return http.createServer(async(req,res)=>{
 try {
  // Local-only, no CORS; reject cross-origin mutations and DNS rebinding.
  const host=req.headers.host;if(!/^127\.0\.0\.1:\d+$/.test(host||'')){res.writeHead(403);res.end();return;}
  if(req.method!=='GET'&&req.headers.origin!==`http://${host}`){send(res,403,{error:'Local origin required.'});return;}
  const url=new URL(req.url,`http://${host}`),route=url.pathname;
  if(route==='/api/config'){send(res,200,{gemini:!!process.env.GEMINI_API_KEY,speech:'Windows local voices',captionTiming:'Windows speech word-event timestamps'});return;}
  if(route==='/api/sample'){send(res,200,sample);return;}
  if(route==='/api/plan'&&req.method==='POST'){const b=await body(req);if(typeof b.idea!=='string'||b.idea.length>6000||![30,60,90].includes(Number(b.duration))||!['male','female'].includes(b.voice))throw Error('Check idea, duration, and voice.');send(res,200,await plan(b.idea,b.duration,b.voice));return;}
  if(route==='/api/save'&&req.method==='POST'){
   const b=await body(req),board=validate(b.board),id=b.id||randomUUID();
   if(!idOk(id))throw Error('Invalid project ID.');
   const result=await withProjectLock(projectPath(id),async()=>{
    if(running.has(id))return {blocked:true};
    await writeJSON(path.join(projectPath(id),'storyboard.json'),board);
    return {id,status:await projectStatus(id,board)};
   });
   send(res,result.blocked?409:200,result.blocked?{error:'Wait for the current render before editing this project.'}:result);return;
  }
  if(route==='/api/render'&&req.method==='POST'){
   const b=await body(req);if(!idOk(b.id))throw Error('Invalid project ID.');
   if(b.approved!==true)throw Error('Storyboard approval required.');
   const board=await withProjectLock(projectPath(b.id),async()=>{
    const saved=validate(await readJSON(path.join(projectPath(b.id),'storyboard.json')));
    // Check after reading: admission across different projects must be atomic too.
    if(running.size)return null;
    running.add(b.id);
    try{await writeJSON(path.join(projectPath(b.id),'status.json'),{id:b.id,stage:'queued',version:hash(saved).slice(0,16)});}
    catch(e){running.delete(b.id);throw e;}
    return saved;
   });
   if(!board){send(res,409,{error:'One local render at a time. Wait for the running job.'});return;}
   send(res,202,{id:b.id});
   Promise.resolve().then(()=>renderVideo(b.id,board,console.log)).catch(e=>console.error(e.message)).finally(()=>withProjectLock(projectPath(b.id),()=>running.delete(b.id)));return;
  }
  if(route.startsWith('/api/project/')){
   const id=route.split('/').pop();if(!idOk(id))throw Error('Invalid project ID.');
   const project=await withProjectLock(projectPath(id),async()=>{const board=await readJSON(path.join(projectPath(id),'storyboard.json'));return {id,board,status:await projectStatus(id,board)};});
   send(res,200,project);return;
  }
  let file;
  if(route==='/')file=path.join(root,'web','index.html');
  else if(route.startsWith('/outputs/')){const parts=route.slice(9).split('/');if(parts.some(p=>!p||p==='.'||p==='..'||!/^[-a-zA-Z0-9_.]+$/.test(p)))throw Error('Invalid asset path.');if(!['.mp4','.srt','.png'].includes(path.extname(route)))throw Error('Asset not available.');file=path.join(outputDir,...parts);}
  else {res.writeHead(404);res.end();return;}
  const bytes=await fs.readFile(file);res.writeHead(200,{'Content-Type':({'.html':'text/html; charset=utf-8','.mp4':'video/mp4','.srt':'application/x-subrip','.png':'image/png'})[path.extname(file)],'Cache-Control':'no-store'});res.end(bytes);
 }catch(e){send(res,400,{error:e.code==='ENOENT'?'Project or file not found.':e.message});}
 });
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===path.resolve(process.argv[1])){
 const server=createLocalServer();
 server.listen(Number(process.env.PORT||4310),'127.0.0.1',()=>console.log(`Explainova local: http://127.0.0.1:${process.env.PORT||4310}`));
}
