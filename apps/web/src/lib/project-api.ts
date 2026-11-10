import 'server-only';
import { readIdentity } from './session';
import { createClient } from './supabase/server';
import { getSupabaseConfig } from './supabase/config';
import { ProjectError } from './project-contract';

export const projectHeaders={'Cache-Control':'private, no-store'};
export function projectSuccess(data:unknown,requestId:string,status=200,meta:Record<string,unknown>={},headers:Record<string,string>={}){return Response.json({data,meta:{requestId,...meta}},{status,headers:{...projectHeaders,...headers}});}
export function databaseProjectError(error:{message:string;details?:string}):never {
  if(error.message==='STORYBOARD_IDEA_REQUIRED'){
    throw new ProjectError(error.message,422,'Add a topic or idea and save the draft before generating a storyboard.');
  }
  if(error.message==='BRAINSTORM_RATE_LIMITED'){
    const retryAfterSeconds=/^[1-9][0-9]{0,3}$/.test(error.details??'')?Number(error.details):3600;
    throw new ProjectError(error.message,429,'You have reached the hourly brainstorming limit. Try again later.',{retryAfterSeconds});
  }
  const errors:Record<string,[number,string]>={SESSION_REQUIRED:[401,'Please sign in to continue.'],ACCOUNT_UNAVAILABLE:[403,'Your workspace is unavailable.'],RESOURCE_NOT_FOUND:[404,'Draft not found.'],VALIDATION_FAILED:[422,'Check the title, idea, notes, and video settings.'],IDEMPOTENCY_CONFLICT:[409,'This request key was already used for different changes.'],REVISION_CONFLICT:[409,'A newer version was saved. Your unsaved text has been kept.']};
  const known=errors[error.message];
  if(!known)throw new ProjectError('TEMPORARILY_UNAVAILABLE',503,'The draft service is temporarily unavailable. Please try again.');
  const details=error.message==='REVISION_CONFLICT'&&/^\d+$/.test(error.details??'')?{currentRevision:Number(error.details)}:undefined;
  throw new ProjectError(error.message,known[0],known[1],details);
}
export async function projectApi(handler:(client:NonNullable<Awaited<ReturnType<typeof createClient>>>,requestId:string,ownerId:string)=>Promise<Response>){
  const requestId=crypto.randomUUID();
  try{
    const identity=await readIdentity();
    if('error' in identity){const code=identity.error!;throw new ProjectError(code,code==='SESSION_REQUIRED'?401:code==='ACCOUNT_UNAVAILABLE'?403:503,code==='SESSION_REQUIRED'?'Please sign in to continue.':'Your workspace is unavailable.');}
    const client=await createClient();if(!client)throw new ProjectError('AUTH_UNAVAILABLE',503,'Your workspace is unavailable.');
    return await handler(client,requestId,identity.user.id);
  }catch(error){
    const failure=error instanceof ProjectError?error:new ProjectError('TEMPORARILY_UNAVAILABLE',503,'The draft service is temporarily unavailable. Please try again.');
    const headers=new Headers(projectHeaders);
    if(failure.code==='BRAINSTORM_RATE_LIMITED')headers.set('Retry-After',String(failure.details?.retryAfterSeconds??3600));
    return Response.json({error:{code:failure.code,message:failure.message,retryable:failure.status===503||failure.status===429,correlationId:requestId,...(failure.details?{details:failure.details}:{})}},{status:failure.status,headers});
  }
}
export async function projectBody(request:Request){
  const config=getSupabaseConfig();
  // Next's internal request URL can use localhost even when the browser uses
  // 127.0.0.1. Check the public Host and Origin rather than that rewritten URL.
  if(!config||request.headers.get('origin')!==config.appUrl||request.headers.get('host')!==new URL(config.appUrl).host||request.headers.get('sec-fetch-site')==='cross-site')throw new ProjectError('CSRF_FAILED',403,'Reload the app and try again.');
  if(request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')throw new ProjectError('INVALID_JSON',400,'Send the draft as JSON.');
  const reader=request.body?.getReader();let bytes=0,text='';const decoder=new TextDecoder();
  if(reader){try{while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>65536){await reader.cancel();throw new ProjectError('REQUEST_TOO_LARGE',413,'The draft is too large. Shorten the idea or reference notes.');}text+=decoder.decode(value,{stream:true});}text+=decoder.decode();}finally{reader.releaseLock();}}
  try{return JSON.parse(text);}catch{throw new ProjectError('INVALID_JSON',400,'The draft request contains invalid JSON.');}
}
