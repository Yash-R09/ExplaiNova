// Real local app forms + Supabase + Mailpit. Never print confirmation secrets.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {createClient} from '@supabase/supabase-js';

const root=fileURLToPath(new URL('../../../',import.meta.url));
const status=JSON.parse(execFileSync(process.execPath,[root+'node_modules/supabase/dist/supabase.js','status','--output','json'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}));
const base=process.env.AUTH_TEST_APP_URL||'http://127.0.0.1:3000';
for(const url of [base,status.API_URL,status.MAILPIT_URL])assert.equal(new URL(url).hostname,'127.0.0.1');
const admin=createClient(status.API_URL,status.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const emails=new Set(),password=randomUUID()+'Aa1!';
let checks=0;
const check=label=>{checks++;console.log('PASS '+label);};
const decode=value=>value.replace(/&quot;/g,'"').replace(/&#x27;|&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
const newEmail=()=>{const email=`signup-${randomUUID()}@example.test`;emails.add(email);return email;};
function keepCookies(jar,response){
 for(const cookie of response.headers.getSetCookie()){
  const first=cookie.split(';')[0],at=first.indexOf('='),name=first.slice(0,at),value=first.slice(at+1);
  const path=cookie.match(/;\s*Path=([^;]+)/i)?.[1]||'/';
  if(/;\s*Max-Age=0(?:;|$)/i.test(cookie))jar.delete(name);else jar.set(name,{value,path});
 }
}
async function request(route,jar=new Map(),options={}){
 const url=new URL(route,base);
 const cookie=[...jar].filter(([,item])=>url.pathname.startsWith(item.path)).map(([name,item])=>`${name}=${item.value}`).join('; ');
 const response=await fetch(url,{...options,headers:{Cookie:cookie,Origin:base,...options.headers},redirect:'manual'});
 keepCookies(jar,response);return response;
}
async function submit(route,jar,fields={}){
 const html=await (await request(route,jar)).text(),form=html.match(/<form\b[^>]*>([\s\S]*?)<\/form>/)?.[1];assert.ok(form,'Expected real application form');
 const data=new FormData();
 for(const input of form.match(/<input\b[^>]*>/g)||[]){
  if(!/type="hidden"/.test(input))continue;
  const name=input.match(/name="([^"]*)"/)?.[1],value=input.match(/value="([^"]*)"/)?.[1]||'';
  if(name)data.set(decode(name),decode(value));
 }
 assert.ok([...data.keys()].some(key=>key.startsWith('$ACTION_')),'Server action marker present');
 for(const [key,value]of Object.entries(fields))data.set(key,value);
 return request(route,jar,{method:'POST',body:data});
}
async function mailLink(email,excluding){
 const deadline=Date.now()+10000;
 while(Date.now()<deadline){
  const list=await (await fetch(status.MAILPIT_URL+'/api/v1/messages')).json();
  const match=list.messages?.find(message=>message.ID!==excluding&&message.To?.some(to=>to.Address===email));
  if(match){
   const mail=await (await fetch(status.MAILPIT_URL+'/api/v1/message/'+match.ID)).json();
   const href=mail.HTML?.match(/href="([^"]*\/auth\/confirm\?[^"]*)"/)?.[1];
   assert.ok(href,'Configured Explainova confirmation template was delivered');
   return {id:match.ID,url:decode(href)};
  }
  await delay(100);
 }
 throw Error('Expected local test email did not arrive.');
}
const signUp=(email,jar)=>submit('/sign-up',jar,{email,password,confirmation:password});
async function stage(url,jar){
 const response=await request(url,jar);assert.equal(response.status,303);
 assert.equal(new URL(response.headers.get('location'),base).pathname,'/confirm-email');
 assert.match(response.headers.get('cache-control'),/no-store/);assert.equal(response.headers.get('referrer-policy'),'no-referrer');
 return response;
}

try{
 let response=await submit('/sign-up',new Map(),{email:'validation@example.test',password,confirmation:'mismatch-password'});
 assert.equal(response.status,200);assert.match(await response.text(),/Your passwords do not match/);check('mismatched signup passwords return a useful error');
 const email=newEmail(),jar=new Map();
 response=await signUp(email,jar);assert.equal(response.status,303);assert.equal(new URL(response.headers.get('location'),base).pathname,'/check-email');check('application signup redirects to check-email');
 assert.equal((await request('/api/v1/me',jar)).status,401);check('signup does not grant an unconfirmed session');
 const link=await mailLink(email);check('local inbox receives the configured confirmation email');
 const anonymous=createClient(status.API_URL,status.PUBLISHABLE_KEY||status.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 assert.equal((await anonymous.auth.signInWithPassword({email,password})).error?.code,'email_not_confirmed');check('unconfirmed password sign-in is rejected');
 response=await stage(link.url,jar);assert.ok(response.headers.getSetCookie().some(value=>/HttpOnly/i.test(value)&&/Path=\/confirm-email/i.test(value)));assert.equal((await request('/api/v1/me',jar)).status,401);check('email GET stages a short-lived HttpOnly token without signing in');
 const landing=await (await request('/confirm-email',jar)).text();assert.equal(landing.includes(new URL(link.url).searchParams.get('token_hash')),false);check('clean confirmation page does not render the token');
 response=await submit('/confirm-email',jar);assert.equal(response.status,303);assert.equal(new URL(response.headers.get('location'),base).pathname,'/projects');
 const me=await (await request('/api/v1/me',jar)).json();assert.equal(me.data.email,email);assert.equal(me.data.version,1);check('explicit confirmation establishes session and owned profile');
 const reused=new Map();await stage(link.url,reused);response=await submit('/confirm-email',reused);assert.match(await response.text(),/invalid, expired, or already used/);assert.equal((await request('/api/v1/me',reused)).status,401);check('reused confirmation link cannot create a session');
 const duplicate=new Map();response=await signUp(email,duplicate);assert.equal(response.status,303);assert.equal((await request('/api/v1/me',duplicate)).status,401);check('duplicate signup follows a generic response and cannot impersonate the owner');
 const invalid=new Map();await stage('/auth/confirm?token_hash='+ 'b'.repeat(64)+'&type=recovery&next=https://untrusted.example',invalid);assert.equal(invalid.has('explainova-confirmation'),false);check('unsupported confirmation types and redirect overrides are ignored');

 const resendEmail=newEmail(),resendJar=new Map();assert.equal((await signUp(resendEmail,resendJar)).status,303);
 const first=await mailLink(resendEmail);await delay(1100); // Honor local Auth's configured one-second email cooldown.
 response=await submit('/check-email',resendJar,{email:resendEmail});assert.match(await response.text(),/If this address needs confirmation, a new link will arrive shortly/);
 const replacement=await mailLink(resendEmail,first.id);check('application resend delivers a replacement confirmation email');
 await stage(replacement.url,resendJar);assert.equal((await submit('/confirm-email',resendJar)).status,303);check('replacement link completes confirmation');

 const expiredEmail=newEmail(),expiredJar=new Map();assert.equal((await signUp(expiredEmail,expiredJar)).status,303);
 const expiring=await mailLink(expiredEmail);
 const users=await admin.auth.admin.listUsers({perPage:1000});assert.ifError(users.error);
 const fixture=users.data.users.find(user=>user.email===expiredEmail);assert.ok(fixture&&/^[a-f0-9-]{36}$/.test(fixture.id));
 execFileSync('docker',['exec','supabase_db_explainova','psql','-U','postgres','-d','postgres','-c',`update auth.users set confirmation_sent_at = now() - interval '2 hours' where id = '${fixture.id}'`],{stdio:['ignore','pipe','pipe']});
 await stage(expiring.url,expiredJar);response=await submit('/confirm-email',expiredJar);assert.match(await response.text(),/invalid, expired, or already used/);assert.equal((await request('/api/v1/me',expiredJar)).status,401);check('genuinely expired Auth token fails safely');
 console.log(`${checks} local signup/confirmation integration checks passed.`);
}finally{
 const listed=await admin.auth.admin.listUsers({perPage:1000});assert.ifError(listed.error);
 for(const user of listed.data.users.filter(user=>emails.has(user.email))){
  assert.ifError((await admin.from('profiles').delete().eq('owner_id',user.id)).error);
  assert.ifError((await admin.auth.admin.deleteUser(user.id)).error);
 }
 console.log('Removed signup integration identities/profiles; test emails remain only in local Mailpit.');
}
