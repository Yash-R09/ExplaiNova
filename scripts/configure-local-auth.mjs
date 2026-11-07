// Write browser-safe local configuration; never copy service/provider secrets.
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const cli=fileURLToPath(new URL('../node_modules/supabase/dist/supabase.js',import.meta.url));
const target=new URL('../apps/web/.env.local',import.meta.url);
try{
 const status=JSON.parse(execFileSync(process.execPath,[cli,'status','--output','json'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}));
 if(!['127.0.0.1','localhost'].includes(new URL(status.API_URL).hostname))throw Error('Local endpoint required.');
 const key=status.PUBLISHABLE_KEY||status.ANON_KEY;
 if(!key)throw Error('Local browser key unavailable.');
 await fs.writeFile(target,`# Local Supabase; generated without server secrets.\nNEXT_PUBLIC_SUPABASE_URL=${status.API_URL}\nNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${key}\nNEXT_PUBLIC_APP_URL=http://127.0.0.1:3000\n`,{flag:'wx'});
 console.log('Created ignored apps/web/.env.local with local browser-safe configuration.');
}catch(error){
 if(error.code==='EEXIST')console.log('Existing apps/web/.env.local preserved.');
 else{console.error('Local auth configuration failed. Start Supabase and check the local status; no keys were printed.');process.exitCode=1;}
}
