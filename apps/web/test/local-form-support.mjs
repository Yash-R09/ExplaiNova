// Local-only integration support. Session keys and mail tokens stay in memory.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {createClient} from '@supabase/supabase-js';
import {createServerClient} from '@supabase/ssr';

export function localAuthHarness(){
 const root=fileURLToPath(new URL('../../../',import.meta.url));
 const status=JSON.parse(execFileSync(process.execPath,[root+'node_modules/supabase/dist/supabase.js','status','--output','json'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}));
 const base=process.env.AUTH_TEST_APP_URL||'http://127.0.0.1:3000';
 for(const url of [base,status.API_URL,status.MAILPIT_URL])assert.equal(new URL(url).hostname,'127.0.0.1');
 const admin=createClient(status.API_URL,status.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const decode=value=>value.replace(/&quot;/g,'"').replace(/&#x27;|&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
 const publicClient=()=>createClient(status.API_URL,status.PUBLISHABLE_KEY||status.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 function keep(jar,response){
  for(const cookie of response.headers.getSetCookie()){
   const first=cookie.split(';')[0],at=first.indexOf('='),name=first.slice(0,at),value=first.slice(at+1),path=cookie.match(/;\s*Path=([^;]+)/i)?.[1]||'/';
   if(/;\s*Max-Age=0(?:;|$)/i.test(cookie))jar.delete(name);else jar.set(name,{value,path});
  }
 }
 async function request(route,jar=new Map(),options={}){
  const url=new URL(route,base),cookie=[...jar].filter(([,item])=>url.pathname.startsWith(item.path)).map(([name,item])=>`${name}=${item.value}`).join('; ');
  const response=await fetch(url,{...options,headers:{Cookie:cookie,Origin:base,...options.headers},redirect:'manual'});keep(jar,response);return response;
 }
 async function submit(route,jar,fields={},origin=base){
  const html=await (await request(route,jar)).text(),form=html.match(/<form\b[^>]*>([\s\S]*?)<\/form>/)?.[1];assert.ok(form,'Expected application form');
  const data=new FormData();
  for(const input of form.match(/<input\b[^>]*>/g)||[]){
   if(!/type="hidden"/.test(input))continue;
   const name=input.match(/name="([^"]*)"/)?.[1],value=input.match(/value="([^"]*)"/)?.[1]||'';if(name)data.set(decode(name),decode(value));
  }
  assert.ok([...data.keys()].some(key=>key.startsWith('$ACTION_')));
  for(const [key,value]of Object.entries(fields))data.set(key,value);
  return request(route,jar,{method:'POST',body:data,headers:{Origin:origin}});
 }
 async function mailLink(email,path,excluding){
  const deadline=Date.now()+10000;
  while(Date.now()<deadline){
   const list=await (await fetch(status.MAILPIT_URL+'/api/v1/messages')).json();
   for(const message of list.messages||[]){
    if(message.ID===excluding||!message.To?.some(to=>to.Address===email))continue;
    const mail=await (await fetch(status.MAILPIT_URL+'/api/v1/message/'+message.ID)).json();
    const href=(mail.HTML?.match(/href="([^"]*)"/g)||[]).map(tag=>decode(tag.slice(6,-1))).find(value=>new URL(value,base).pathname===path);
    if(href)return {id:message.ID,url:href};
   }
   await delay(100);
  }
  throw Error('Expected local recovery email did not arrive.');
 }
 async function browserSession(email,password){
  const jar=new Map();
  const client=createServerClient(status.API_URL,status.PUBLISHABLE_KEY||status.ANON_KEY,{cookies:{getAll:()=>[...jar].map(([name,item])=>({name,value:item.value})),setAll:values=>values.forEach(({name,value})=>jar.set(name,{value,path:'/'}))}});
  assert.ifError((await client.auth.signInWithPassword({email,password})).error);return jar;
 }
 return {base,status,admin,publicClient,request,submit,mailLink,browserSession};
}
