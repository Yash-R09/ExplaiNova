export type DraftSettings={voice:'male'|'female';captions:true;theme:'topic'};
export type DraftPreferences={targetDurationMs:number;audienceLevel:string;tone:string;settings:DraftSettings};
export const defaultDraftSettings:DraftSettings={voice:'female',captions:true,theme:'topic'};
export function validSettingsPatch(value:unknown):value is Partial<DraftSettings>{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const s=value as Record<string,unknown>;
 return Object.keys(s).every(k=>['voice','captions','theme'].includes(k))&&(!('voice' in s)||['male','female'].includes(s.voice as string))&&(!('captions' in s)||s.captions===true)&&(!('theme' in s)||s.theme==='topic');
}
export function validPreferences(value:unknown):value is DraftPreferences{
 if(!value||typeof value!=='object')return false;
 const p=value as DraftPreferences;
 return [30000,60000,90000].includes(p.targetDurationMs)&&['beginner','intermediate','advanced'].includes(p.audienceLevel)&&['clear','conversational','direct'].includes(p.tone)&&validSettingsPatch(p.settings)&&Object.keys(p.settings).length===3;
}
export function copyPreferences(p:DraftPreferences):DraftPreferences{return {targetDurationMs:p.targetDurationMs,audienceLevel:p.audienceLevel,tone:p.tone,settings:{voice:p.settings.voice,captions:true,theme:'topic'}};}
