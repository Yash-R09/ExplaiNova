// Requires local Supabase and a running production/dev Next.js server.
// All credentials remain in memory; fixtures are removed in finally.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {createServerClient} from '@supabase/ssr';

const root=fileURLToPath(new URL('../../../',import.meta.url));
const status=JSON.parse(execFileSync(process.execPath,[root+'node_modules/supabase/dist/supabase.js','status','--output','json'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}));
assert.equal(new URL(status.API_URL).hostname,'127.0.0.1');
const base=process.env.AUTH_TEST_APP_URL||'http://127.0.0.1:3000';
assert.equal(new URL(base).hostname,'127.0.0.1');
const admin=createClient(status.API_URL,status.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const fixtures=[];
let checks=0;
const check=message=>{checks++;console.log('PASS '+message);};
const cookieHeader=jar=>[...jar].map(([name,value])=>`${name}=${value}`).join('; ');
const request=(route,jar=new Map())=>fetch(base+route,{headers:{Cookie:cookieHeader(jar)},redirect:'manual'});
async function makeIdentity(label){
 const email=`session-${label}-${randomUUID()}@example.test`,password=randomUUID()+'Aa1!';
 const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true});assert.ifError(error);fixtures.push(data.user.id);
 const jar=new Map();
 const client=createServerClient(status.API_URL,status.PUBLISHABLE_KEY||status.ANON_KEY,{cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:values=>values.forEach(({name,value})=>jar.set(name,value))}});
 const result=await client.auth.signInWithPassword({email,password});assert.ifError(result.error);
 return {id:data.user.id,email,jar};
}

try{
 let response=await request('/projects');assert.equal(response.status,307);assert.equal(new URL(response.headers.get('location'),base).pathname,'/sign-in');check('anonymous studio request redirects to sign-in');
 response=await request('/api/v1/me');assert.equal(response.status,401);assert.match(response.headers.get('cache-control'),/no-store/);check('anonymous API request is unauthorized and never cached');
 const alice=await makeIdentity('alice'),bob=await makeIdentity('bob');
 for(const identity of [alice,bob]){
  response=await request('/api/v1/me',identity.jar);assert.equal(response.status,200);const body=await response.json();assert.equal(body.data.id,identity.id);assert.equal(body.data.email,identity.email);assert.equal(JSON.stringify(body).includes('access_token'),false);check('verified session returns only its owned profile');
 }
 response=await request('/api/v1/me?ownerId='+bob.id,alice.jar);assert.equal((await response.json()).data.id,alice.id);check('client-supplied owner ID cannot switch identity');
 response=await request('/projects',alice.jar);assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/no-store/);check('authenticated studio route renders without public caching');
 const invalid=new Map([...alice.jar].map(([name])=>[name,'base64-not-valid-json']));
 response=await request('/api/v1/me',invalid);assert.equal(response.status,401);check('corrupted session cookie is rejected');

 const cookieNames=[...alice.jar.keys()].filter(name=>/auth-token(?:\.\d+)?$/.test(name)).sort();
 const name=cookieNames[0].replace(/\.\d+$/,'');
 const encoded=cookieNames.map(key=>alice.jar.get(key)).join('');assert.ok(encoded.startsWith('base64-'));
 const session=JSON.parse(Buffer.from(encoded.slice(7),'base64url').toString());session.expires_at=Math.floor(Date.now()/1000)-120;
 const expired='base64-'+Buffer.from(JSON.stringify(session)).toString('base64url');
 const expiredJar=new Map();for(let i=0;i<expired.length;i+=3000)expiredJar.set(expired.length>3000?`${name}.${i/3000}`:name,expired.slice(i,i+3000));
 response=await request('/api/v1/me',expiredJar);assert.equal(response.status,200);assert.equal((await response.json()).data.id,alice.id);assert.ok(response.headers.getSetCookie().length>0);check('expired session envelope refreshes and propagates replacement cookies');

 let result=await admin.from('profiles').update({deletion_status:'pending'}).eq('owner_id',bob.id);assert.ifError(result.error);
 response=await request('/api/v1/me',bob.jar);assert.equal(response.status,403);check('inactive profile cannot access the private API');
 result=await admin.from('profiles').delete().eq('owner_id',alice.id);assert.ifError(result.error);
 // The original access token still validates; missing profile must fail closed.
 response=await request('/api/v1/me',alice.jar);assert.equal(response.status,503);check('missing profile fails closed without leaking database details');
 console.log(`${checks} local session integration checks passed.`);
}finally{
 for(const id of fixtures){
  const removed=await admin.from('profiles').delete().eq('owner_id',id);assert.ifError(removed.error);
  const deleted=await admin.auth.admin.deleteUser(id);assert.ifError(deleted.error);
 }
 console.log('Removed disposable integration identities and profiles.');
}
