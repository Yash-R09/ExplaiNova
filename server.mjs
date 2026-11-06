import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {root,out,readJSON,writeJSON,plan,render} from './pipeline.mjs';
import {sample,validate} from './lib.mjs';
const running=new Set();
const send=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};
const idOk=id=>/^[a-zA-Z0-9-]{1,60}$/.test(id);
async function body(req) {let text='';for await(const b of req){text+=b;if(text.length>64000)throw Error('Request too large.');}return JSON.parse(text||'{}');}
const server=http.createServer(async(req,res)=>{
 try {
  // Local-only, no CORS; reject cross-origin mutations and DNS rebinding.
  const host=req.headers.host;if(!/^127\.0\.0\.1:\d+$/.test(host||'')){res.writeHead(403);res.end();return;}
  if(req.method!=='GET'&&req.headers.origin!==`http://${host}`){send(res,403,{error:'Local origin required.'});return;}
  const url=new URL(req.url,`http://${host}`),route=url.pathname;
  if(route==='/api/config'){send(res,200,{gemini:!!process.env.GEMINI_API_KEY,speech:'Windows local voices',captionTiming:'Windows speech word-event timestamps'});return;}
  if(route==='/api/sample'){send(res,200,sample);return;}
  if(route==='/api/plan'&&req.method==='POST'){const b=await body(req);if(typeof b.idea!=='string'||b.idea.length>6000||![30,60,90].includes(Number(b.duration))||!['male','female'].includes(b.voice))throw Error('Check idea, duration, and voice.');send(res,200,await plan(b.idea,b.duration,b.voice));return;}
  if(route==='/api/save'&&req.method==='POST'){const b=await body(req),board=validate(b.board);const id=b.id||randomUUID();if(!idOk(id))throw Error('Invalid project ID.');if(running.has(id))throw Error('Wait for the current render before editing this project.');await writeJSON(path.join(out,id,'storyboard.json'),board);send(res,200,{id});return;}
  if(route==='/api/render'&&req.method==='POST'){const b=await body(req);if(!idOk(b.id))throw Error('Invalid project ID.');if(running.size){send(res,409,{error:'One local render at a time. Wait for the running job.'});return;}const board=validate(await readJSON(path.join(out,b.id,'storyboard.json')));if(b.approved!==true)throw Error('Storyboard approval required.');running.add(b.id);await writeJSON(path.join(out,b.id,'status.json'),{id:b.id,stage:'queued'});send(res,202,{id:b.id});render(b.id,board,console.log).catch(e=>console.error(e.message)).finally(()=>running.delete(b.id));return;}
  if(route.startsWith('/api/project/')){const id=route.split('/').pop();if(!idOk(id))throw Error('Invalid project ID.');const board=await readJSON(path.join(out,id,'storyboard.json'));let status={stage:'draft'};try{status=await readJSON(path.join(out,id,'status.json'));}catch{}if(!running.has(id)&&!['draft','ready','failed'].includes(status.stage))status={...status,stage:'interrupted',error:'Local runner stopped. Approve and render again to resume cached narration.'};send(res,200,{id,board,status});return;}
  let file;
  if(route==='/')file=path.join(root,'web','index.html');
  else if(route.startsWith('/outputs/')){const parts=route.slice(9).split('/');if(parts.some(p=>!p||p==='.'||p==='..'||!/^[-a-zA-Z0-9_.]+$/.test(p)))throw Error('Invalid asset path.');if(!['.mp4','.srt','.png'].includes(path.extname(route)))throw Error('Asset not available.');file=path.join(out,...parts);}
  else {res.writeHead(404);res.end();return;}
  const bytes=await fs.readFile(file);res.writeHead(200,{'Content-Type':({'.html':'text/html; charset=utf-8','.mp4':'video/mp4','.srt':'application/x-subrip','.png':'image/png'})[path.extname(file)],'Cache-Control':'no-store'});res.end(bytes);
 }catch(e){send(res,400,{error:e.code==='ENOENT'?'Project or file not found.':e.message});}
});
server.listen(Number(process.env.PORT||4310),'127.0.0.1',()=>console.log(`Explainova local: http://127.0.0.1:${process.env.PORT||4310}`));
