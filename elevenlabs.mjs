import fs from 'node:fs/promises';

export function alignmentWords(alignment) {
  if(!alignment?.characters?.length)throw Error('ElevenLabs did not return character alignment.');
  const words=[];let text='',start=0;
  alignment.characters.forEach((char,i)=>{
    if(/\s/.test(char)){if(text){words.push({text,start});text='';}}
    else{if(!text)start=alignment.character_start_times_seconds[i];text+=char;}
  });
  if(text)words.push({text,start});
  return words;
}
export function pcmWav(pcm) {
  const header=Buffer.alloc(44);header.write('RIFF');header.writeUInt32LE(36+pcm.length,4);header.write('WAVEfmt ',8);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(1,22);header.writeUInt32LE(16000,24);header.writeUInt32LE(32000,28);header.writeUInt16LE(2,32);header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(pcm.length,40);return Buffer.concat([header,pcm]);
}
export async function synthesizeEleven(text,config,{apiKey=process.env.ELEVENLABS_API_KEY,send=fetch}={}) {
  if(!apiKey)throw Error('ELEVENLABS_API_KEY is missing.');
  if(!config?.voiceId||config.category!=='premade')throw Error('Only account-listed premade voices are allowed; no community/library voice selection.');
  const response=await send(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(config.voiceId)}/with-timestamps?output_format=pcm_16000`,{
    method:'POST',headers:{'Content-Type':'application/json','xi-api-key':apiKey},signal:AbortSignal.timeout(90000),
    body:JSON.stringify({text,model_id:config.modelId,voice_settings:{stability:.55,similarity_boost:.75,speed:1}})
  });
  if(!response.ok){let status='request_failed';try{const data=await response.json();status=data.detail?.status||status;}catch{}throw Object.assign(Error(`ElevenLabs ${response.status}: ${status}. No voice substitution or plan upgrade performed.`),{status:response.status});}
  return response.json();
}
export async function narrateEleven(text,config,wav) {
  const data=await synthesizeEleven(text,config);
  const words=alignmentWords(data.normalized_alignment||data.alignment);
  const audio=pcmWav(Buffer.from(data.audio_base64,'base64'));
  // Persist once; API calls are not blindly retried because they can consume quota.
  await fs.writeFile(wav,audio);await fs.writeFile(wav+'.json',JSON.stringify(words,null,2));
}
