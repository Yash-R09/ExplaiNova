import {validSettingsPatch,validPreferences,type DraftSettings} from './draft-preferences.ts';
export type IdeaProject = {
  id: string; title: string; revision: number; brief: string; referenceText: string;
  targetDurationMs: number; audienceLevel: string; tone: string; settings: DraftSettings;
  status: 'draft'; createdAt: string; updatedAt: string;
};
export type TrashedProject={id:string;title:string;revision:number;deletedAt:string;updatedAt:string};
export type ProjectView='drafts'|'trash';
export class ProjectError extends Error {
  code: string; status: number; details?: Record<string, unknown>;
  constructor(code: string, status: number, message: string, details?: Record<string, unknown>) { super(message); this.code=code; this.status=status; this.details=details; }
}
export const uuidPattern=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function projectId(value: unknown) {
  if(typeof value!=='string'||!uuidPattern.test(value))throw new ProjectError('VALIDATION_FAILED',400,'Invalid project identifier.');
  return value;
}
export function projectInput(value: unknown, patch=false): Record<string,string|number|Partial<DraftSettings>> {
  const fail=()=>{throw new ProjectError('VALIDATION_FAILED',422,'Check the title, idea, notes, and video settings.');};
  if(!value||typeof value!=='object'||Array.isArray(value))return fail();
  const input=value as Record<string,unknown>,keys=['title','brief','referenceText','targetDurationMs','audienceLevel','tone','settings'];
  if(Object.keys(input).some(key=>!keys.includes(key)&&!(patch&&key==='expectedRevision')))return fail();
  if(patch&&(!Number.isInteger(input.expectedRevision)||Number(input.expectedRevision)<1||Number(input.expectedRevision)>2147483646||Object.keys(input).length<2))return fail();
  const result:Record<string,unknown>=patch?{...input}:{title:'Untitled idea',brief:'',referenceText:'',targetDurationMs:60000,audienceLevel:'beginner',tone:'clear',...input};
  for(const [key,limit] of [['title',140],['brief',6000],['referenceText',20000]] as const){
    if(key in result){if(typeof result[key]!=='string')return fail();if(key==='title')result[key]=(result[key] as string).trim();if((result[key] as string).length>limit||(key==='title'&&!result[key]))return fail();}
  }
  if('targetDurationMs' in result&&![30000,60000,90000].includes(result.targetDurationMs as number))return fail();
  if('audienceLevel' in result&&!['beginner','intermediate','advanced'].includes(result.audienceLevel as string))return fail();
  if('tone' in result&&!['clear','conversational','direct'].includes(result.tone as string))return fail();
  if('settings' in result&&!validSettingsPatch(result.settings))return fail();
  return result as Record<string,string|number|Partial<DraftSettings>>;
}
export function commandKey(value: string|null){
  if(!value||!/^[A-Za-z0-9_-]{16,128}$/.test(value))throw new ProjectError('VALIDATION_FAILED',400,'A valid Idempotency-Key is required.');
  return value;
}
export function duplicateProjectInput(value:unknown):{expectedRevision:number}{
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==1||!('expectedRevision' in value)||!Number.isInteger(value.expectedRevision)||Number(value.expectedRevision)<1||Number(value.expectedRevision)>2147483647)throw new ProjectError('VALIDATION_FAILED',422,'Choose the saved draft revision to duplicate.');
  return {expectedRevision:Number(value.expectedRevision)};
}
export function lifecycleProjectInput(value:unknown):{expectedRevision:number}{
  try{const result=duplicateProjectInput(value);if(result.expectedRevision>2147483646)throw Error();return result;}
  catch{throw new ProjectError('VALIDATION_FAILED',422,'Choose a valid saved draft revision.');}
}
export function projectSearch(value:unknown):string{
  if(value===null||value===undefined)return '';
  if(typeof value!=='string'||value.length>140)throw new ProjectError('VALIDATION_FAILED',400,'Search titles using up to 140 characters.');
  const query=value.trim();if(/[\u0000-\u001f\u007f]/.test(query))throw new ProjectError('VALIDATION_FAILED',400,'Use a single line to search titles.');
  return query;
}
export function projectLibraryHref(view:ProjectView,query='',cursor?:string){
  const params=new URLSearchParams();if(query)params.set('q',query);if(cursor)params.set('cursor',cursor);
  const base=view==='trash'?'/projects/trash':'/projects';return base+(params.size?'?'+params.toString():'');
}
export type ProjectCursor={updatedAt:string;id:string;filter:'drafts-v1'|'trash-v1'|'drafts-search-v1'|'trash-search-v1';query?:string};
export function parseProjectCursor(value: unknown,view:ProjectView='drafts',search=''): ProjectCursor|null {
  if(value===undefined||value===null)return null;
  const fail=()=>{throw new ProjectError('INVALID_CURSOR',400,'The project page link is invalid. Open the first page again.');};
  if(typeof value!=='string'||value.length>1024||!/^[A-Za-z0-9_-]+$/.test(value))return fail();
  const query=projectSearch(search);
  try{
    const cursor=JSON.parse(Buffer.from(value,'base64url').toString());
    if(Object.keys(cursor).sort().join(',')!==(query?'filter,id,query,updatedAt':'filter,id,updatedAt')||cursor.filter!==`${view}${query?'-search':''}-v1`||(query&&cursor.query!==query)||typeof cursor.id!=='string'||!uuidPattern.test(cursor.id)||typeof cursor.updatedAt!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|\+00:00)$/.test(cursor.updatedAt)||!Number.isFinite(Date.parse(cursor.updatedAt))||new Date(cursor.updatedAt).toISOString().slice(0,19)!==cursor.updatedAt.slice(0,19))return fail();
    return cursor;
  }catch{return fail();}
}
export function makeProjectCursor(project: Pick<IdeaProject,'updatedAt'|'id'>,view:ProjectView='drafts',search=''){
  const query=projectSearch(search);return Buffer.from(JSON.stringify({updatedAt:project.updatedAt,id:project.id,filter:`${view}${query?'-search':''}-v1`,...(query?{query}:{})})).toString('base64url');
}
export function asTrashedProject(value:unknown):TrashedProject{
  const p=value as TrashedProject;
  if(!p||!uuidPattern.test(p.id)||!Number.isInteger(p.revision)||typeof p.title!=='string'||typeof p.deletedAt!=='string'||typeof p.updatedAt!=='string')throw new ProjectError('TEMPORARILY_UNAVAILABLE',503,'Trash could not be loaded. Please try again.');
  return p;
}
export function asIdeaProject(value: unknown): IdeaProject {
  const p=value as IdeaProject;
  if(!p||!uuidPattern.test(p.id)||!Number.isInteger(p.revision)||typeof p.title!=='string'||typeof p.brief!=='string'||typeof p.referenceText!=='string'||typeof p.updatedAt!=='string'||!validPreferences(p))throw new ProjectError('TEMPORARILY_UNAVAILABLE',503,'The draft could not be loaded. Please try again.');
  return p;
}
