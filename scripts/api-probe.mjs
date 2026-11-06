import fs from 'node:fs/promises';
await fs.mkdir('outputs/api-first',{recursive:true});
for(const key of ['GEMINI_API_KEY','ELEVENLABS_API_KEY'])if(!process.env[key]?.trim())throw Error(`${key} is empty in .env`);
const g=await fetch('https://generativelanguage.googleapis.com/v1beta/models',{headers:{'x-goog-api-key':process.env.GEMINI_API_KEY},signal:AbortSignal.timeout(30000)});
console.log('Gemini model access:',g.status);
if(g.ok){const data=await g.json();const names=data.models?.filter(m=>m.supportedGenerationMethods?.includes('generateContent')).map(m=>m.name);await fs.writeFile('outputs/api-first/models.json',JSON.stringify(names,null,2));console.log('Available text models:',names?.filter(n=>/flash/.test(n)).slice(0,15));}
const e=await fetch('https://api.elevenlabs.io/v2/voices?page_size=100&include_total_count=false',{headers:{'xi-api-key':process.env.ELEVENLABS_API_KEY},signal:AbortSignal.timeout(30000)});
console.log('ElevenLabs voice access:',e.status);
if(e.ok){const data=await e.json();await fs.writeFile('outputs/api-first/voices.json',JSON.stringify(data,null,2));console.log('Voice metadata:',data.voices.map(v=>({id:v.voice_id,name:v.name,category:v.category,gender:v.labels?.gender,free:v.sharing?.free_users_allowed,library:v.sharing?.enabled_in_library})));}else{const data=await e.json();console.log('Voice access error:',data.detail?.status||'permission or authentication error');}
