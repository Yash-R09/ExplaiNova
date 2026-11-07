import {test} from 'node:test';
import assert from 'node:assert/strict';
import {confirmationToken,readConfirmation,signupValidation,passwordValidation,CONFIRM_SECONDS} from '../src/lib/confirmation-policy.ts';

test('signup validation requires an email, matching passwords and a bounded password',()=>{
  assert.equal(signupValidation('creator@example.test','A-good-password-123','A-good-password-123'),null);
  assert.match(signupValidation('invalid','Testing-123','Testing-123')!,/email/);
  assert.match(signupValidation('creator@example.test','short','short')!,/at least 8/);
  assert.match(signupValidation('creator@example.test','Testing-123','different')!,/do not match/);
  assert.match(signupValidation('creator@example.test','x'.repeat(73),'x'.repeat(73))!,/shorter/);
  assert.match(signupValidation('creator@example.test','😀'.repeat(20),'😀'.repeat(20))!,/shorter/);
});

test('confirmation accepts only bounded hashes and a recent staged token',()=>{
  const now=Date.now(),hash='a'.repeat(64);
  const encoded=(value:unknown)=>Buffer.from(JSON.stringify(value)).toString('base64url');
  assert.equal(confirmationToken(hash),hash);
  assert.equal(confirmationToken('pkce_'+'b'.repeat(56)),'pkce_'+'b'.repeat(56));
  assert.equal(confirmationToken('b'.repeat(56)),'b'.repeat(56));
  for(const invalid of [null,'a'.repeat(63),'g'.repeat(64),'https://example.com'])assert.equal(confirmationToken(invalid),null);
  assert.deepEqual(readConfirmation(encoded({tokenHash:hash,createdAt:now}),now),{tokenHash:hash});
  assert.equal(readConfirmation(encoded({tokenHash:hash,createdAt:now-CONFIRM_SECONDS*1000-1}),now),null);
  assert.equal(readConfirmation(encoded({tokenHash:hash,createdAt:now+60000}),now),null);
  assert.equal(readConfirmation(encoded({tokenHash:hash}),now),null);
  assert.equal(readConfirmation('malformed'),null);
  assert.equal(readConfirmation('x'.repeat(1025)),null);
});

test('recovery password rules are independent of an email or signed-in identity',()=>{
  assert.equal(passwordValidation('New-testing-password','New-testing-password'),null);
  assert.match(passwordValidation('short','short')!,/at least 8/);
  assert.match(passwordValidation('New-testing-password','Different-password')!,/do not match/);
});
