import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {localAuthHarness} from './local-form-support.mjs';

const {base,admin,publicClient,request,submit,mailLink,browserSession}=localAuthHarness();
const fixtures=[],oldPassword=randomUUID()+'Aa1!',newPassword=randomUUID()+'Bb2!',otherPassword=randomUUID()+'Cc3!';
let checks=0;
const check=label=>{checks++;console.log('PASS '+label);};
const generic='If an account matches this email, a reset link will arrive shortly.';
async function makeIdentity(){
 const email=`recovery-${randomUUID()}@example.test`;
 const {data,error}=await admin.auth.admin.createUser({email,password:oldPassword,email_confirm:true});assert.ifError(error);fixtures.push(data.user.id);return {id:data.user.id,email};
}
async function recoveryLink(email,excluding){
 const response=await submit('/forgot-password',new Map(),{email});assert.equal(response.status,200);assert.ok((await response.text()).includes(generic));
 return mailLink(email,'/auth/recovery',excluding);
}
async function stage(url,jar){
 const response=await request(url,jar);assert.equal(response.status,303);
 assert.equal(new URL(response.headers.get('location'),base).pathname,'/reset-password');
 assert.match(response.headers.get('cache-control'),/no-store/);assert.equal(response.headers.get('referrer-policy'),'no-referrer');return response;
}
const fields=(password,confirmation=password)=>({password,confirmation});
const validLogin=async(email,password)=>assert.ifError((await publicClient().auth.signInWithPassword({email,password})).error);

try{
 const alice=await makeIdentity(),bob=await makeIdentity();
 let response=await submit('/forgot-password',new Map(),{email:`unknown-${randomUUID()}@example.test`});assert.ok((await response.text()).includes(generic));check('unknown recovery address gets generic feedback');
 const beforeClient=publicClient(),prior=await beforeClient.auth.signInWithPassword({email:alice.email,password:oldPassword});assert.ifError(prior.error);
 const bobJar=await browserSession(bob.email,oldPassword);
 response=await submit('/reset-password',bobJar,fields(otherPassword));assert.match(await response.text(),/reset link is unavailable/);await validLogin(bob.email,oldPassword);check('ordinary sign-in session cannot substitute for a recovery link');
 const link=await recoveryLink(alice.email);check('reset request delivers the configured local recovery email');
 response=await stage(link.url+'&next=https://untrusted.example',bobJar);
 assert.ok(response.headers.getSetCookie().some(value=>/HttpOnly/i.test(value)&&/Path=\/reset-password/i.test(value)));
 assert.equal((await (await request('/api/v1/me',bobJar)).json()).data.id,bob.id);check('recovery GET preserves the different signed-in account and stages only a scoped token');
 const html=await (await request('/reset-password',bobJar)).text();assert.equal(html.includes(new URL(link.url).searchParams.get('token_hash')),false);check('recovery token is absent from the clean reset form');
 response=await submit('/reset-password',bobJar,fields(newPassword,'different-testing-password'));assert.match(await response.text(),/passwords do not match/);assert.equal(bobJar.has('explainova-recovery'),true);await validLogin(alice.email,oldPassword);check('input mismatch leaves the one-use recovery link unconsumed');
 response=await submit('/reset-password',bobJar,fields(newPassword),'https://untrusted.example');assert.ok(response.status>=400);await validLogin(alice.email,oldPassword);check('cross-origin password-reset submission is rejected');
 response=await submit('/reset-password',bobJar,fields(newPassword));assert.equal(response.status,303);
 const target=new URL(response.headers.get('location'),base);assert.equal(target.pathname,'/sign-in');assert.equal(target.searchParams.get('reason'),'PASSWORD_UPDATED');assert.equal(bobJar.has('explainova-recovery'),false);check('recovery updates the emailed account and returns to sign-in');
 assert.equal((await (await request('/api/v1/me',bobJar)).json()).data.id,bob.id);await validLogin(bob.email,oldPassword);check('other signed-in identity and password remain unchanged');
 await validLogin(alice.email,newPassword);assert.ok((await publicClient().auth.signInWithPassword({email:alice.email,password:oldPassword})).error);check('new password works and previous password fails');
 const refreshed=await publicClient().auth.refreshSession({refresh_token:prior.data.session.refresh_token});assert.ok(refreshed.error);check('successful reset revokes prior refresh sessions');
 const reused=new Map();await stage(link.url,reused);response=await submit('/reset-password',reused,fields(otherPassword));assert.match(await response.text(),/invalid, expired, or already used/);assert.equal((await request('/api/v1/me',reused)).status,401);await validLogin(alice.email,newPassword);check('reused link cannot change the password or create a browser session');

 await delay(1100);const same=await recoveryLink(alice.email,link.id),sameJar=new Map();await stage(same.url,sameJar);response=await submit('/reset-password',sameJar,fields(newPassword));assert.match(await response.text(),/password you have not used before/);assert.equal(sameJar.has('explainova-recovery'),false);check('same-password rejection clearly requires a fresh reset link');
 await delay(1100);const expiring=await recoveryLink(alice.email,same.id),expiredJar=new Map();
 assert.match(alice.id,/^[a-f0-9-]{36}$/);
 execFileSync('docker',['exec','supabase_db_explainova','psql','-U','postgres','-d','postgres','-c',`update auth.users set recovery_sent_at = now() - interval '2 hours' where id = '${alice.id}'`],{stdio:['ignore','pipe','pipe']});
 await stage(expiring.url,expiredJar);response=await submit('/reset-password',expiredJar,fields(otherPassword));assert.match(await response.text(),/invalid, expired, or already used/);await validLogin(alice.email,newPassword);check('genuinely expired recovery token fails without changing the password');
 const wrong=new Map();await stage('/auth/recovery?token_hash='+ 'a'.repeat(64)+'&type=email&next=https://untrusted.example',wrong);assert.equal(wrong.has('explainova-recovery'),false);check('wrong recovery purpose and external redirect overrides are ignored');
 const invalidToken=new Map();await stage('/auth/recovery?type=recovery&token_hash='+'f'.repeat(64),invalidToken);response=await submit('/reset-password',invalidToken,fields(otherPassword));assert.match(await response.text(),/invalid, expired, or already used/);await validLogin(alice.email,newPassword);check('syntactically valid but unissued token cannot authorize a reset');
 const inactive=await makeIdentity();assert.ifError((await admin.from('profiles').update({deletion_status:'pending'}).eq('owner_id',inactive.id)).error);
 const inactiveLink=await recoveryLink(inactive.email),inactiveJar=new Map();await stage(inactiveLink.url,inactiveJar);response=await submit('/reset-password',inactiveJar,fields(otherPassword));assert.match(await response.text(),/account cannot be recovered right now/);await validLogin(inactive.email,oldPassword);check('inactive owned profile blocks password changes');
 console.log(`${checks} local password-recovery integration checks passed.`);
}finally{
 for(const id of fixtures){assert.ifError((await admin.from('profiles').delete().eq('owner_id',id)).error);assert.ifError((await admin.auth.admin.deleteUser(id)).error);}
 console.log('Removed disposable recovery identities/profiles; local test emails refer to deleted fixtures.');
}
