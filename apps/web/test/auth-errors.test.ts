import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createClient, AuthRetryableFetchError} from '@supabase/supabase-js';
import {authErrorKind,authErrorMessage} from '../src/lib/auth-errors.ts';

test('returned network/service errors use retry guidance rather than credential advice',async()=>{
  const client=createClient('http://127.0.0.1:54321','not-a-real-public-key',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async()=>{throw new AuthRetryableFetchError('Simulated offline service',0);}}});
  const {error}=await client.auth.signInWithPassword({email:'outage@example.test',password:'Testing-only-123'});
  assert.ok(error);assert.equal(authErrorKind(error),'unavailable');
  assert.equal(authErrorMessage(error,'sign-in'),'Sign-in is temporarily unavailable. Please try again later.');
  for(const status of [500,502,503])assert.equal(authErrorKind({status}),'unavailable');
  assert.equal(authErrorMessage({status:503},'recovery'),'Password recovery is temporarily unavailable. Please try again later.');
});

test('credential failures and throttling remain generic and distinct',()=>{
  assert.equal(authErrorKind({status:400,code:'invalid_credentials'}),'invalid');
  assert.equal(authErrorMessage({status:400},'sign-in'),'Unable to sign in. Check your credentials and email confirmation.');
  assert.equal(authErrorKind({status:429}),'rate_limit');
  assert.match(authErrorMessage({status:429},'resend'),/Please wait/);
  assert.match(authErrorMessage({status:403,code:'otp_expired'},'confirm'),/invalid, expired, or already used/);
});
