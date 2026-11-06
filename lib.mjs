import crypto from 'node:crypto';

export const sample = {
  title: 'How rain gets back to the sky', duration: 45, voice: 'female', source: 'Authored offline demonstration; not AI-generated',
  scenes: [
    {title:'A planet-sized recycling system',type:'cycle',narration:'Every raindrop is part of a journey. Water moves between the ground and the sky, powered mainly by the Sun.',labels:['SUN','WATER','SKY']},
    {title:'Sunlight provides the energy',type:'evaporation',narration:'Sunlight warms oceans, lakes, and rivers. Some liquid water becomes invisible water vapor and enters the air. This is evaporation.',labels:['SOLAR ENERGY','EVAPORATION']},
    {title:'Tiny droplets make clouds',type:'condensation',narration:'As moist air rises and cools, water vapor can condense into tiny droplets around particles in the air. Together, these droplets form clouds.',labels:['COOLING AIR','CONDENSATION']},
    {title:'Water falls back to Earth',type:'rain',narration:'Inside clouds, droplets can grow. When they become heavy enough, they fall as rain. Other conditions can produce snow or hail.',labels:['GROWING DROPLETS','PRECIPITATION']},
    {title:'The journey continues',type:'collection',narration:'Water collects in rivers and oceans, or soaks into the ground. Then the cycle continues. The Sun supplies energy; gravity brings water back down.',labels:['COLLECTION','THE CYCLE CONTINUES']}
  ]
};
export function validate(input) {
  if (!input || typeof input.title !== 'string' || !input.title.trim() || input.title.length > 140) throw Error('A title of 1–140 characters is required.');
  if (![30,45,60,90].includes(Number(input.duration))) throw Error('Choose 30, 60, or 90 seconds (45 is supported for the sample).');
  if (!['male','female'].includes(input.voice)) throw Error('Select male or female voice.');
  if (!Array.isArray(input.scenes) || input.scenes.length < 2 || input.scenes.length > 10) throw Error('Use 2–10 scenes.');
  for (const s of input.scenes) {
    if (!['cycle','evaporation','condensation','rain','collection','diagram','process','comparison'].includes(s.type)) throw Error('Unsupported scene type.');
    if (typeof s.title !== 'string' || s.title.length > 120 || typeof s.narration !== 'string' || !s.narration.trim() || s.narration.length > 900) throw Error('Each scene needs a short title and narration (maximum 900 characters).');
    if (!Array.isArray(s.labels) || s.labels.length > 4 || s.labels.some(v=>typeof v!=='string'||v.length>50)) throw Error('Use up to four short text labels per scene.');
  }
  return structuredClone(input);
}
export const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function captions(text, duration) {
  const words = text.trim().split(/\s+/);
  const chunks=[];
  for(let i=0;i<words.length;i+=6) chunks.push({text:words.slice(i,i+6).join(' '),start:duration*i/words.length,end:duration*Math.min(i+6,words.length)/words.length});
  return chunks;
}
export function timedCaptions(words,duration) {
  if(!Array.isArray(words)||!words.length||words.some(w=>!Number.isFinite(w.start)||w.start<0||typeof w.text!=='string'))throw Error('Missing speech word timestamps.');
  if(words.at(-1).start>=duration||words.some((w,i)=>i&&w.start<words[i-1].start))throw Error('Speech timestamps exceed or contradict the audio duration.');
  const result=[];
  for(let i=0;i<words.length;i+=6)result.push({text:words.slice(i,i+6).map(w=>w.text).join(' '),start:words[i].start,end:words[i+6]?.start??duration});
  return result;
}
export const srtTime = t => new Date(Math.round(t*1000)).toISOString().slice(11,23).replace('.',',');
export function toSrt(items) { return items.map((c,i)=>`${i+1}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${c.text}\n`).join('\n'); }
