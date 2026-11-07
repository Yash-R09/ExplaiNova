import {test} from 'node:test';
import assert from 'node:assert/strict';
import {safeReturnTo,isStudioPath} from '../src/lib/auth-policy.ts';
import {getSupabaseConfig} from '../src/lib/supabase/config.ts';

test('sign-in return targets cannot redirect outside the known studio routes',()=>{
  for(const target of ['https://untrusted.example','//untrusted.example','/\\untrusted.example','/sign-in','/projects?next=evil','/projects/../sign-in',null,['/settings']]) assert.equal(safeReturnTo(target),'/projects');
  assert.equal(safeReturnTo('/settings'),'/settings');
  assert.equal(isStudioPath('/projects/123'),true);
  assert.equal(isStudioPath('/projects-public'),false);
  assert.equal(isStudioPath('/sign-in'),false);
});

test('authentication configuration fails closed and rejects privileged browser keys',()=>{
  const names=['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY','NEXT_PUBLIC_APP_URL'] as const;
  const before=names.map(name=>process.env[name]);
  try{
    names.forEach(name=>delete process.env[name]);assert.equal(getSupabaseConfig(),null);
    process.env.NEXT_PUBLIC_SUPABASE_URL='http://127.0.0.1:54321';
    process.env.NEXT_PUBLIC_APP_URL='http://127.0.0.1:3000';
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY='sb_secret_test_only';assert.equal(getSupabaseConfig(),null);
    const jwt=(role:string)=>'header.'+Buffer.from(JSON.stringify({role})).toString('base64url')+'.signature';
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=jwt('service_role');assert.equal(getSupabaseConfig(),null);
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=jwt('anon');assert.equal(getSupabaseConfig()?.cookieOptions.secure,false);
    process.env.NEXT_PUBLIC_APP_URL='https://explainova.example';assert.equal(getSupabaseConfig()?.cookieOptions.secure,true);
    process.env.NEXT_PUBLIC_SUPABASE_URL='http://untrusted.example';assert.equal(getSupabaseConfig(),null);
  }finally{names.forEach((name,index)=>{if(before[index]===undefined)delete process.env[name];else process.env[name]=before[index];});}
});
